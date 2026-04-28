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
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoogleOAuthService } from './google-oauth.service';

@Controller('google-oauth')
export class GoogleOAuthController {
  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
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
}
