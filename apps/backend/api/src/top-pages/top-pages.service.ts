import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeDomain } from '../common/utils/domain';
import {
  callOpenAIJson,
  callOpenAIJsonWithSearch,
  isWebSearchEnabled,
} from '../common/utils/openai';
import { serpApiSearch, isSerpApiConfigured } from '../common/utils/serpapi';
import { GscApiService } from '../google-oauth/gsc-api.service';
import { incrementDailyUsage } from '../common/utils/usage';

interface TopPagesData {
  domain: string;
  country: string;
  summary: {
    totalPages: number;
    totalOrganicTraffic: number;
    avgKeywordsPerPage: number;
  };
  pages: {
    url: string;
    traffic: number;
    trafficPercent: number;
    keywords: number;
    topKeyword: string;
    topKeywordPosition: number;
    backlinks: number;
    trafficTrend: number[];
  }[];
}

@Injectable()
export class TopPagesService {
  private readonly logger = new Logger(TopPagesService.name);
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
      this.logger.log('Top Pages: using SerpAPI site:domain queries for real indexed pages');
    } else if (this.hasOpenAI) {
      this.logger.warn('Top Pages: SerpAPI not configured — falling back to Anthropic estimates');
    } else {
      this.logger.error('Top Pages: neither SerpAPI nor Anthropic configured');
    }
  }

  async getTopPages(
    domain: string,
    country: string,
    userId: string,
  ): Promise<TopPagesData & { gscConnected?: boolean }> {
    const normalized = normalizeDomain(domain);
    if (!normalized) throw new BadRequestException('Invalid domain');

    // If the user has GSC connected, return REAL traffic data from GSC.
    // This bypasses SerpAPI/Anthropic estimates entirely.
    try {
      if (await this.gsc.isConnected(userId)) {
        const gscData = await this.fetchFromGsc(userId, normalized, country);
        await incrementDailyUsage(this.prisma, userId, 'TOP_PAGES');
        return { ...gscData, gscConnected: true };
      }
    } catch (err) {
      this.logger.warn(`GSC top pages fetch failed, falling back: ${err}`);
    }

    if (!this.hasSerpApi && !this.hasOpenAI) {
      throw new BadRequestException('Top Pages requires SERPAPI_KEY or ANTHROPIC_API_KEY');
    }

    // No caching — every call hits SerpAPI + Anthropic fresh.
    const data = this.hasSerpApi
      ? await this.fetchFromSerpApi(normalized, country)
      : await this.fetchFromOpenAI(normalized, country);

    await incrementDailyUsage(this.prisma, userId, 'TOP_PAGES');

    return { ...data, gscConnected: false };
  }

  /**
   * Fetch top pages directly from Google Search Console.
   * Returns REAL impressions/clicks/CTR/position per page from the last 28 days.
   * No SerpAPI or Anthropic calls — pure GSC data.
   */
  private async fetchFromGsc(
    userId: string,
    domain: string,
    country: string,
  ): Promise<TopPagesData> {
    const { rows, totalClicks } = await this.gsc.getTopPages(
      userId,
      28,
      30,
      domain,
    );

    // Filter to pages on this domain (GSC site might cover subdomains)
    const domainLower = domain.toLowerCase();
    const relevantRows = rows.filter((r) =>
      r.page.toLowerCase().includes(domainLower),
    );

    const pages = relevantRows.slice(0, 10).map((r) => ({
      url: r.page,
      traffic: r.clicks, // REAL clicks from GSC
      trafficPercent: totalClicks > 0 ? (r.clicks / totalClicks) * 100 : 0,
      keywords: 0, // GSC doesn't expose keyword count per page directly
      topKeyword: '', // We'd need a second query to get this; skipped for cost
      topKeywordPosition: Math.round(r.position),
      backlinks: 0, // GSC doesn't have backlinks
      trafficTrend: [], // Could fetch daily breakdown; skipped for first cut
    }));

    return {
      domain,
      country,
      summary: {
        totalPages: relevantRows.length,
        totalOrganicTraffic: totalClicks, // REAL total clicks
        avgKeywordsPerPage: 0,
      },
      pages,
    };
  }

  // ─── SERPAPI: site:domain query returns the real pages Google has indexed ──

  private async fetchFromSerpApi(
    domain: string,
    country: string,
  ): Promise<TopPagesData> {
    try {
      const result = await serpApiSearch({
        apiKey: this.serpApiKey,
        query: `site:${domain}`,
        country,
        num: 30,
      });

      const realPages = result.organicResults.slice(0, 10).map((r) => ({
        url: r.link,
        position: r.position,
        title: r.title,
        snippet: r.snippet,
      }));

      if (realPages.length === 0) {
        this.logger.warn(`SerpAPI site:${domain} returned no results — falling back`);
        if (this.hasOpenAI) return this.fetchFromOpenAI(domain, country);
        return {
          domain,
          country,
          summary: { totalPages: 0, totalOrganicTraffic: 0, avgKeywordsPerPage: 0 },
          pages: [],
        };
      }

      // SerpAPI doesn't have traffic/keyword counts. Use Anthropic to estimate
      // these for the REAL pages we just discovered. If Anthropic is unavailable,
      // return the real pages with null/zero metrics.
      if (this.hasOpenAI) {
        return this.enrichRealPagesWithAnthropic(domain, country, realPages);
      }

      return {
        domain,
        country,
        summary: {
          totalPages: realPages.length,
          totalOrganicTraffic: 0,
          avgKeywordsPerPage: 0,
        },
        pages: realPages.map((p) => ({
          url: p.url,
          traffic: 0,
          trafficPercent: 0,
          keywords: 0,
          topKeyword: '',
          topKeywordPosition: p.position,
          backlinks: 0,
          trafficTrend: [],
        })),
      };
    } catch (err) {
      this.logger.error(`SerpAPI top pages error: ${err}`);
      if (this.hasOpenAI) return this.fetchFromOpenAI(domain, country);
      throw new BadRequestException('Failed to fetch top pages — SerpAPI request failed');
    }
  }

  /**
   * Take REAL pages discovered via SerpAPI and ask Anthropic to estimate
   * traffic/keywords for each. The URLs are real; only the metrics are estimated.
   */
  private async enrichRealPagesWithAnthropic(
    domain: string,
    country: string,
    realPages: { url: string; position: number; title: string; snippet: string }[],
  ): Promise<TopPagesData> {
    try {
      const pageList = realPages
        .map((p, i) => `${i + 1}. ${p.url} — "${p.title}"`)
        .join('\n');

      const systemPrompt = `You are an SEO analyst. Estimate realistic metrics for the REAL pages provided.

Return ONLY valid JSON:
{
  "summary": { "totalPages": <int>, "totalOrganicTraffic": <int>, "avgKeywordsPerPage": <int> },
  "pages": [
    {
      "url": "<URL exactly as provided, do not modify>",
      "traffic": <int monthly organic visits>,
      "trafficPercent": <float 0-100>,
      "keywords": <int distinct keywords driving traffic>,
      "topKeyword": "<the primary keyword for this page>",
      "topKeywordPosition": <int 1-100>,
      "backlinks": <int>,
      "trafficTrend": [<6 ints showing last 6 months>]
    }
  ]
}

Rules:
- Return exactly ${realPages.length} pages in the same order as the input.
- Use the exact URL from the input — do not invent new URLs.
- Be realistic. Small/local sites have low traffic per page (10-500/month).`;

      const userPrompt = `Domain: ${domain}\nCountry: ${country}\n\nReal pages (in order):\n${pageList}`;

      const parsed: any = await callOpenAIJson({
        apiKey: this.openaiKey,
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        maxTokens: 3000,
      });

      const enrichedPages = Array.isArray(parsed.pages) ? parsed.pages : [];

      return {
        domain,
        country,
        summary: parsed.summary || {
          totalPages: realPages.length,
          totalOrganicTraffic: 0,
          avgKeywordsPerPage: 0,
        },
        // Force the URLs back to the SerpAPI-real values in case Anthropic mutated them
        pages: realPages.map((real, i) => {
          const est = enrichedPages[i] || {};
          return {
            url: real.url,
            traffic: typeof est.traffic === 'number' ? est.traffic : 0,
            trafficPercent: typeof est.trafficPercent === 'number' ? est.trafficPercent : 0,
            keywords: typeof est.keywords === 'number' ? est.keywords : 0,
            topKeyword: est.topKeyword || '',
            topKeywordPosition:
              typeof est.topKeywordPosition === 'number'
                ? est.topKeywordPosition
                : real.position,
            backlinks: typeof est.backlinks === 'number' ? est.backlinks : 0,
            trafficTrend: Array.isArray(est.trafficTrend) ? est.trafficTrend : [],
          };
        }),
      };
    } catch (err) {
      this.logger.error(`Anthropic enrichment for top pages failed: ${err}`);
      // Return real pages with empty metrics rather than throwing
      return {
        domain,
        country,
        summary: {
          totalPages: realPages.length,
          totalOrganicTraffic: 0,
          avgKeywordsPerPage: 0,
        },
        pages: realPages.map((p) => ({
          url: p.url,
          traffic: 0,
          trafficPercent: 0,
          keywords: 0,
          topKeyword: '',
          topKeywordPosition: p.position,
          backlinks: 0,
          trafficTrend: [],
        })),
      };
    }
  }

  private async fetchFromOpenAI(domain: string, country: string): Promise<TopPagesData> {
    try {
      const useSearch = isWebSearchEnabled('top-pages');
      const baseSystem = `SEO analyst. Return JSON listing top pages for a domain.
{"summary":{"totalPages":<int>,"totalOrganicTraffic":<int>,"avgKeywordsPerPage":<int>},"pages":[{"url":"<path>","traffic":<int>,"trafficPercent":<float>,"keywords":<int>,"topKeyword":"<str>","topKeywordPosition":<1-100>,"backlinks":<int>,"trafficTrend":[<6 ints>]}] 10 items by traffic desc}`;

      const systemPrompt = useSearch
        ? baseSystem +
          `\nUse web search to identify the actual highest-traffic pages on the domain in the requested country, the keywords that drive their traffic, and where those keywords rank. Short paths.`
        : baseSystem + `\nShort paths. Realistic.`;

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
          });

      return {
        domain,
        country,
        summary: parsed.summary || { totalPages: 0, totalOrganicTraffic: 0, avgKeywordsPerPage: 0 },
        pages: Array.isArray(parsed.pages) ? parsed.pages : [],
      };
    } catch (err) {
      this.logger.error(`OpenAI top pages error: ${err}`);
      throw new BadRequestException('Failed to fetch top pages data. Please try again.');
    }
  }
}
