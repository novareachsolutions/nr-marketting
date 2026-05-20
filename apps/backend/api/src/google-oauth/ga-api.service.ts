import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleOAuthService } from './google-oauth.service';

const GA_ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta';
const GA_DATA_BASE = 'https://analyticsdata.googleapis.com/v1beta';

export interface GaOverview {
  sessions: number;
  totalUsers: number;
  newUsers: number;
  screenPageViews: number;
  engagementRate: number; // 0-1
  avgSessionDuration: number; // seconds
  // Period-over-period change (% delta vs the preceding equal-length window)
  sessionsChange: number | null;
  usersChange: number | null;
}

export interface GaSourceRow {
  channel: string;
  sessions: number;
  totalUsers: number;
}

export interface GaPageRow {
  page: string;
  screenPageViews: number;
  sessions: number;
}

export interface GaTimeseriesPoint {
  date: string; // YYYY-MM-DD
  sessions: number;
  totalUsers: number;
}

export interface GaStatus {
  /** User has a Google connection with the analytics scope granted. */
  connected: boolean;
  /** A GA4 property whose data stream URL matches the project domain was found. */
  matched: boolean;
  /** Property ID used for queries (numeric, e.g. "123456789"), or null. */
  propertyId: string | null;
  /** Human-readable property name, when matched. */
  propertyName: string | null;
  /**
   * GA is considered "implemented" on the domain when a property matches AND it
   * has reported at least one session in the recent window. matched-but-no-data
   * usually means the tag isn't firing yet.
   */
  implemented: boolean;
}

interface ResolvedProperty {
  propertyId: string;
  displayName: string;
}

/**
 * Talks to the GA4 Admin + Data APIs. Mirrors {@link GscApiService}: it
 * auto-matches a GA4 property to a project domain (via the property's web data
 * stream URL), then runs reports. The user never has to manually pick a property.
 */
@Injectable()
export class GaApiService {
  private readonly logger = new Logger(GaApiService.name);

  /**
   * Per-user cache of property → stream-domain mappings. Resolving requires one
   * Admin API call plus one dataStreams call per property, so we cache the whole
   * list briefly to keep the dashboard (which checks status per project) cheap.
   */
  private readonly propertyCache = new Map<
    string,
    { at: number; properties: Array<ResolvedProperty & { domains: string[] }> }
  >();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  /**
   * In-flight property lookups per user. The dashboard checks status for every
   * project at once, so we collapse concurrent loads into a single API sweep.
   */
  private readonly inFlight = new Map<
    string,
    Promise<Array<ResolvedProperty & { domains: string[] }>>
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: GoogleOAuthService,
  ) {}

  async isConnected(userId: string): Promise<boolean> {
    const connection = await this.prisma.googleConnection.findUnique({
      where: { userId },
      select: { scope: true },
    });
    if (!connection) return false;
    return (connection.scope || '').includes('analytics');
  }

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
   * List every GA4 property the user can access, each annotated with the
   * domain(s) of its web data streams. Cached per user for CACHE_TTL_MS.
   */
  private async loadProperties(
    userId: string,
  ): Promise<Array<ResolvedProperty & { domains: string[] }>> {
    const cached = this.propertyCache.get(userId);
    if (cached && Date.now() - cached.at < this.CACHE_TTL_MS) {
      return cached.properties;
    }

    const existing = this.inFlight.get(userId);
    if (existing) return existing;

    const promise = this.fetchProperties(userId).finally(() => {
      this.inFlight.delete(userId);
    });
    this.inFlight.set(userId, promise);
    return promise;
  }

  private async fetchProperties(
    userId: string,
  ): Promise<Array<ResolvedProperty & { domains: string[] }>> {
    const accessToken = await this.oauth.refreshAccessToken(userId);
    const headers = { Authorization: `Bearer ${accessToken}` };

    // 1. Enumerate properties via account summaries.
    let summaries: any;
    try {
      const { data } = await axios.get(`${GA_ADMIN_BASE}/accountSummaries`, {
        headers,
        params: { pageSize: 200 },
      });
      summaries = data;
    } catch (err: any) {
      this.logger.warn(
        `Failed to list GA account summaries: ${err?.response?.data?.error?.message || err.message}`,
      );
      return [];
    }

    const props: ResolvedProperty[] = [];
    for (const account of summaries.accountSummaries || []) {
      for (const prop of account.propertySummaries || []) {
        props.push({
          propertyId: String(prop.property || '').replace('properties/', ''),
          displayName: prop.displayName || '',
        });
      }
    }

    // 2. For each property, read its web data streams to learn the site domain.
    const resolved = await Promise.all(
      props.map(async (p) => {
        const domains: string[] = [];
        try {
          const { data } = await axios.get(
            `${GA_ADMIN_BASE}/properties/${p.propertyId}/dataStreams`,
            { headers },
          );
          for (const stream of data.dataStreams || []) {
            const uri = stream?.webStreamData?.defaultUri;
            if (uri) domains.push(this.normalizeDomain(uri));
          }
        } catch (err: any) {
          this.logger.debug(
            `Failed to read data streams for property ${p.propertyId}: ${err?.response?.data?.error?.message || err.message}`,
          );
        }
        return { ...p, domains };
      }),
    );

    this.propertyCache.set(userId, { at: Date.now(), properties: resolved });
    return resolved;
  }

  /**
   * Resolve the GA4 property ID to query for a project domain.
   * Order of preference:
   *   1. A property whose web data stream URL matches the domain
   *   2. The user's manually-selected `gaPropertyId` (fallback)
   * Returns null when nothing matches.
   */
  async resolveProperty(
    userId: string,
    projectDomain?: string,
  ): Promise<ResolvedProperty | null> {
    if (projectDomain) {
      const target = this.normalizeDomain(projectDomain);
      const properties = await this.loadProperties(userId);
      const match = properties.find((p) => p.domains.includes(target));
      if (match) {
        return { propertyId: match.propertyId, displayName: match.displayName };
      }
    }

    const connection = await this.prisma.googleConnection.findUnique({
      where: { userId },
      select: { gaPropertyId: true },
    });
    if (connection?.gaPropertyId) {
      return { propertyId: connection.gaPropertyId, displayName: 'Default property' };
    }
    return null;
  }

  async getStatus(userId: string, projectDomain?: string): Promise<GaStatus> {
    const connected = await this.isConnected(userId);
    if (!connected) {
      return {
        connected: false,
        matched: false,
        propertyId: null,
        propertyName: null,
        implemented: false,
      };
    }

    // For status we only auto-match by domain (no silent fallback to the saved
    // default), so the "not detected on this domain" signal stays accurate.
    let matchedProp: ResolvedProperty | null = null;
    if (projectDomain) {
      const target = this.normalizeDomain(projectDomain);
      const properties = await this.loadProperties(userId);
      const m = properties.find((p) => p.domains.includes(target));
      if (m) matchedProp = { propertyId: m.propertyId, displayName: m.displayName };
    }

    if (!matchedProp) {
      return {
        connected: true,
        matched: false,
        propertyId: null,
        propertyName: null,
        implemented: false,
      };
    }

    // Matched — confirm data is actually flowing (tag firing).
    let implemented = false;
    try {
      const overview = await this.runOverview(userId, matchedProp.propertyId, 28);
      implemented = overview.sessions > 0 || overview.screenPageViews > 0;
    } catch {
      implemented = false;
    }

    return {
      connected: true,
      matched: true,
      propertyId: matchedProp.propertyId,
      propertyName: matchedProp.displayName,
      implemented,
    };
  }

  async getOverview(
    userId: string,
    projectDomain: string,
    days = 28,
  ): Promise<GaOverview> {
    const prop = await this.resolveProperty(userId, projectDomain);
    if (!prop) {
      throw new NotFoundException(
        `No Google Analytics property matches domain "${projectDomain}"`,
      );
    }
    return this.runOverview(userId, prop.propertyId, days);
  }

  private async runOverview(
    userId: string,
    propertyId: string,
    days: number,
  ): Promise<GaOverview> {
    const current = this.getDateRange(days, 0);
    const previous = this.getDateRange(days, days);
    const accessToken = await this.oauth.refreshAccessToken(userId);

    const { data } = await axios.post(
      `${GA_DATA_BASE}/properties/${propertyId}:runReport`,
      {
        dateRanges: [
          { startDate: current.startDate, endDate: current.endDate, name: 'current' },
          { startDate: previous.startDate, endDate: previous.endDate, name: 'previous' },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'screenPageViews' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
        ],
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    // Rows come back keyed by the dateRange name in the first dimension slot.
    const byRange: Record<string, number[]> = {};
    for (const row of data.rows || []) {
      const name = row.dimensionValues?.[0]?.value || 'current';
      byRange[name] = (row.metricValues || []).map((m: any) =>
        parseFloat(m.value || '0'),
      );
    }
    const cur = byRange['current'] || [];
    const prev = byRange['previous'] || [];

    const pctChange = (a: number, b: number): number | null => {
      if (b === 0) return a > 0 ? 100 : null;
      return ((a - b) / b) * 100;
    };

    return {
      sessions: cur[0] || 0,
      totalUsers: cur[1] || 0,
      newUsers: cur[2] || 0,
      screenPageViews: cur[3] || 0,
      engagementRate: cur[4] || 0,
      avgSessionDuration: cur[5] || 0,
      sessionsChange: pctChange(cur[0] || 0, prev[0] || 0),
      usersChange: pctChange(cur[1] || 0, prev[1] || 0),
    };
  }

  async getTrafficSources(
    userId: string,
    projectDomain: string,
    days = 28,
  ): Promise<GaSourceRow[]> {
    const prop = await this.resolveProperty(userId, projectDomain);
    if (!prop) {
      throw new NotFoundException(
        `No Google Analytics property matches domain "${projectDomain}"`,
      );
    }
    const { startDate, endDate } = this.getDateRange(days, 0);
    const accessToken = await this.oauth.refreshAccessToken(userId);

    const { data } = await axios.post(
      `${GA_DATA_BASE}/properties/${prop.propertyId}:runReport`,
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20,
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    return (data.rows || []).map((r: any) => ({
      channel: r.dimensionValues?.[0]?.value || 'Unknown',
      sessions: parseFloat(r.metricValues?.[0]?.value || '0'),
      totalUsers: parseFloat(r.metricValues?.[1]?.value || '0'),
    }));
  }

  async getTopPages(
    userId: string,
    projectDomain: string,
    days = 28,
    limit = 25,
  ): Promise<GaPageRow[]> {
    const prop = await this.resolveProperty(userId, projectDomain);
    if (!prop) {
      throw new NotFoundException(
        `No Google Analytics property matches domain "${projectDomain}"`,
      );
    }
    const { startDate, endDate } = this.getDateRange(days, 0);
    const accessToken = await this.oauth.refreshAccessToken(userId);

    const { data } = await axios.post(
      `${GA_DATA_BASE}/properties/${prop.propertyId}:runReport`,
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: Math.min(limit, 250),
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    return (data.rows || []).map((r: any) => ({
      page: r.dimensionValues?.[0]?.value || '',
      screenPageViews: parseFloat(r.metricValues?.[0]?.value || '0'),
      sessions: parseFloat(r.metricValues?.[1]?.value || '0'),
    }));
  }

  async getTimeseries(
    userId: string,
    projectDomain: string,
    days = 28,
  ): Promise<GaTimeseriesPoint[]> {
    const prop = await this.resolveProperty(userId, projectDomain);
    if (!prop) {
      throw new NotFoundException(
        `No Google Analytics property matches domain "${projectDomain}"`,
      );
    }
    const { startDate, endDate } = this.getDateRange(days, 0);
    const accessToken = await this.oauth.refreshAccessToken(userId);

    const { data } = await axios.post(
      `${GA_DATA_BASE}/properties/${prop.propertyId}:runReport`,
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 400,
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    return (data.rows || []).map((r: any) => {
      const raw = r.dimensionValues?.[0]?.value || ''; // YYYYMMDD
      const date =
        raw.length === 8
          ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
          : raw;
      return {
        date,
        sessions: parseFloat(r.metricValues?.[0]?.value || '0'),
        totalUsers: parseFloat(r.metricValues?.[1]?.value || '0'),
      };
    });
  }

  /**
   * Date range ending `offsetDays` ago and spanning `days`. GA4 data is fresher
   * than GSC but still settles, so we end 1 day back.
   */
  private getDateRange(
    days: number,
    offsetDays: number,
  ): { startDate: string; endDate: string } {
    const end = new Date();
    end.setDate(end.getDate() - 1 - offsetDays);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }
}
