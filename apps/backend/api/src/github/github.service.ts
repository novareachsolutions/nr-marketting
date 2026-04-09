import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHmac, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SiteAuditService } from '../site-audit/site-audit.service';
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
  private readonly apiBaseUrl: string;
  private readonly githubApiBase = 'https://api.github.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly siteAuditService: SiteAuditService,
  ) {
    this.clientId = this.config.getOrThrow<string>('GITHUB_CLIENT_ID');
    this.clientSecret = this.config.getOrThrow<string>('GITHUB_CLIENT_SECRET');
    this.redirectUri = this.config.getOrThrow<string>('GITHUB_REDIRECT_URI');
    this.apiBaseUrl = this.config.get<string>('API_BASE_URL', 'http://localhost:3000/api');
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

    // Detect deploy platform from repo contents
    const { deployUrl, deployPlatform } = await this.detectDeployPlatform(
      accessToken,
      owner,
      name,
      repoData.default_branch,
    );

    // Create webhook for push events
    const { webhookId, webhookSecret } = await this.createRepoWebhook(
      accessToken,
      owner,
      name,
    );

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
          deployUrl,
          deployPlatform,
          webhookId,
          webhookSecret: webhookSecret ? encrypt(webhookSecret) : null,
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
          deployUrl,
          deployPlatform,
          webhookId,
          webhookSecret: webhookSecret ? encrypt(webhookSecret) : null,
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

    // Remove webhook from GitHub
    if (connection.webhookId) {
      try {
        const token = decrypt(connection.accessToken);
        await axios.delete(
          `${this.githubApiBase}/repos/${connection.repoOwner}/${connection.repoName}/hooks/${connection.webhookId}`,
          { headers: this.getGitHubHeaders(token) },
        );
      } catch (err) {
        this.logger.warn(`Failed to delete GitHub webhook ${connection.webhookId}`, err);
      }
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

  /**
   * List all files in the repo (recursive tree).
   */
  async getRepoTree(projectId: string): Promise<string[]> {
    const connection = await this.getValidConnection(projectId);
    const token = decrypt(connection.accessToken);

    try {
      const response = await axios.get(
        `${this.githubApiBase}/repos/${connection.repoOwner}/${connection.repoName}/git/trees/${connection.defaultBranch}?recursive=1`,
        { headers: this.getGitHubHeaders(token) },
      );

      return response.data.tree
        .filter((item: any) => item.type === 'blob')
        .map((item: any) => item.path);
    } catch (err) {
      this.logger.error('Failed to get repo tree', err);
      return [];
    }
  }

  // ─── Test / Dev Helpers ─────────────────────────────────

  /**
   * Simulate a GitHub push webhook for local testing (no ngrok needed).
   * Triggers the same re-crawl logic as a real webhook would.
   */
  async simulatePushWebhook(
    projectId: string,
  ): Promise<{ action: string; message: string }> {
    const connection = await this.getValidConnection(projectId);

    this.logger.log(
      `[TEST] Simulating push to ${connection.defaultBranch} on ${connection.repoFullName}`,
    );

    // Trigger re-crawl immediately (skip 2-min delay for testing)
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    try {
      await this.siteAuditService.startCrawl(projectId, project.userId, 'free');
      return {
        action: 'recrawl_triggered',
        message: `Deploy simulation: re-crawl triggered for ${connection.repoFullName} (${connection.defaultBranch})`,
      };
    } catch (err: any) {
      return {
        action: 'recrawl_skipped',
        message: err?.message || 'Could not start crawl (one may already be running)',
      };
    }
  }

  /**
   * Re-run deploy platform detection for an existing connection.
   */
  async redetectDeployPlatform(projectId: string) {
    const connection = await this.getValidConnection(projectId);
    const token = decrypt(connection.accessToken);

    const { deployUrl, deployPlatform } = await this.detectDeployPlatform(
      token,
      connection.repoOwner,
      connection.repoName,
      connection.defaultBranch,
    );

    await this.prisma.gitHubConnection.update({
      where: { projectId },
      data: { deployUrl, deployPlatform },
    });

    return { deployUrl, deployPlatform };
  }

  /**
   * Verify the GitHub connection is still valid by making an API call.
   */
  async verifyConnection(projectId: string) {
    const connection = await this.getValidConnection(projectId);
    const token = decrypt(connection.accessToken);

    try {
      const response = await axios.get(
        `${this.githubApiBase}/repos/${connection.repoOwner}/${connection.repoName}`,
        { headers: this.getGitHubHeaders(token) },
      );

      await this.prisma.gitHubConnection.update({
        where: { projectId },
        data: {
          isValid: true,
          lastVerifiedAt: new Date(),
          defaultBranch: response.data.default_branch,
        },
      });

      return {
        isValid: true,
        repoFullName: connection.repoFullName,
        defaultBranch: response.data.default_branch,
        lastVerifiedAt: new Date().toISOString(),
      };
    } catch {
      await this.prisma.gitHubConnection.update({
        where: { projectId },
        data: { isValid: false },
      });

      return {
        isValid: false,
        repoFullName: connection.repoFullName,
        error: 'Token may have been revoked or repo is no longer accessible',
      };
    }
  }

  // ─── Webhook Handling ─────────────────────────────────

  async handleWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: boolean; action?: string }> {
    const payload = JSON.parse(rawBody.toString('utf-8'));

    // Determine repo from payload
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
      throw new BadRequestException('Missing repository in webhook payload');
    }

    // Find the connection for this repo
    const connection = await this.prisma.gitHubConnection.findFirst({
      where: { repoFullName, isValid: true },
    });

    if (!connection || !connection.webhookSecret) {
      throw new BadRequestException('No matching connection for this webhook');
    }

    // Verify signature
    const secret = decrypt(connection.webhookSecret);
    const expectedSignature =
      'sha256=' +
      createHmac('sha256', secret).update(rawBody).digest('hex');

    if (signature !== expectedSignature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Handle push to default branch → trigger re-crawl
    const ref = payload.ref;
    const defaultBranchRef = `refs/heads/${connection.defaultBranch}`;

    if (ref === defaultBranchRef) {
      this.logger.log(
        `Deploy detected: push to ${connection.defaultBranch} on ${repoFullName}`,
      );

      // Wait 2 minutes for deploy to propagate, then trigger re-crawl
      const projectId = connection.projectId;
      setTimeout(async () => {
        try {
          // Find the project owner to pass as userId
          const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { userId: true },
          });

          if (project) {
            await this.siteAuditService.startCrawl(
              projectId,
              project.userId,
              'free',
            );
            this.logger.log(`Auto re-crawl triggered for project ${projectId}`);
          }
        } catch (err) {
          this.logger.error(`Failed to auto re-crawl project ${projectId}`, err);
        }
      }, 2 * 60 * 1000);

      return { received: true, action: 'recrawl_scheduled' };
    }

    return { received: true };
  }

  // ---- Private helpers ----

  private async createRepoWebhook(
    accessToken: string,
    owner: string,
    name: string,
  ): Promise<{ webhookId: string | null; webhookSecret: string | null }> {
    try {
      const webhookSecret = randomBytes(32).toString('hex');
      const response = await axios.post(
        `${this.githubApiBase}/repos/${owner}/${name}/hooks`,
        {
          name: 'web',
          active: true,
          events: ['push', 'deployment_status'],
          config: {
            url: `${this.apiBaseUrl}/github/webhook`,
            content_type: 'json',
            secret: webhookSecret,
            insecure_ssl: '0',
          },
        },
        { headers: this.getGitHubHeaders(accessToken) },
      );

      return {
        webhookId: String(response.data.id),
        webhookSecret,
      };
    } catch (err) {
      this.logger.warn('Failed to create GitHub webhook — deploy detection will be unavailable', err);
      return { webhookId: null, webhookSecret: null };
    }
  }

  private async detectDeployPlatform(
    accessToken: string,
    owner: string,
    name: string,
    defaultBranch: string,
  ): Promise<{ deployUrl: string | null; deployPlatform: any }> {
    const headers = this.getGitHubHeaders(accessToken);
    const repoBase = `${this.githubApiBase}/repos/${owner}/${name}`;

    // Check for Vercel (vercel.json)
    try {
      await axios.get(`${repoBase}/contents/vercel.json?ref=${defaultBranch}`, { headers });
      return {
        deployUrl: `https://${name}.vercel.app`,
        deployPlatform: 'VERCEL',
      };
    } catch {}

    // Check for Netlify (netlify.toml)
    try {
      await axios.get(`${repoBase}/contents/netlify.toml?ref=${defaultBranch}`, { headers });
      return {
        deployUrl: `https://${name}.netlify.app`,
        deployPlatform: 'NETLIFY',
      };
    } catch {}

    // Check for GitHub Pages (CNAME file)
    try {
      const cnameRes = await axios.get(
        `${repoBase}/contents/CNAME?ref=${defaultBranch}`,
        { headers },
      );
      const cname = Buffer.from(cnameRes.data.content, 'base64').toString('utf-8').trim();
      if (cname) {
        return {
          deployUrl: `https://${cname}`,
          deployPlatform: 'GITHUB_PAGES',
        };
      }
    } catch {}

    // Check GitHub Pages via repo settings
    try {
      const pagesRes = await axios.get(`${repoBase}/pages`, { headers });
      if (pagesRes.data?.html_url) {
        return {
          deployUrl: pagesRes.data.html_url,
          deployPlatform: 'GITHUB_PAGES',
        };
      }
    } catch {}

    return { deployUrl: null, deployPlatform: null };
  }

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
