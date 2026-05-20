import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  callOpenAIJson,
  callOpenAIJsonWithSearch,
  isWebSearchEnabled,
} from '../common/utils/openai';

type BacklinkGapType = 'best' | 'weak' | 'strong' | 'shared' | 'unique';

interface ReferringDomain {
  domain: string;
  authorityScore: number;
  monthlyVisits: number;
  matches: number;
  backlinksPerDomain: Record<string, number>;
  gapType: BacklinkGapType;
}

interface BacklinkGapData {
  domains: string[];
  country: string;
  summary: {
    totalReferringDomains: number;
    best: number;
    weak: number;
    strong: number;
    shared: number;
    unique: number;
  };
  backlinkTrend: Record<string, any>[];
  referringDomains: ReferringDomain[];
}

@Injectable()
export class BacklinkGapService {
  private readonly logger = new Logger(BacklinkGapService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('ANTHROPIC_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;

    if (!this.hasOpenAI) {
      this.logger.warn('OpenAI not configured for backlink gap');
    }
  }

  async getBacklinkGap(
    domainsInput: string,
    country: string,
    userId: string,
  ): Promise<BacklinkGapData> {
    const domains = domainsInput
      .split(',')
      .map((d) => this.normalizeDomain(d))
      .filter(Boolean);

    if (domains.length < 2) throw new BadRequestException('At least 2 domains are required');
    if (domains.length > 5) throw new BadRequestException('Maximum 5 domains allowed');

    const cacheKey = [...domains].sort().join('|') + '|' + country + '|blgap';

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const cached = await this.prisma.backlinkGapCache.findUnique({
      where: { cacheKey },
    });

    if (cached && cached.updatedAt > sevenDaysAgo) {
      return cached.data as unknown as BacklinkGapData;
    }

    if (!this.hasOpenAI) throw new BadRequestException('OpenAI API key is not configured');

    const data = await this.fetchFromOpenAI(domains, country);

    await this.prisma.backlinkGapCache.upsert({
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
  ): Promise<BacklinkGapData> {
    try {
      const yourDomain = domains[0];
      const competitors = domains.slice(1);
      const useSearch = isWebSearchEnabled('backlink-gap');

      const baseSystem = `SEO backlink gap analyst. First domain="you", rest=competitors. Return JSON:
{"summary":{"totalReferringDomains":<int>,"best":<int>,"weak":<int>,"strong":<int>,"shared":<int>,"unique":<int>},"backlinkTrend":[{"date":"YYYY-MM","dom1":<int>,"dom2":<int>}] 6 months,"referringDomains":[{"domain":"<str>","authorityScore":<0-100>,"monthlyVisits":<int>,"matches":<int>,"backlinksPerDomain":{"dom1":<int>,"dom2":<int>},"gapType":"best"}] 15 items}
gapType: best=links to all competitors not you, weak=links to you less than competitors, strong=links to you not competitors, shared=links to you+competitors, unique=links to only one domain. Use actual domain names as keys. Mix: 4 best,3 weak,3 strong,3 shared,2 unique.`;

      const systemPrompt = useSearch
        ? baseSystem +
          `\nUse web search to find sites that actually link to each domain (search the web for mentions/links). Use real referring domains and their actual link counts where discoverable; estimate conservatively where they aren't.`
        : baseSystem + `\nRealistic referring domains.`;

      const userPrompt = `Your domain: "${yourDomain}"\nCompetitors: ${competitors.join(', ')}\nCountry: ${country}`;

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
        domains,
        country,
        summary: parsed.summary || { totalReferringDomains: 0, best: 0, weak: 0, strong: 0, shared: 0, unique: 0 },
        backlinkTrend: Array.isArray(parsed.backlinkTrend) ? parsed.backlinkTrend : [],
        referringDomains: Array.isArray(parsed.referringDomains) ? parsed.referringDomains : [],
      };
    } catch (err: any) {
      const detail = err?.response?.data || err?.message || err;
      this.logger.error(`OpenAI backlink gap error: ${JSON.stringify(detail)}`);
      throw new BadRequestException(`Backlink gap failed: ${err?.message || 'Unknown error'}`);
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
          metric: 'BACKLINK_GAP',
          period,
        },
      },
      create: {
        userId,
        metric: 'BACKLINK_GAP',
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
