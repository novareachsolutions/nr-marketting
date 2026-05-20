import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  callOpenAIJson,
  callOpenAIJsonWithSearch,
  isWebSearchEnabled,
} from '../common/utils/openai';
import { serpApiSearch, isSerpApiConfigured } from '../common/utils/serpapi';
import { GscApiService } from '../google-oauth/gsc-api.service';

type ChangeType = 'improved' | 'declined' | 'new' | 'lost';
type SearchIntent = 'informational' | 'navigational' | 'commercial' | 'transactional';

interface OrganicRankingsData {
  domain: string;
  country: string;
  summary: {
    totalOrganicKeywords: number;
    organicMonthlyTraffic: number;
    organicTrafficCost: number;
    brandedTrafficPercent: number;
    nonBrandedTrafficPercent: number;
  };
  positions: {
    keyword: string;
    position: number;
    previousPosition: number | null;
    volume: number;
    trafficPercent: number;
    trafficCost: number;
    url: string;
    serpFeatures: string[];
    intent: SearchIntent;
    kd: number;
    cpc: number;
    lastUpdated: string;
  }[];
  positionChanges: {
    keyword: string;
    changeType: ChangeType;
    oldPosition: number | null;
    newPosition: number | null;
    change: number;
    volume: number;
    url: string;
    trafficImpact: number;
  }[];
  competitors: {
    domain: string;
    commonKeywords: number;
    seKeywords: number;
    seTraffic: number;
    trafficCost: number;
    paidKeywords: number;
  }[];
  pages: {
    url: string;
    trafficPercent: number;
    keywords: number;
    traffic: number;
  }[];
}

@Injectable()
export class OrganicRankingsService {
  private readonly logger = new Logger(OrganicRankingsService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;
  private readonly serpApiKey: string;
  private readonly hasSerpApi: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gsc: GscApiService,
  ) {
    this.openaiKey = this.config.get<string>('ANTHROPIC_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;
    this.serpApiKey = this.config.get<string>('SERPAPI_KEY') || '';
    this.hasSerpApi = isSerpApiConfigured(this.serpApiKey);

    if (this.hasSerpApi) {
      this.logger.log('Organic Rankings: using SerpAPI site:domain query for real ranking data');
    } else if (this.hasOpenAI) {
      this.logger.warn('Organic Rankings: SerpAPI not configured — falling back to Anthropic');
    } else {
      this.logger.error('Organic Rankings: neither SerpAPI nor Anthropic configured');
    }
  }

  // ─── MAIN ENTRY POINT ────────────────────────────────────

  async getOrganicRankings(
    domain: string,
    country: string,
    userId: string,
  ): Promise<OrganicRankingsData> {
    const normalized = this.normalizeDomain(domain);

    if (!normalized) {
      throw new BadRequestException('Invalid domain');
    }

    // If user has GSC connected → return REAL ranking data from Search Console.
    try {
      if (await this.gsc.isConnected(userId)) {
        const gscData = await this.fetchFromGsc(userId, normalized, country);
        await this.incrementUsage(userId);
        return { ...gscData, gscConnected: true } as any;
      }
    } catch (err) {
      this.logger.warn(`GSC organic rankings fetch failed, falling back: ${err}`);
    }

    if (!this.hasSerpApi && !this.hasOpenAI) {
      throw new BadRequestException('Organic Rankings requires SERPAPI_KEY or ANTHROPIC_API_KEY');
    }

    // No caching — every call hits SerpAPI + Anthropic fresh.
    const data = this.hasSerpApi
      ? await this.fetchFromSerpApi(normalized, country)
      : await this.fetchFromOpenAI(normalized, country);

    await this.incrementUsage(userId);

    return { ...data, gscConnected: false } as any;
  }

  /**
   * Pull real organic ranking data from Google Search Console for the user's
   * configured site. Returns top queries + top pages with real impressions,
   * clicks, CTR, and average position over the last 28 days.
   */
  private async fetchFromGsc(
    userId: string,
    domain: string,
    country: string,
  ): Promise<OrganicRankingsData> {
    const [queriesResp, pagesResp] = await Promise.all([
      this.gsc.getTopQueries(userId, 28, 50, domain),
      this.gsc.getTopPages(userId, 28, 20, domain),
    ]);

    const positions = queriesResp.rows.slice(0, 20).map((r) => ({
      keyword: r.query,
      position: Math.round(r.position),
      previousPosition: null,
      volume: r.impressions, // GSC impressions used as proxy for visibility
      trafficPercent:
        queriesResp.totalClicks > 0
          ? (r.clicks / queriesResp.totalClicks) * 100
          : 0,
      trafficCost: 0,
      url: '', // Would need a second query (query + page dimension)
      serpFeatures: [],
      intent: 'informational' as const,
      kd: 0,
      cpc: 0,
      lastUpdated: new Date().toISOString().split('T')[0],
    }));

    const domainLower = domain.toLowerCase();
    const pages = pagesResp.rows
      .filter((r) => r.page.toLowerCase().includes(domainLower))
      .slice(0, 10)
      .map((r) => ({
        url: r.page,
        trafficPercent:
          pagesResp.totalClicks > 0
            ? (r.clicks / pagesResp.totalClicks) * 100
            : 0,
        keywords: 0,
        traffic: r.clicks,
      }));

    return {
      domain,
      country,
      summary: {
        totalOrganicKeywords: queriesResp.rows.length,
        organicMonthlyTraffic: queriesResp.totalClicks,
        organicTrafficCost: 0,
        brandedTrafficPercent: 0,
        nonBrandedTrafficPercent: 0,
      },
      positions,
      positionChanges: [],
      competitors: [],
      pages,
    };
  }

  // ─── SERPAPI FETCH ─────────────────────────────────────────

  /**
   * Use SerpAPI to pull the REAL pages of the domain that Google has indexed,
   * then ask Anthropic to derive what keywords/positions they're likely ranking
   * for. Real pages → estimated metrics. Much more accurate than pure AI.
   */
  private async fetchFromSerpApi(
    domain: string,
    country: string,
  ): Promise<OrganicRankingsData> {
    try {
      const result = await serpApiSearch({
        apiKey: this.serpApiKey,
        query: `site:${domain}`,
        country,
        num: 30,
      });

      const realPages = result.organicResults.slice(0, 15).map((r) => ({
        url: r.link,
        title: r.title,
        snippet: r.snippet,
      }));

      if (realPages.length === 0) {
        this.logger.warn(`SerpAPI site:${domain} returned no results — falling back`);
        if (this.hasOpenAI) return this.fetchFromOpenAI(domain, country);
        throw new BadRequestException('No indexed pages found for this domain');
      }

      // Anthropic enriches the real pages with derived ranking data
      if (this.hasOpenAI) {
        return this.deriveRankingsFromRealPages(domain, country, realPages);
      }

      // No Anthropic available — return just the structure with real URLs
      return {
        domain,
        country,
        summary: {
          totalOrganicKeywords: realPages.length,
          organicMonthlyTraffic: 0,
          organicTrafficCost: 0,
          brandedTrafficPercent: 0,
          nonBrandedTrafficPercent: 0,
        },
        positions: [],
        positionChanges: [],
        competitors: [],
        pages: realPages.map((p) => ({
          url: p.url,
          trafficPercent: 0,
          keywords: 0,
          traffic: 0,
        })),
      };
    } catch (err) {
      this.logger.error(`SerpAPI organic rankings error: ${err}`);
      if (this.hasOpenAI) return this.fetchFromOpenAI(domain, country);
      throw new BadRequestException('Failed to fetch organic rankings');
    }
  }

  private async deriveRankingsFromRealPages(
    domain: string,
    country: string,
    realPages: { url: string; title: string; snippet: string }[],
  ): Promise<OrganicRankingsData> {
    const pageList = realPages
      .map((p, i) => `${i + 1}. ${p.url} — "${p.title}" — ${p.snippet}`)
      .join('\n');

    const baseSystem = `SEO analyst. The following REAL pages were just discovered on Google for site:${domain}. Derive what keywords they likely rank for and at what positions. Return JSON:
{"summary":{"totalOrganicKeywords":<int>,"organicMonthlyTraffic":<int>,"organicTrafficCost":<float>,"brandedTrafficPercent":<int>,"nonBrandedTrafficPercent":<int>},"positions":[{"keyword":"<str>","position":<1-100>,"previousPosition":<int|null>,"volume":<int>,"trafficPercent":<float>,"trafficCost":<float>,"url":"<MUST be one of the real URLs above>","serpFeatures":[],"intent":"informational","kd":<0-100>,"cpc":<float>,"lastUpdated":"2026-05-19"}] 10 items,"positionChanges":[{"keyword":"<str>","changeType":"improved","oldPosition":<int|null>,"newPosition":<int|null>,"change":<int>,"volume":<int>,"url":"<real url>","trafficImpact":<int>}] 6 items,"competitors":[{"domain":"<realistic competitor>","commonKeywords":<int>,"seKeywords":<int>,"seTraffic":<int>,"trafficCost":<float>,"paidKeywords":<int>}] 5 items,"pages":[{"url":"<one of the real URLs above>","trafficPercent":<float>,"keywords":<int>,"traffic":<int>}] use all real pages provided.

Rules:
- For "url" in positions/positionChanges/pages, use ONLY URLs from the real pages list above. Don't invent URLs.
- Be realistic about volume/KD/CPC.`;

    const userPrompt = `Domain: ${domain}\nCountry: ${country}\n\nReal indexed pages:\n${pageList}`;

    try {
      const parsed: any = await callOpenAIJson({
        apiKey: this.openaiKey,
        systemPrompt: baseSystem,
        userPrompt,
        temperature: 0.3,
        maxTokens: 4000,
      });

      return {
        domain,
        country,
        summary: parsed.summary || {
          totalOrganicKeywords: 0,
          organicMonthlyTraffic: 0,
          organicTrafficCost: 0,
          brandedTrafficPercent: 0,
          nonBrandedTrafficPercent: 0,
        },
        positions: Array.isArray(parsed.positions) ? parsed.positions : [],
        positionChanges: Array.isArray(parsed.positionChanges)
          ? parsed.positionChanges
          : [],
        competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
        pages: Array.isArray(parsed.pages) ? parsed.pages : [],
      };
    } catch (err) {
      this.logger.error(`Anthropic derivation from real pages failed: ${err}`);
      throw new BadRequestException(
        'Failed to derive organic rankings from real pages',
      );
    }
  }

  // ─── OPENAI FETCH ─────────────────────────────────────────

  private async fetchFromOpenAI(
    domain: string,
    country: string,
  ): Promise<OrganicRankingsData> {
    try {
      const useSearch = isWebSearchEnabled('organic-rankings');

      const baseSystem = `SEO analyst. Return JSON with organic ranking data for a domain.
{"summary":{"totalOrganicKeywords":<int>,"organicMonthlyTraffic":<int>,"organicTrafficCost":<float>,"brandedTrafficPercent":<int>,"nonBrandedTrafficPercent":<int>},"positions":[{"keyword":"<str>","position":<1-100>,"previousPosition":<int|null>,"volume":<int>,"trafficPercent":<float>,"trafficCost":<float>,"url":"<path>","serpFeatures":[],"intent":"informational","kd":<0-100>,"cpc":<float>,"lastUpdated":"2026-04-01"}] 10 items,"positionChanges":[{"keyword":"<str>","changeType":"improved","oldPosition":<int|null>,"newPosition":<int|null>,"change":<int>,"volume":<int>,"url":"<path>","trafficImpact":<int>}] 8 items (2 each: improved/declined/new/lost),"competitors":[{"domain":"<str>","commonKeywords":<int>,"seKeywords":<int>,"seTraffic":<int>,"trafficCost":<float>,"paidKeywords":<int>}] 5 items,"pages":[{"url":"<path>","trafficPercent":<float>,"keywords":<int>,"traffic":<int>}] 5 items}`;

      const systemPrompt = useSearch
        ? baseSystem +
          `\nUse web search to identify keywords this domain ranks for in Google for the requested country, and the actual ranking URLs. Use real competitor domains and real top pages of this domain. Short URLs.`
        : baseSystem + `\nBe realistic. Short URLs.`;

      const userPrompt = `Domain: "${domain}"\nCountry: ${country}`;

      const parsed: any = useSearch
        ? await callOpenAIJsonWithSearch({
            apiKey: this.openaiKey,
            systemPrompt,
            userPrompt,
            country,
            temperature: 0.2,
            maxTokens: 4000,
          })
        : await callOpenAIJson({
            apiKey: this.openaiKey,
            systemPrompt,
            userPrompt,
            temperature: 0.3,
            maxTokens: 3000,
          });

      return {
        domain,
        country,
        summary: parsed.summary || { totalOrganicKeywords: 0, organicMonthlyTraffic: 0, organicTrafficCost: 0, brandedTrafficPercent: 0, nonBrandedTrafficPercent: 0 },
        positions: Array.isArray(parsed.positions) ? parsed.positions : [],
        positionChanges: Array.isArray(parsed.positionChanges) ? parsed.positionChanges : [],
        competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
        pages: Array.isArray(parsed.pages) ? parsed.pages : [],
      };
    } catch (err) {
      this.logger.error(`OpenAI organic rankings error: ${err}`);
      throw new BadRequestException('Failed to fetch organic rankings. Please try again.');
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────

  private normalizeDomain(input: string): string {
    let domain = input.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, '');
    domain = domain.replace(/^www\./, '');
    domain = domain.split('/')[0].split('?')[0].split('#')[0];
    domain = domain.replace(/\.$/, '');
    return domain;
  }

  private async incrementUsage(userId: string): Promise<void> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const period = `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, '0')}-${String(todayStart.getDate()).padStart(2, '0')}`;

    await this.prisma.usageRecord.upsert({
      where: {
        userId_metric_period: {
          userId,
          metric: 'ORGANIC_RANKINGS',
          period,
        },
      },
      create: {
        userId,
        metric: 'ORGANIC_RANKINGS',
        count: 1,
        limit: 999999,
        period,
      },
      update: {
        count: { increment: 1 },
      },
    });
  }
}
