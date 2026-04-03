import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt } from '../common/utils/encryption';

interface GitHubRepo {
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  url: string;
  private: boolean;
}

interface CallbackResult {
  accessToken: string;
  userId: string;
  projectId: string;
}

interface RepoFileResult {
  content: string;
  sha: string;
  path: string;
}

interface CreateFixPROptions {
  branch: string;
  filePath: string;
  content: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly githubApiBase = 'https://api.github.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.clientId = this.config.getOrThrow<string>('GITHUB_CLIENT_ID');
    this.clientSecret = this.config.getOrThrow<string>('GITHUB_CLIENT_SECRET');
    this.redirectUri = this.config.getOrThrow<string>('GITHUB_REDIRECT_URI');
  }

  getAuthorizationUrl(userId: string, projectId: string): string {
    const state = `${userId}:${projectId}`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'repo',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<CallbackResult> {
    if (!code || !state) {
      throw new BadRequestException('Missing code or state parameter');
    }

    const parts = state.split(':');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid state parameter');
    }

    const [userId, projectId] = parts;

    try {
      const response = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );

      const { access_token, error, error_description } = response.data;

      if (error) {
        this.logger.error(`GitHub OAuth error: ${error} - ${error_description}`);
        throw new BadRequestException(
          `GitHub OAuth failed: ${error_description || error}`,
        );
      }

      if (!access_token) {
        throw new BadRequestException('No access token received from GitHub');
      }

      return {
        accessToken: access_token,
        userId,
        projectId,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('Failed to exchange GitHub OAuth code', err);
      throw new InternalServerErrorException(
        'Failed to exchange authorization code',
      );
    }
  }

  async listRepos(accessToken: string): Promise<GitHubRepo[]> {
    try {
      const response = await axios.get(
        `${this.githubApiBase}/user/repos?per_page=100&sort=updated`,
        {
          headers: this.getGitHubHeaders(accessToken),
        },
      );

      return response.data.map((repo: any) => ({
        fullName: repo.full_name,
        owner: repo.owner.login,
        name: repo.name,
        defaultBranch: repo.default_branch,
        url: repo.html_url,
        private: repo.private,
      }));
    } catch (err) {
      this.logger.error('Failed to list GitHub repos', err);
      throw new InternalServerErrorException('Failed to list repositories');
    }
  }

  async connectRepo(
    projectId: string,
    accessToken: string,
    repoFullName: string,
  ): Promise<void> {
    const [owner, name] = repoFullName.split('/');
    if (!owner || !name) {
      throw new BadRequestException('Invalid repository name format. Expected owner/repo');
    }

    let repoData: any;
    try {
      const response = await axios.get(
        `${this.githubApiBase}/repos/${owner}/${name}`,
        {
          headers: this.getGitHubHeaders(accessToken),
        },
      );
      repoData = response.data;
    } catch (err) {
      this.logger.error(`Failed to fetch repo details for ${repoFullName}`, err);
      throw new BadRequestException(
        `Could not access repository ${repoFullName}. Make sure you have access.`,
      );
    }

    const encryptedToken = encrypt(accessToken);

    await this.prisma.$transaction(async (tx) => {
      // Upsert the GitHub connection
      await tx.gitHubConnection.upsert({
        where: { projectId },
        create: {
          projectId,
          accessToken: encryptedToken,
          repoOwner: repoData.owner.login,
          repoName: repoData.name,
          repoFullName: repoData.full_name,
          defaultBranch: repoData.default_branch,
          repoUrl: repoData.html_url,
          isValid: true,
          lastVerifiedAt: new Date(),
        },
        update: {
          accessToken: encryptedToken,
          repoOwner: repoData.owner.login,
          repoName: repoData.name,
          repoFullName: repoData.full_name,
          defaultBranch: repoData.default_branch,
          repoUrl: repoData.html_url,
          isValid: true,
          lastVerifiedAt: new Date(),
        },
      });

      // Update project source type
      await tx.project.update({
        where: { id: projectId },
        data: { sourceType: 'GITHUB' },
      });
    });
  }

  async getConnection(projectId: string) {
    const connection = await this.prisma.gitHubConnection.findUnique({
      where: { projectId },
    });

    if (!connection) {
      return null;
    }

    // Return without raw tokens
    const { accessToken, webhookSecret, ...safeConnection } = connection;
    return {
      ...safeConnection,
      hasAccessToken: !!accessToken,
      hasWebhookSecret: !!webhookSecret,
    };
  }

  async disconnect(projectId: string): Promise<void> {
    const connection = await this.prisma.gitHubConnection.findUnique({
      where: { projectId },
    });

    if (!connection) {
      throw new NotFoundException('No GitHub connection found for this project');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.gitHubConnection.delete({
        where: { projectId },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { sourceType: 'MANUAL' },
      });
    });
  }

  async getRepoFile(
    projectId: string,
    filePath: string,
  ): Promise<RepoFileResult> {
    const connection = await this.getValidConnection(projectId);
    const token = decrypt(connection.accessToken);

    try {
      const response = await axios.get(
        `${this.githubApiBase}/repos/${connection.repoOwner}/${connection.repoName}/contents/${filePath}`,
        {
          headers: this.getGitHubHeaders(token),
        },
      );

      const data = response.data;

      if (data.type !== 'file') {
        throw new BadRequestException(`Path "${filePath}" is not a file`);
      }

      const content = Buffer.from(data.content, 'base64').toString('utf-8');

      return {
        content,
        sha: data.sha,
        path: data.path,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Failed to get file ${filePath} from repo`, err);
      throw new NotFoundException(`File not found: ${filePath}`);
    }
  }

  async createFixPR(
    projectId: string,
    options: CreateFixPROptions,
  ): Promise<string> {
    const connection = await this.getValidConnection(projectId);
    const token = decrypt(connection.accessToken);
    const headers = this.getGitHubHeaders(token);
    const { repoOwner, repoName, defaultBranch } = connection;
    const repoBase = `${this.githubApiBase}/repos/${repoOwner}/${repoName}`;

    // Step 1: Get default branch ref
    const refResponse = await axios.get(
      `${repoBase}/git/ref/heads/${defaultBranch}`,
      { headers },
    );
    const baseSha = refResponse.data.object.sha;

    // Step 2: Create new branch
    await axios.post(
      `${repoBase}/git/refs`,
      {
        ref: `refs/heads/${options.branch}`,
        sha: baseSha,
      },
      { headers },
    );

    // Step 3: Get existing file SHA (if file exists)
    let existingFileSha: string | undefined;
    try {
      const fileResponse = await axios.get(
        `${repoBase}/contents/${options.filePath}?ref=${options.branch}`,
        { headers },
      );
      existingFileSha = fileResponse.data.sha;
    } catch {
      // File does not exist yet, that's fine
    }

    // Step 4: Update/create file
    const contentBase64 = Buffer.from(options.content, 'utf-8').toString('base64');
    await axios.put(
      `${repoBase}/contents/${options.filePath}`,
      {
        message: options.commitMessage,
        content: contentBase64,
        branch: options.branch,
        ...(existingFileSha ? { sha: existingFileSha } : {}),
      },
      { headers },
    );

    // Step 5: Create pull request
    const prResponse = await axios.post(
      `${repoBase}/pulls`,
      {
        title: options.prTitle,
        body: options.prBody,
        head: options.branch,
        base: defaultBranch,
      },
      { headers },
    );

    return prResponse.data.html_url;
  }

  // ---- Private helpers ----

  private async getValidConnection(projectId: string) {
    const connection = await this.prisma.gitHubConnection.findUnique({
      where: { projectId },
    });

    if (!connection) {
      throw new NotFoundException('No GitHub connection found for this project');
    }

    if (!connection.isValid) {
      throw new BadRequestException(
        'GitHub connection is no longer valid. Please reconnect.',
      );
    }

    return connection;
  }

  private getGitHubHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }
}
