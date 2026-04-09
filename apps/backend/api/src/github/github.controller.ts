import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { GitHubService } from './github.service';

@Controller()
export class GitHubController {
  constructor(
    private readonly githubService: GitHubService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * GET /github/authorize?projectId=...&token=...
   * Redirects user to GitHub OAuth authorization page.
   * Uses token from query param since this is a browser redirect (no Authorization header).
   */
  @Get('github/authorize')
  authorize(
    @Query('projectId') projectId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!projectId) {
      return res.status(400).json({ message: 'projectId query param is required' });
    }

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const userId = payload.sub;
    const url = this.githubService.getAuthorizationUrl(userId, projectId);
    return res.redirect(url);
  }

  /**
   * GET /github/callback
   * Public endpoint. GitHub redirects here after user authorizes.
   * Exchanges code for access token and redirects to frontend.
   */
  @Get('github/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');

    try {
      const result = await this.githubService.handleCallback(code, state);

      // Redirect to settings page with ghToken param (frontend reads this to load repos)
      return res.redirect(
        `${frontendUrl}/dashboard/projects/${result.projectId}/settings?ghToken=${result.accessToken}`,
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'GitHub authorization failed';

      return res.redirect(
        `${frontendUrl}/dashboard/github/error?message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  /**
   * GET /projects/:id/github/repos?accessToken=...
   * Lists repositories the user can access with the provided token.
   */
  @Get('projects/:id/github/repos')
  @UseGuards(JwtAuthGuard, ProjectOwnerGuard)
  async listRepos(@Query('accessToken') accessToken: string): Promise<any> {
    if (!accessToken) {
      return { success: false, message: 'accessToken query param is required', data: [] };
    }

    const repos = await this.githubService.listRepos(accessToken);
    return { success: true, data: repos };
  }

  /**
   * POST /projects/:id/github/connect
   * Connects a GitHub repository to the project.
   */
  @Post('projects/:id/github/connect')
  @UseGuards(JwtAuthGuard, ProjectOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async connectRepo(
    @Param('id') projectId: string,
    @Body() body: { accessToken: string; repoFullName: string },
  ) {
    if (!body.accessToken || !body.repoFullName) {
      return {
        success: false,
        message: 'accessToken and repoFullName are required',
      };
    }

    await this.githubService.connectRepo(
      projectId,
      body.accessToken,
      body.repoFullName,
    );

    return { success: true, message: 'Repository connected successfully' };
  }

  /**
   * GET /projects/:id/github/status
   * Returns the current GitHub connection status for a project.
   */
  @Get('projects/:id/github/status')
  @UseGuards(JwtAuthGuard, ProjectOwnerGuard)
  async getStatus(@Param('id') projectId: string) {
    const connection = await this.githubService.getConnection(projectId);
    return {
      success: !!connection,
      data: connection,
    };
  }

  /**
   * DELETE /projects/:id/github/disconnect
   * Disconnects the GitHub repository from the project.
   */
  @Delete('projects/:id/github/disconnect')
  @UseGuards(JwtAuthGuard, ProjectOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async disconnect(@Param('id') projectId: string) {
    await this.githubService.disconnect(projectId);
    return { success: true, message: 'GitHub repository disconnected' };
  }

  /**
   * POST /projects/:id/github/test-webhook
   * Simulates a push event for local testing (triggers re-crawl immediately).
   */
  @Post('projects/:id/github/test-webhook')
  @UseGuards(JwtAuthGuard, ProjectOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async testWebhook(@Param('id') projectId: string) {
    const data = await this.githubService.simulatePushWebhook(projectId);
    return { success: true, data };
  }

  /**
   * POST /projects/:id/github/redetect-deploy
   * Re-runs deploy platform detection (Vercel, Netlify, GitHub Pages).
   */
  @Post('projects/:id/github/redetect-deploy')
  @UseGuards(JwtAuthGuard, ProjectOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async redetectDeploy(@Param('id') projectId: string) {
    const data = await this.githubService.redetectDeployPlatform(projectId);
    return { success: true, data };
  }

  /**
   * POST /projects/:id/github/verify
   * Verifies the GitHub connection is still valid (token works, repo accessible).
   */
  @Post('projects/:id/github/verify')
  @UseGuards(JwtAuthGuard, ProjectOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async verifyConnection(@Param('id') projectId: string) {
    const data = await this.githubService.verifyConnection(projectId);
    return { success: true, data };
  }

  /**
   * POST /github/webhook
   * Public endpoint. Receives push/deployment events from GitHub.
   * Signature is verified against the per-repo webhook secret.
   */
  @Post('github/webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawBody = req.rawBody;

    if (!rawBody || !signature) {
      return { success: false, error: 'Missing body or signature' };
    }

    const data = await this.githubService.handleWebhook(rawBody, signature);
    return { success: true, data };
  }
}
