import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  callOpenAIJson,
  callOpenAIJsonWithSearch,
  isWebSearchEnabled,
} from '../common/utils/openai';
import { serpApiSearch, isSerpApiConfigured } from '../common/utils/serpapi';

interface DomainMetrics {
  domain: string;
  authorityScore: number;
  organicKeywords: number;
  organicTraffic: number;
  organicTrafficCost: number;
  paidKeywords: number;
  paidTraffic: number;
  backlinks: number;
  referringDomains: number;
  trafficTrend: { date: string; traffic: number }[];
}

interface CommonKeyword {
  keyword: string;
  volume: number;
  positions: Record<string, number>;
}

interface CompareDomainsData {
  domains: DomainMetrics[];
  keywordOverlap: {
    shared: number;
    unique: Record<string, number>;
    totalUniverse: number;
  };
  commonKeywords: CommonKeyword[];
  intentComparison: Record<string, {
    informational: number;
    navigational: number;
    commercial: number;
    transactional: number;
  }>;
}

@Injectable()
export class CompareDomainsService {
  private readonly logger = new Logger(CompareDomainsService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;
  private readonly serpApiKey: string;
  private readonly hasSerpApi: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('ANTHROPIC_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;
    this.serpApiKey = this.config.get<string>('SERPAPI_KEY') || '';
    this.hasSerpApi = isSerpApiConfigured(this.serpApiKey);

    if (this.hasSerpApi) {
      this.logger.log('Compare Domains: using SerpAPI site:domain queries for real comparison');
    } else if (this.hasOpenAI) {
      this.logger.warn('Compare Domains: SerpAPI not configured — falling back to Anthropic');
    } else {
      this.logger.error('Compare Domains: neither SerpAPI nor Anthropic configured');
    }
  }

  async compareDomains(
    domainsInput: string,
    country: string,
    userId: string,
  ): Promise<CompareDomainsData> {
    const domains = domainsInput
      .split(',')
      .map((d) => this.normalizeDomain(d))
      .filter(Boolean);

    if (domains.length < 2) {
      throw new BadRequestException('At least 2 domains are required');
    }
    if (domains.length > 5) {
      throw new BadRequestException('Maximum 5 domains allowed');
    }

    if (!this.hasSerpApi && !this.hasOpenAI) {
      throw new BadRequestException('Compare Domains requires SERPAPI_KEY or ANTHROPIC_API_KEY');
    }

    // No caching — every call hits SerpAPI + Anthropic fresh.
    const data = this.hasSerpApi
      ? await this.fetchFromSerpApi(domains, country)
      : await this.fetchFromOpenAI(domains, country);

    await this.incrementUsage(userId);

    return data;
  }

  // ─── SERPAPI: site:domain query per competitor for real indexed pages ──

  /**
   * Pull the real indexed pages for each domain (1 SerpAPI credit each),
   * then ask Anthropic to compare them. Real pages → grounded comparison.
   */
  private async fetchFromSerpApi(
    domains: string[],
    country: string,
  ): Promise<CompareDomainsData> {
    try {
      // 1 credit per domain — typically 2-5 credits total
      const perDomainPages: Record<
        string,
        { url: string; title: string; snippet: string }[]
      > = {};

      for (const domain of domains) {
        try {
          const result = await serpApiSearch({
            apiKey: this.serpApiKey,
            query: `site:${domain}`,
            country,
            num: 20,
          });
          perDomainPages[domain] = result.organicResults.slice(0, 10).map((r) => ({
            url: r.link,
            title: r.title,
            snippet: r.snippet,
          }));
        } catch (err) {
          this.logger.warn(`SerpAPI site:${domain} failed: ${err}`);
          perDomainPages[domain] = [];
        }
      }

      // If no domain returned anything, fall through to OpenAI
      const totalPages = Object.values(perDomainPages).reduce(
        (acc, p) => acc + p.length,
        0,
      );
      if (totalPages === 0) {
        this.logger.warn('SerpAPI returned no indexed pages for any domain — falling back');
        if (this.hasOpenAI) return this.fetchFromOpenAI(domains, country);
        throw new BadRequestException('No indexed pages found for any domain');
      }

      if (this.hasOpenAI) {
        return this.compareUsingRealPages(domains, country, perDomainPages);
      }

      // No Anthropic → return minimal shape with real page counts
      return {
        domains: domains.map((d) => ({
          domain: d,
          authorityScore: 0,
          organicKeywords: perDomainPages[d].length,
          organicTraffic: 0,
          organicTrafficCost: 0,
          paidKeywords: 0,
          paidTraffic: 0,
          backlinks: 0,
          referringDomains: 0,
          trafficTrend: [],
        })),
        keywordOverlap: { shared: 0, unique: {}, totalUniverse: 0 },
        commonKeywords: [],
        intentComparison: {},
      };
    } catch (err) {
      this.logger.error(`SerpAPI compare domains error: ${err}`);
      if (this.hasOpenAI) return this.fetchFromOpenAI(domains, country);
      throw new BadRequestException('Failed to compare domains');
    }
  }

  private async compareUsingRealPages(
    domains: string[],
    country: string,
    perDomainPages: Record<string, { url: string; title: string; snippet: string }[]>,
  ): Promise<CompareDomainsData> {
    const summary = domains
      .map((d) => {
        const pages = perDomainPages[d];
        const top = pages
          .slice(0, 8)
          .map((p, i) => `   ${i + 1}. ${p.url} — "${p.title}"`)
          .join('\n');
        return `Domain: ${d}\nIndexed pages found:\n${top || '   (none)'}`;
      })
      .join('\n\n');

    const systemPrompt = `SEO analyst. Compare these domains based on REAL indexed pages just discovered via Google. Return JSON:
{"domains":[{"domain":"<str>","authorityScore":<0-100>,"organicKeywords":<int>,"organicTraffic":<int>,"organicTrafficCost":<float>,"paidKeywords":<int>,"paidTraffic":<int>,"backlinks":<int>,"referringDomains":<int>,"trafficTrend":[{"date":"YYYY-MM","traffic":<int>}] 6 months}] one per domain in same order as input,"keywordOverlap":{"shared":<int>,"unique":{"<domain>":<int>},"totalUniverse":<int>},"commonKeywords":[{"keyword":"<str>","volume":<int>,"positions":{"<domain>":<1-100>}}] 10 items,"intentComparison":{"<domain>":{"informational":<int%>,"navigational":<int%>,"commercial":<int%>,"transactional":<int%>}}}

Rules:
- Use actual domain names as keys, not "domain1"/"domain2".
- Base estimates on the real page titles you can see — they reveal what each site actually targets.
- Be realistic. Small sites have small numbers.`;

    const userPrompt = `Country: ${country}\n\n${summary}`;

    try {
      const parsed: any = await callOpenAIJson({
        apiKey: this.openaiKey,
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        maxTokens: 4000,
      });

      return {
        domains: Array.isArray(parsed.domains) ? parsed.domains : [],
        keywordOverlap: parsed.keywordOverlap || {
          shared: 0,
          unique: {},
          totalUniverse: 0,
        },
        commonKeywords: Array.isArray(parsed.commonKeywords)
          ? parsed.commonKeywords
          : [],
        intentComparison: parsed.intentComparison || {},
      };
    } catch (err) {
      this.logger.error(`Anthropic comparison from real pages failed: ${err}`);
      throw new BadRequestException('Failed to compare domains');
    }
  }

  private async fetchFromOpenAI(
    domains: string[],
    country: string,
  ): Promise<CompareDomainsData> {
    try {
      const domainList = domains.join(', ');
      const useSearch = isWebSearchEnabled('compare-domains');

      const baseSystem = `SEO analyst. Compare domains side-by-side. Return JSON:
{"domains":[{"domain":"<str>","authorityScore":<0-100>,"organicKeywords":<int>,"organicTraffic":<int>,"organicTrafficCost":<float>,"paidKeywords":<int>,"paidTraffic":<int>,"backlinks":<int>,"referringDomains":<int>,"trafficTrend":[{"date":"YYYY-MM","traffic":<int>}] 6 months}] one per domain,"keywordOverlap":{"shared":<int>,"unique":{"domain1":<int>,"domain2":<int>},"totalUniverse":<int>},"commonKeywords":[{"keyword":"<str>","volume":<int>,"positions":{"domain1":<1-100>,"domain2":<1-100>}}] 10 items,"intentComparison":{"domain1":{"informational":<int%>,"navigational":<int%>,"commercial":<int%>,"transactional":<int%>}}}
Use actual domain names as keys.`;

      const systemPrompt = useSearch
        ? baseSystem +
          `\nUse web search to find real keywords each domain ranks for in the requested country and identify shared keywords. Use real positions in the SERP for the "positions" field.`
        : baseSystem + `\nBe realistic.`;

      const userPrompt = `Domains: ${domainList}\nCountry: ${country}`;

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
            maxTokens: 4000,
          });

      return {
        domains: Array.isArray(parsed.domains) ? parsed.domains : [],
        keywordOverlap: parsed.keywordOverlap || { shared: 0, unique: {}, totalUniverse: 0 },
        commonKeywords: Array.isArray(parsed.commonKeywords) ? parsed.commonKeywords : [],
        intentComparison: parsed.intentComparison || {},
      };
    } catch (err) {
      this.logger.error(`OpenAI compare domains error: ${err}`);
      throw new BadRequestException('Failed to compare domains. Please try again.');
    }
  }

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
          metric: 'COMPARE_DOMAINS',
          period,
        },
      },
      create: {
        userId,
        metric: 'COMPARE_DOMAINS',
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
