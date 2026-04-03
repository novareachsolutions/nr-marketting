import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt } from '../common/utils/encryption';
import { ConnectWordPressDto } from './dto/connect-wordpress.dto';

@Injectable()
export class WordPressService {
  private readonly logger = new Logger(WordPressService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Connect a WordPress site to a project.
   */
  async connect(projectId: string, dto: ConnectWordPressDto) {
    const siteUrl = dto.siteUrl.replace(/\/+$/, '');

    // Verify credentials by fetching posts
    const authHeader = this.buildBasicAuth(dto.username, dto.appPassword ?? '');

    try {
      await axios.get(`${siteUrl}/wp-json/wp/v2/posts?per_page=1`, {
        headers: { Authorization: authHeader },
        timeout: 15000,
      });
    } catch (error) {
      this.logger.warn(
        `WordPress connection failed for ${siteUrl}: ${(error as any).message}`,
      );
      throw new BadRequestException(
        'Could not connect to WordPress. Verify the site URL and credentials.',
      );
    }

    // Detect WP version
    let wpVersion: string | null = null;
    try {
      const infoRes = await axios.get(`${siteUrl}/wp-json`, {
        headers: { Authorization: authHeader },
        timeout: 10000,
      });
      wpVersion = infoRes.data?.description
        ? null
        : null;
      if (infoRes.data?.namespaces) {
        // WP REST API root often has no direct version field; check generator
      }
      // A more reliable approach: look at the response header or generator tag
      wpVersion = infoRes.data?.gmt_offset !== undefined
        ? (infoRes.headers?.['x-wp-version'] ?? null)
        : null;
      // Fallback: parse from the site description or namespaces
      if (!wpVersion && infoRes.data?.namespaces?.includes('wp/v2')) {
        wpVersion = infoRes.data?.version ?? null;
      }
    } catch {
      // Non-critical, continue without version
    }

    // Detect SEO plugin
    const seoPlugin = await this.detectSeoPlugin(siteUrl, authHeader);

    // Detect capabilities
    let capabilities: Record<string, boolean> = {};
    try {
      const typesRes = await axios.get(`${siteUrl}/wp-json/wp/v2/types`, {
        headers: { Authorization: authHeader },
        timeout: 10000,
      });
      capabilities = {
        hasPosts: !!typesRes.data?.post,
        hasPages: !!typesRes.data?.page,
      };
    } catch {
      // Non-critical
    }

    // Encrypt credentials
    const encryptedUsername = encrypt(dto.username);
    const encryptedAppPassword = dto.appPassword
      ? encrypt(dto.appPassword)
      : null;
    const encryptedPluginApiKey = dto.pluginApiKey
      ? encrypt(dto.pluginApiKey)
      : null;

    // Upsert the connection
    const connection = await this.prisma.wordPressConnection.upsert({
      where: { projectId },
      create: {
        projectId,
        siteUrl,
        username: encryptedUsername,
        appPassword: encryptedAppPassword,
        pluginApiKey: encryptedPluginApiKey,
        authMethod: dto.authMethod as any,
        isValid: true,
        wpVersion,
        seoPlugin: seoPlugin as any,
        capabilities,
        lastVerifiedAt: new Date(),
      },
      update: {
        siteUrl,
        username: encryptedUsername,
        appPassword: encryptedAppPassword,
        pluginApiKey: encryptedPluginApiKey,
        authMethod: dto.authMethod as any,
        isValid: true,
        wpVersion,
        seoPlugin: seoPlugin as any,
        capabilities,
        lastVerifiedAt: new Date(),
      },
    });

    // Update project sourceType to WORDPRESS
    await this.prisma.project.update({
      where: { id: projectId },
      data: { sourceType: 'WORDPRESS' },
    });

    return {
      id: connection.id,
      projectId: connection.projectId,
      siteUrl: connection.siteUrl,
      authMethod: connection.authMethod,
      isValid: connection.isValid,
      wpVersion: connection.wpVersion,
      seoPlugin: connection.seoPlugin,
      capabilities: connection.capabilities,
      lastVerifiedAt: connection.lastVerifiedAt,
      connectedAt: connection.connectedAt,
    };
  }

  /**
   * Get connection info (without raw credentials).
   */
  async getConnection(projectId: string) {
    const connection = await this.prisma.wordPressConnection.findUnique({
      where: { projectId },
    });

    if (!connection) {
      throw new NotFoundException(
        'No WordPress connection found for this project',
      );
    }

    return {
      id: connection.id,
      projectId: connection.projectId,
      siteUrl: connection.siteUrl,
      authMethod: connection.authMethod,
      isValid: connection.isValid,
      wpVersion: connection.wpVersion,
      seoPlugin: connection.seoPlugin,
      capabilities: connection.capabilities,
      lastVerifiedAt: connection.lastVerifiedAt,
      connectedAt: connection.connectedAt,
    };
  }

  /**
   * Disconnect WordPress from a project.
   */
  async disconnect(projectId: string) {
    const connection = await this.prisma.wordPressConnection.findUnique({
      where: { projectId },
    });

    if (!connection) {
      throw new NotFoundException(
        'No WordPress connection found for this project',
      );
    }

    await this.prisma.wordPressConnection.delete({
      where: { projectId },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { sourceType: 'MANUAL' },
    });

    return { message: 'WordPress disconnected successfully' };
  }

  /**
   * Re-verify WordPress credentials.
   */
  async verifyConnection(projectId: string) {
    const connection = await this.prisma.wordPressConnection.findUnique({
      where: { projectId },
    });

    if (!connection) {
      throw new NotFoundException(
        'No WordPress connection found for this project',
      );
    }

    const authHeader = await this.getAuthHeaders(projectId);
    let isValid = false;

    try {
      await axios.get(
        `${connection.siteUrl}/wp-json/wp/v2/posts?per_page=1`,
        {
          headers: { Authorization: authHeader },
          timeout: 15000,
        },
      );
      isValid = true;
    } catch {
      isValid = false;
    }

    await this.prisma.wordPressConnection.update({
      where: { projectId },
      data: {
        isValid,
        lastVerifiedAt: new Date(),
      },
    });

    return { isValid, lastVerifiedAt: new Date() };
  }

  /**
   * Find a WordPress page/post by URL slug.
   */
  async getPageBySlug(projectId: string, slug: string) {
    const connection = await this.prisma.wordPressConnection.findUnique({
      where: { projectId },
    });

    if (!connection) {
      throw new NotFoundException('No WordPress connection found');
    }

    const authHeader = await this.getAuthHeaders(projectId);

    // Try posts first
    try {
      const postsRes = await axios.get(
        `${connection.siteUrl}/wp-json/wp/v2/posts`,
        {
          params: { slug, _fields: 'id,title,content,slug,meta,status,type' },
          headers: { Authorization: authHeader },
          timeout: 10000,
        },
      );

      if (postsRes.data?.length > 0) {
        return postsRes.data[0];
      }
    } catch {
      // Continue to try pages
    }

    // Try pages
    try {
      const pagesRes = await axios.get(
        `${connection.siteUrl}/wp-json/wp/v2/pages`,
        {
          params: { slug, _fields: 'id,title,content,slug,meta,status,type' },
          headers: { Authorization: authHeader },
          timeout: 10000,
        },
      );

      if (pagesRes.data?.length > 0) {
        return pagesRes.data[0];
      }
    } catch {
      // No page found
    }

    throw new NotFoundException(
      `No WordPress page or post found with slug: ${slug}`,
    );
  }

  /**
   * Update page/post meta (title, meta description, content) via WP REST API.
   */
  async updatePageMeta(
    projectId: string,
    pageId: number,
    meta: { title?: string; metaDescription?: string; content?: string },
  ) {
    const connection = await this.prisma.wordPressConnection.findUnique({
      where: { projectId },
    });

    if (!connection) {
      throw new NotFoundException('No WordPress connection found');
    }

    const authHeader = await this.getAuthHeaders(projectId);

    // Build the update payload
    const payload: Record<string, any> = {};

    if (meta.title !== undefined) {
      payload.title = meta.title;
    }

    if (meta.content !== undefined) {
      payload.content = meta.content;
    }

    // Build SEO meta fields based on detected SEO plugin
    const metaFields: Record<string, string> = {};

    if (meta.metaDescription !== undefined || meta.title !== undefined) {
      switch (connection.seoPlugin) {
        case 'YOAST':
          if (meta.title) metaFields['_yoast_wpseo_title'] = meta.title;
          if (meta.metaDescription)
            metaFields['_yoast_wpseo_metadesc'] = meta.metaDescription;
          break;
        case 'RANKMATH':
          if (meta.title) metaFields['rank_math_title'] = meta.title;
          if (meta.metaDescription)
            metaFields['rank_math_description'] = meta.metaDescription;
          break;
        case 'AIOSEO':
          if (meta.title) metaFields['_aioseo_title'] = meta.title;
          if (meta.metaDescription)
            metaFields['_aioseo_description'] = meta.metaDescription;
          break;
        default:
          // No SEO plugin — just update the WP title directly
          break;
      }
    }

    if (Object.keys(metaFields).length > 0) {
      payload.meta = metaFields;
    }

    // Try posts endpoint first, then pages
    const endpoints = [
      `${connection.siteUrl}/wp-json/wp/v2/posts/${pageId}`,
      `${connection.siteUrl}/wp-json/wp/v2/pages/${pageId}`,
    ];

    let lastError: any = null;

    for (const endpoint of endpoints) {
      try {
        const response = await axios.post(endpoint, payload, {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        });
        return response.data;
      } catch (error: any) {
        lastError = error;
        // If we get a 404, try the next endpoint
        if (error.response?.status === 404) {
          continue;
        }
        // For other errors, throw immediately
        throw new BadRequestException(
          `Failed to update WordPress page: ${error.message}`,
        );
      }
    }

    throw new BadRequestException(
      `Failed to update WordPress page: ${(lastError as any)?.message ?? 'Unknown error'}`,
    );
  }

  /**
   * Decrypt credentials and build a Basic auth header.
   */
  async getAuthHeaders(projectId: string): Promise<string> {
    const connection = await this.prisma.wordPressConnection.findUnique({
      where: { projectId },
    });

    if (!connection) {
      throw new NotFoundException('No WordPress connection found');
    }

    const username = decrypt(connection.username);
    const appPassword = connection.appPassword
      ? decrypt(connection.appPassword)
      : '';

    return `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`;
  }

  /**
   * Detect which SEO plugin is active on the WordPress site.
   */
  private async detectSeoPlugin(
    siteUrl: string,
    authHeader: string,
  ): Promise<string> {
    // Check Yoast SEO
    try {
      await axios.get(`${siteUrl}/wp-json/yoast/v1/get_head?url=${siteUrl}`, {
        headers: { Authorization: authHeader },
        timeout: 8000,
      });
      return 'YOAST';
    } catch {
      // Not Yoast
    }

    // Check RankMath
    try {
      await axios.get(`${siteUrl}/wp-json/rankmath/v1/getHead?url=${siteUrl}`, {
        headers: { Authorization: authHeader },
        timeout: 8000,
      });
      return 'RANKMATH';
    } catch {
      // Not RankMath
    }

    // Check AIOSEO
    try {
      await axios.get(`${siteUrl}/wp-json/aioseo/v1/ping`, {
        headers: { Authorization: authHeader },
        timeout: 8000,
      });
      return 'AIOSEO';
    } catch {
      // Not AIOSEO
    }

    return 'NONE';
  }

  /**
   * Build a Basic auth string from raw credentials (not encrypted).
   */
  private buildBasicAuth(username: string, password: string): string {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }
}
