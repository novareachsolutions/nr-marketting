import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GitHubService } from './github.service';

@Controller()
export class GitHubController {
  constructor(
    private readonly githubService: GitHubService,
    private readonly config: ConfigService,
  ) {}

  /**
   * GET /github/authorize?projectId=...
   * Redirects user to GitHub OAuth authorization page.
   */
  @Get('github/authorize')
  @UseGuards(JwtAuthGuard)
  authorize(
    @CurrentUser('id') userId: string,
    @Query('projectId') projectId: string,
    @Res() res: Response,
  ) {
    if (!projectId) {
      return res.status(400).json({ message: 'projectId query param is required' });
    }

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

      // Redirect to frontend with token and project context
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        projectId: result.projectId,
      });

      return res.redirect(
        `${frontendUrl}/dashboard/projects/${result.projectId}/github/connect?${params.toString()}`,
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
      return { message: 'accessToken query param is required', repos: [] };
    }

    const repos = await this.githubService.listRepos(accessToken);
    return { repos };
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
      connected: !!connection,
      connection,
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
}
