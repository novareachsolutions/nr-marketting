import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS } from '../common/constants/plan-limits';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;

    if (!this.hasOpenAI) {
      this.logger.warn('OpenAI not configured for organic rankings');
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

    // Check cache (7-day TTL)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const cached = await this.prisma.organicRankingsCache.findUnique({
      where: { domain_country: { domain: normalized, country } },
    });

    if (cached && cached.updatedAt > sevenDaysAgo) {
      return cached.data as unknown as OrganicRankingsData;
    }

    if (!this.hasOpenAI) {
      throw new BadRequestException('OpenAI API key is not configured');
    }

    const data = await this.fetchFromOpenAI(normalized, country);

    // Upsert cache
    await this.prisma.organicRankingsCache.upsert({
      where: { domain_country: { domain: normalized, country } },
      create: { domain: normalized, country, data: data as any },
      update: { data: data as any },
    });

    await this.incrementUsage(userId);

    return data;
  }

  // ─── OPENAI FETCH ─────────────────────────────────────────

  private async fetchFromOpenAI(
    domain: string,
    country: string,
  ): Promise<OrganicRankingsData> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `SEO analyst. Return JSON with organic ranking estimates for a domain.
{"summary":{"totalOrganicKeywords":<int>,"organicMonthlyTraffic":<int>,"organicTrafficCost":<float>,"brandedTrafficPercent":<int>,"nonBrandedTrafficPercent":<int>},"positions":[{"keyword":"<str>","position":<1-100>,"previousPosition":<int|null>,"volume":<int>,"trafficPercent":<float>,"trafficCost":<float>,"url":"<path>","serpFeatures":[],"intent":"informational","kd":<0-100>,"cpc":<float>,"lastUpdated":"2026-04-01"}] 10 items,"positionChanges":[{"keyword":"<str>","changeType":"improved","oldPosition":<int|null>,"newPosition":<int|null>,"change":<int>,"volume":<int>,"url":"<path>","trafficImpact":<int>}] 8 items (2 each: improved/declined/new/lost),"competitors":[{"domain":"<str>","commonKeywords":<int>,"seKeywords":<int>,"seTraffic":<int>,"trafficCost":<float>,"paidKeywords":<int>}] 5 items,"pages":[{"url":"<path>","trafficPercent":<float>,"keywords":<int>,"traffic":<int>}] 5 items}
Be realistic. Short URLs.`,
            },
            {
              role: 'user',
              content: `Domain: "${domain}"\nCountry: ${country}`,
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

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true },
    });

    const plan = subscription?.plan || 'FREE';
    const limit = PLAN_LIMITS[plan].maxOrganicRankingsPerDay;

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
        limit: limit === -1 ? 999999 : limit,
        period,
      },
      update: {
        count: { increment: 1 },
      },
    });
  }
}
