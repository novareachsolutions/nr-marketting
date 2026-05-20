import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleOAuthService } from './google-oauth.service';

const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';

export interface GscQueryRow {
  query: string;
  page?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSearchAnalyticsResponse {
  rows: GscQueryRow[];
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
}

@Injectable()
export class GscApiService {
  private readonly logger = new Logger(GscApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: GoogleOAuthService,
  ) {}

  /**
   * Returns true if the user has an active Google connection with the
   * webmasters scope granted. Does NOT require the user to have manually
   * selected a site — the app auto-matches per project domain.
   */
  async isConnected(userId: string): Promise<boolean> {
    const connection = await this.prisma.googleConnection.findUnique({
      where: { userId },
      select: { scope: true },
    });
    if (!connection) return false;
    return (connection.scope || '').includes('webmasters');
  }

  /**
   * Normalize a domain or GSC siteUrl down to bare comparable form.
   * "sc-domain:example.com" → "example.com"
   * "https://www.example.com/" → "example.com"
   * "http://example.com" → "example.com"
   */
  private normalizeDomain(s: string): string {
    return s
      .toLowerCase()
      .trim()
      .replace(/^sc-domain:/, '')
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .replace(/\/+$/, '');
  }

  /**
   * Find the GSC property that matches a given project domain.
   * Returns the GSC siteUrl string to use in API calls, or null if no match.
   * Prefers domain-property (sc-domain:) matches over URL-prefix matches.
   */
  async findSiteForDomain(
    userId: string,
    projectDomain: string,
  ): Promise<string | null> {
    const target = this.normalizeDomain(projectDomain);
    if (!target) return null;

    let sites: Array<{ siteUrl: string; permissionLevel: string }>;
    try {
      sites = await this.oauth.listSearchConsoleSites(userId);
    } catch (err) {
      this.logger.warn(`Failed to list GSC sites for auto-match: ${err}`);
      return null;
    }

    // Only consider properties the account can actually query.
    // siteUnverifiedUser cannot pull search analytics data — skip it.
    const queryable = (s: { permissionLevel: string }) =>
      ['siteOwner', 'siteFullUser', 'siteRestrictedUser'].includes(
        s.permissionLevel,
      );

    // Prefer domain-property (sc-domain:) since it covers all subdomains
    const domainProp = sites.find(
      (s) =>
        queryable(s) &&
        s.siteUrl.startsWith('sc-domain:') &&
        this.normalizeDomain(s.siteUrl) === target,
    );
    if (domainProp) return domainProp.siteUrl;

    // Fall back to URL-prefix match
    const urlProp = sites.find(
      (s) => queryable(s) && this.normalizeDomain(s.siteUrl) === target,
    );
    if (urlProp) return urlProp.siteUrl;

    // A matching property exists but the account can't query it (unverified).
    // Log it once so it's clear why no GSC data shows.
    const unverified = sites.find(
      (s) => this.normalizeDomain(s.siteUrl) === target,
    );
    if (unverified) {
      this.logger.warn(
        `GSC property "${unverified.siteUrl}" matches "${projectDomain}" but permission is "${unverified.permissionLevel}" — cannot query. Verify ownership in Search Console.`,
      );
    }

    return null;
  }

  /**
   * Resolve which GSC site to use for queries. Order of preference:
   *   1. Auto-match against the supplied project domain
   *   2. The user's manually-selected `gscSiteUrl` (legacy fallback)
   * Returns null if no match is found.
   */
  async resolveSiteUrl(
    userId: string,
    projectDomain?: string,
  ): Promise<string | null> {
    if (projectDomain) {
      const matched = await this.findSiteForDomain(userId, projectDomain);
      if (matched) return matched;
    }
    const connection = await this.prisma.googleConnection.findUnique({
      where: { userId },
      select: { gscSiteUrl: true },
    });
    return connection?.gscSiteUrl || null;
  }

  /**
   * Get the user's stored GSC site URL (legacy — kept for the integration
   * page UI). Returns null if no site was manually selected.
   */
  async getSiteUrl(userId: string): Promise<string> {
    const connection = await this.prisma.googleConnection.findUnique({
      where: { userId },
      select: { gscSiteUrl: true },
    });
    if (!connection?.gscSiteUrl) {
      throw new NotFoundException('No Search Console site selected for this user');
    }
    return connection.gscSiteUrl;
  }

  /**
   * Query GSC search analytics for top performing keywords.
   * dimensions=['query'] aggregates by search query.
   *
   * @param userId - the platform user
   * @param days - how many days back to query (GSC supports 1-490 days, but recent data lags 2-3 days)
   * @param limit - how many rows to return (max 25000 per GSC docs)
   * @param siteUrlOverride - override the user's default GSC site (e.g. for project-specific queries)
   */
  async getTopQueries(
    userId: string,
    days: number = 28,
    limit: number = 100,
    projectDomain?: string,
  ): Promise<GscSearchAnalyticsResponse> {
    const siteUrl = await this.resolveSiteUrl(userId, projectDomain);
    if (!siteUrl) {
      throw new NotFoundException(
        `No Search Console property matches domain "${projectDomain}" and no fallback site is configured`,
      );
    }
    const { startDate, endDate } = this.getDateRange(days);
    const accessToken = await this.oauth.refreshAccessToken(userId);

    try {
      const { data } = await axios.post(
        `${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          startDate,
          endDate,
          dimensions: ['query'],
          rowLimit: Math.min(limit, 25000),
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const rows: GscQueryRow[] = (data.rows || []).map((r: any) => ({
        query: r.keys?.[0] || '',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: r.ctr || 0,
        position: r.position || 0,
      }));

      return this.summarize(rows);
    } catch (err: any) {
      this.logger.error(
        `GSC searchAnalytics query failed for ${siteUrl}: ${err?.response?.data?.error?.message || err.message}`,
      );
      throw err;
    }
  }

  /**
   * Query GSC search analytics aggregated by page URL (top performing pages).
   */
  async getTopPages(
    userId: string,
    days: number = 28,
    limit: number = 100,
    projectDomain?: string,
  ): Promise<{ rows: GscPageRow[]; totalClicks: number; totalImpressions: number }> {
    const siteUrl = await this.resolveSiteUrl(userId, projectDomain);
    if (!siteUrl) {
      throw new NotFoundException(
        `No Search Console property matches domain "${projectDomain}" and no fallback site is configured`,
      );
    }
    const { startDate, endDate } = this.getDateRange(days);
    const accessToken = await this.oauth.refreshAccessToken(userId);

    try {
      const { data } = await axios.post(
        `${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          startDate,
          endDate,
          dimensions: ['page'],
          rowLimit: Math.min(limit, 25000),
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const rows: GscPageRow[] = (data.rows || []).map((r: any) => ({
        page: r.keys?.[0] || '',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: r.ctr || 0,
        position: r.position || 0,
      }));

      const totalClicks = rows.reduce((acc, r) => acc + r.clicks, 0);
      const totalImpressions = rows.reduce((acc, r) => acc + r.impressions, 0);

      return { rows, totalClicks, totalImpressions };
    } catch (err: any) {
      this.logger.error(
        `GSC top pages query failed for ${siteUrl}: ${err?.response?.data?.error?.message || err.message}`,
      );
      throw err;
    }
  }

  /**
   * Get exact ranking data for a specific list of keywords.
   * Uses GSC's query+page dimensions to get position per query.
   * Returns map of normalized keyword → row data, so the caller can look up by keyword.
   */
  async getKeywordPositions(
    userId: string,
    keywords: string[],
    days: number = 28,
    projectDomain?: string,
  ): Promise<Map<string, GscQueryRow>> {
    if (keywords.length === 0) return new Map();

    const siteUrl = await this.resolveSiteUrl(userId, projectDomain);
    if (!siteUrl) {
      this.logger.warn(
        `No GSC site matches domain "${projectDomain}" — returning empty positions`,
      );
      return new Map();
    }
    const { startDate, endDate } = this.getDateRange(days);
    const accessToken = await this.oauth.refreshAccessToken(userId);

    const normalize = (s: string) => s.toLowerCase().trim();
    const normalizedSet = new Set(keywords.map(normalize));

    try {
      // GSC doesn't accept "where keyword IN (...)" — we fetch top N queries
      // and filter to the ones we care about. 5000 covers most projects.
      const { data } = await axios.post(
        `${GSC_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          startDate,
          endDate,
          dimensions: ['query', 'page'],
          rowLimit: 5000,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const map = new Map<string, GscQueryRow>();
      for (const r of data.rows || []) {
        const query = (r.keys?.[0] || '').toString();
        const page = (r.keys?.[1] || '').toString();
        const norm = normalize(query);

        if (!normalizedSet.has(norm)) continue;
        // Keep the best (most clicks) row per normalized keyword
        const existing = map.get(norm);
        if (!existing || (r.clicks || 0) > existing.clicks) {
          map.set(norm, {
            query,
            page,
            clicks: r.clicks || 0,
            impressions: r.impressions || 0,
            ctr: r.ctr || 0,
            position: r.position || 0,
          });
        }
      }

      return map;
    } catch (err: any) {
      this.logger.error(
        `GSC keyword positions query failed for ${siteUrl}: ${err?.response?.data?.error?.message || err.message}`,
      );
      throw err;
    }
  }

  private getDateRange(days: number): { startDate: string; endDate: string } {
    // GSC data is delayed by ~2 days. Use a 3-day lag to be safe.
    const end = new Date();
    end.setDate(end.getDate() - 3);
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }

  private summarize(rows: GscQueryRow[]): GscSearchAnalyticsResponse {
    const totalClicks = rows.reduce((acc, r) => acc + r.clicks, 0);
    const totalImpressions = rows.reduce((acc, r) => acc + r.impressions, 0);
    const avgCtr =
      totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition =
      rows.length > 0
        ? rows.reduce((acc, r) => acc + r.position, 0) / rows.length
        : 0;
    return { rows, totalClicks, totalImpressions, avgCtr, avgPosition };
  }
}
