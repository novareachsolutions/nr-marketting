import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt } from '../common/utils/encryption';

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.clientId = this.config.get<string>('GOOGLE_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET', '');
    this.redirectUri = this.config.get<string>(
      'GOOGLE_REDIRECT_URI',
      'http://localhost:3000/api/google-oauth/callback',
    );
  }

  getAuthorizationUrl(userId: string, includeGbp = false): string {
    const scopes = [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly',
    ];
    if (includeGbp) {
      scopes.push('https://www.googleapis.com/auth/business.manage');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: userId,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ userId: string }> {
    const userId = state;

    // Exchange code for tokens
    let tokenResponse: any;
    try {
      const { data } = await axios.post(
        'https://oauth2.googleapis.com/token',
        {
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        },
      );
      tokenResponse = data;
    } catch (error: any) {
      this.logger.error(
        'Failed to exchange code for tokens',
        error?.response?.data || error.message,
      );
      throw new InternalServerErrorException(
        'Failed to exchange authorization code',
      );
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      scope,
    } = tokenResponse;

    if (!refresh_token) {
      this.logger.warn('No refresh token received from Google');
    }

    const tokenExpiry = new Date(Date.now() + expires_in * 1000);
    const encryptedRefreshToken = refresh_token
      ? encrypt(refresh_token)
      : '';
    const encryptedAccessToken = encrypt(access_token);

    await this.prisma.googleConnection.upsert({
      where: { userId },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry,
        scope: scope || '',
        updatedAt: new Date(),
      },
      create: {
        userId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry,
        scope: scope || '',
      },
    });

    return { userId };
  }

  async refreshAccessToken(userId: string): Promise<string> {
    const connection = await this.prisma.googleConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      throw new NotFoundException('Google connection not found');
    }

    // If token is still valid (with 60s buffer), return decrypted access token
    if (connection.tokenExpiry > new Date(Date.now() + 60_000)) {
      return decrypt(connection.accessToken);
    }

    // Token expired — refresh it
    const refreshToken = decrypt(connection.refreshToken);

    let tokenResponse: any;
    try {
      const { data } = await axios.post(
        'https://oauth2.googleapis.com/token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        },
      );
      tokenResponse = data;
    } catch (error: any) {
      this.logger.error(
        'Failed to refresh access token',
        error?.response?.data || error.message,
      );
      throw new InternalServerErrorException(
        'Failed to refresh Google access token',
      );
    }

    const { access_token, expires_in } = tokenResponse;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    await this.prisma.googleConnection.update({
      where: { userId },
      data: {
        accessToken: encrypt(access_token),
        tokenExpiry,
      },
    });

    return access_token;
  }

  async getConnection(userId: string) {
    const connection = await this.prisma.googleConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      return null;
    }

    return {
      id: connection.id,
      userId: connection.userId,
      scope: connection.scope,
      gaPropertyId: connection.gaPropertyId,
      gscSiteUrl: connection.gscSiteUrl,
      connectedAt: connection.connectedAt,
      updatedAt: connection.updatedAt,
      tokenExpiry: connection.tokenExpiry,
    };
  }

  async disconnect(userId: string): Promise<void> {
    const connection = await this.prisma.googleConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      throw new NotFoundException('Google connection not found');
    }

    // Revoke the token at Google
    try {
      const accessToken = decrypt(connection.accessToken);
      await axios.post(
        `https://oauth2.googleapis.com/revoke?token=${accessToken}`,
      );
    } catch (error: any) {
      this.logger.warn(
        'Failed to revoke token at Google (continuing with disconnect)',
        error?.response?.data || error.message,
      );
    }

    await this.prisma.googleConnection.delete({
      where: { userId },
    });
  }

  async listSearchConsoleSites(
    userId: string,
  ): Promise<Array<{ siteUrl: string; permissionLevel: string }>> {
    const accessToken = await this.refreshAccessToken(userId);

    try {
      const { data } = await axios.get(
        'https://www.googleapis.com/webmasters/v3/sites',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      return (data.siteEntry || []).map((entry: any) => ({
        siteUrl: entry.siteUrl,
        permissionLevel: entry.permissionLevel,
      }));
    } catch (error: any) {
      this.logger.error(
        'Failed to list Search Console sites',
        error?.response?.data || error.message,
      );
      throw new InternalServerErrorException(
        'Failed to list Search Console sites',
      );
    }
  }

  async listAnalyticsProperties(
    userId: string,
  ): Promise<Array<{ name: string; displayName: string; propertyId: string }>> {
    const accessToken = await this.refreshAccessToken(userId);

    try {
      const { data } = await axios.get(
        'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const properties: Array<{
        name: string;
        displayName: string;
        propertyId: string;
      }> = [];

      for (const account of data.accountSummaries || []) {
        for (const prop of account.propertySummaries || []) {
          properties.push({
            name: prop.property,
            displayName: prop.displayName,
            propertyId: prop.property.replace('properties/', ''),
          });
        }
      }

      return properties;
    } catch (error: any) {
      this.logger.error(
        'Failed to list Analytics properties',
        error?.response?.data || error.message,
      );
      throw new InternalServerErrorException(
        'Failed to list Google Analytics properties',
      );
    }
  }

  async selectProperties(
    userId: string,
    gaPropertyId: string | null,
    gscSiteUrl: string | null,
  ): Promise<void> {
    const connection = await this.prisma.googleConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      throw new NotFoundException('Google connection not found');
    }

    await this.prisma.googleConnection.update({
      where: { userId },
      data: {
        gaPropertyId,
        gscSiteUrl,
      },
    });
  }
}
