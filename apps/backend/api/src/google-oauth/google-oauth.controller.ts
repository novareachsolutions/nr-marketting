import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoogleOAuthService } from './google-oauth.service';
import { GscApiService } from './gsc-api.service';
import { GaApiService } from './ga-api.service';

@Controller('google-oauth')
export class GoogleOAuthController {
  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly gsc: GscApiService,
    private readonly ga: GaApiService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * The authorize endpoint is accessed via browser redirect (window.location),
   * so the JWT cannot come from an Authorization header. Instead the frontend
   * passes the token as a query parameter which we verify manually.
   */
  @Get('authorize')
  authorize(
    @Query('token') token: string,
    @Query('gbp') gbp: string,
    @Res() res: Response,
  ) {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3001';

    if (!token) {
      return res.redirect(
        `${frontendUrl}/settings/integrations?error=missing_token`,
      );
    }

    try {
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      const includeGbp = gbp === '1' || gbp === 'true';
      const url = this.googleOAuthService.getAuthorizationUrl(
        userId,
        includeGbp,
      );
      return res.redirect(url);
    } catch {
      return res.redirect(
        `${frontendUrl}/settings/integrations?error=invalid_token`,
      );
    }
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3001';

    if (error) {
      return res.redirect(
        `${frontendUrl}/settings/integrations?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${frontendUrl}/settings/integrations?error=missing_params`,
      );
    }

    try {
      await this.googleOAuthService.handleCallback(code, state);
      return res.redirect(
        `${frontendUrl}/settings/integrations?success=true`,
      );
    } catch (err: any) {
      return res.redirect(
        `${frontendUrl}/settings/integrations?error=callback_failed`,
      );
    }
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status(@CurrentUser('id') userId: string) {
    const connection = await this.googleOAuthService.getConnection(userId);

    return {
      success: true,
      data: {
        connected: !!connection,
        connection,
      },
    };
  }

  @Post('select-properties')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async selectProperties(
    @CurrentUser('id') userId: string,
    @Body() body: { gaPropertyId?: string; gscSiteUrl?: string },
  ) {
    await this.googleOAuthService.selectProperties(
      userId,
      body.gaPropertyId || null,
      body.gscSiteUrl || null,
    );

    return {
      success: true,
      message: 'Properties updated',
    };
  }

  @Get('search-console-sites')
  @UseGuards(JwtAuthGuard)
  async searchConsoleSites(@CurrentUser('id') userId: string) {
    const sites =
      await this.googleOAuthService.listSearchConsoleSites(userId);

    return {
      success: true,
      data: sites,
    };
  }

  @Get('analytics-properties')
  @UseGuards(JwtAuthGuard)
  async analyticsProperties(@CurrentUser('id') userId: string) {
    const properties =
      await this.googleOAuthService.listAnalyticsProperties(userId);

    return {
      success: true,
      data: properties,
    };
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser('id') userId: string) {
    await this.googleOAuthService.disconnect(userId);

    return {
      success: true,
      message: 'Google account disconnected',
    };
  }

  // ─── GSC DATA ENDPOINTS (real Search Console data) ─────────

  /**
   * Is the user connected to Search Console with a selected site?
   * Cheap check — doesn't hit Google. Frontend uses it to decide
   * whether to show "Real GSC data" badges.
   */
  @Get('gsc/status')
  @UseGuards(JwtAuthGuard)
  async gscStatus(@CurrentUser('id') userId: string) {
    const connected = await this.gsc.isConnected(userId);
    let siteUrl: string | null = null;
    if (connected) {
      try {
        siteUrl = await this.gsc.getSiteUrl(userId);
      } catch {
        siteUrl = null;
      }
    }
    return { success: true, data: { connected, siteUrl } };
  }

  /**
   * Top performing queries from Search Console.
   * Used by Position Tracking + Organic Rankings to overlay real data.
   */
  @Get('gsc/queries')
  @UseGuards(JwtAuthGuard)
  async gscTopQueries(
    @CurrentUser('id') userId: string,
    @Query('days', new DefaultValuePipe(28), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('domain') domain?: string,
  ) {
    const data = await this.gsc.getTopQueries(userId, days, limit, domain);
    return { success: true, data };
  }

  /**
   * Top performing pages from Search Console.
   * Used by Top Pages module to overlay real click/impression data.
   */
  @Get('gsc/pages')
  @UseGuards(JwtAuthGuard)
  async gscTopPages(
    @CurrentUser('id') userId: string,
    @Query('days', new DefaultValuePipe(28), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('domain') domain?: string,
  ) {
    const data = await this.gsc.getTopPages(userId, days, limit, domain);
    return { success: true, data };
  }

  /**
   * Real GSC positions + impressions + clicks for a specific list of keywords.
   * Used by Position Tracking to overlay real metrics onto tracked keywords.
   * Accepts ?keywords=foo,bar,baz
   */
  @Get('gsc/keyword-positions')
  @UseGuards(JwtAuthGuard)
  async gscKeywordPositions(
    @CurrentUser('id') userId: string,
    @Query('keywords') keywordsCsv: string,
    @Query('days', new DefaultValuePipe(28), ParseIntPipe) days: number,
  ) {
    const keywords = (keywordsCsv || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywords.length === 0) {
      return { success: true, data: { rows: [] } };
    }
    const map = await this.gsc.getKeywordPositions(userId, keywords, days);
    // Return as plain object for JSON serialization
    const rows = Array.from(map.entries()).map(([key, row]) => ({
      keyword: key,
      ...row,
    }));
    return { success: true, data: { rows } };
  }

  // ─── GA4 DATA ENDPOINTS (real Google Analytics data) ───────

  /**
   * Whether Google Analytics is connected and a GA4 property matches the given
   * project domain. The frontend uses `matched`/`implemented` to show whether GA
   * is set up on the site (vs. "GA not detected on this domain").
   */
  @Get('ga/status')
  @UseGuards(JwtAuthGuard)
  async gaStatus(
    @CurrentUser('id') userId: string,
    @Query('domain') domain?: string,
  ) {
    const data = await this.ga.getStatus(userId, domain);
    return { success: true, data };
  }

  /** Headline traffic metrics + period-over-period change for a domain. */
  @Get('ga/overview')
  @UseGuards(JwtAuthGuard)
  async gaOverview(
    @CurrentUser('id') userId: string,
    @Query('domain') domain: string,
    @Query('days', new DefaultValuePipe(28), ParseIntPipe) days: number,
  ) {
    const data = await this.ga.getOverview(userId, domain, days);
    return { success: true, data };
  }

  /** Sessions/users broken down by default channel grouping. */
  @Get('ga/sources')
  @UseGuards(JwtAuthGuard)
  async gaSources(
    @CurrentUser('id') userId: string,
    @Query('domain') domain: string,
    @Query('days', new DefaultValuePipe(28), ParseIntPipe) days: number,
  ) {
    const data = await this.ga.getTrafficSources(userId, domain, days);
    return { success: true, data };
  }

  /** Most-viewed pages by pageviews. */
  @Get('ga/pages')
  @UseGuards(JwtAuthGuard)
  async gaPages(
    @CurrentUser('id') userId: string,
    @Query('domain') domain: string,
    @Query('days', new DefaultValuePipe(28), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    const data = await this.ga.getTopPages(userId, domain, days, limit);
    return { success: true, data };
  }

  /** Daily sessions/users for trend charts. */
  @Get('ga/timeseries')
  @UseGuards(JwtAuthGuard)
  async gaTimeseries(
    @CurrentUser('id') userId: string,
    @Query('domain') domain: string,
    @Query('days', new DefaultValuePipe(28), ParseIntPipe) days: number,
  ) {
    const data = await this.ga.getTimeseries(userId, domain, days);
    return { success: true, data };
  }
}
