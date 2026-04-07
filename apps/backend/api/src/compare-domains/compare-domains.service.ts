import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS } from '../common/constants/plan-limits';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;

    if (!this.hasOpenAI) {
      this.logger.warn('OpenAI not configured for compare domains');
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

    // Build cache key from sorted domains + country
    const cacheKey = [...domains].sort().join('|') + '|' + country;

    // Check cache (7-day TTL)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const cached = await this.prisma.compareDomainCache.findUnique({
      where: { cacheKey },
    });

    if (cached && cached.updatedAt > sevenDaysAgo) {
      return cached.data as unknown as CompareDomainsData;
    }

    if (!this.hasOpenAI) {
      throw new BadRequestException('OpenAI API key is not configured');
    }

    const data = await this.fetchFromOpenAI(domains, country);

    await this.prisma.compareDomainCache.upsert({
      where: { cacheKey },
      create: { cacheKey, data: data as any },
      update: { data: data as any },
    });

    await this.incrementUsage(userId);

    return data;
  }

  private async fetchFromOpenAI(
    domains: string[],
    country: string,
  ): Promise<CompareDomainsData> {
    try {
      const domainList = domains.join(', ');
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `SEO analyst. Compare domains side-by-side. Return JSON:
{"domains":[{"domain":"<str>","authorityScore":<0-100>,"organicKeywords":<int>,"organicTraffic":<int>,"organicTrafficCost":<float>,"paidKeywords":<int>,"paidTraffic":<int>,"backlinks":<int>,"referringDomains":<int>,"trafficTrend":[{"date":"YYYY-MM","traffic":<int>}] 6 months}] one per domain,"keywordOverlap":{"shared":<int>,"unique":{"domain1":<int>,"domain2":<int>},"totalUniverse":<int>},"commonKeywords":[{"keyword":"<str>","volume":<int>,"positions":{"domain1":<1-100>,"domain2":<1-100>}}] 10 items,"intentComparison":{"domain1":{"informational":<int%>,"navigational":<int%>,"commercial":<int%>,"transactional":<int%>}}}
Be realistic. Use actual domain names as keys.`,
            },
            {
              role: 'user',
              content: `Domains: ${domainList}\nCountry: ${country}`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        },
      );

      const content = response.data.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content);

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

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true },
    });

    const plan = subscription?.plan || 'FREE';
    const limit = PLAN_LIMITS[plan].maxCompareDomainsPerDay;

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
        limit: limit === -1 ? 999999 : limit,
        period,
      },
      update: {
        count: { increment: 1 },
      },
    });
  }
}
