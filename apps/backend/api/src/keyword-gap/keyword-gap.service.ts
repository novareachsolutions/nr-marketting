import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

type GapType = 'shared' | 'missing' | 'weak' | 'strong' | 'untapped' | 'unique';
type SearchIntent = 'informational' | 'navigational' | 'commercial' | 'transactional';

interface GapKeyword {
  keyword: string;
  volume: number;
  kd: number;
  cpc: number;
  intent: SearchIntent;
  positions: Record<string, number | null>;
  gapType: GapType;
}

interface KeywordGapData {
  domains: string[];
  country: string;
  summary: {
    totalKeywords: number;
    shared: number;
    missing: number;
    weak: number;
    strong: number;
    untapped: number;
    unique: number;
  };
  keywords: GapKeyword[];
}

@Injectable()
export class KeywordGapService {
  private readonly logger = new Logger(KeywordGapService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;

    if (!this.hasOpenAI) {
      this.logger.warn('OpenAI not configured for keyword gap');
    }
  }

  async getKeywordGap(
    domainsInput: string,
    country: string,
    userId: string,
  ): Promise<KeywordGapData> {
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

    const cacheKey = [...domains].sort().join('|') + '|' + country + '|gap';

    // Check cache (7-day TTL)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const cached = await this.prisma.keywordGapCache.findUnique({
      where: { cacheKey },
    });

    if (cached && cached.updatedAt > sevenDaysAgo) {
      return cached.data as unknown as KeywordGapData;
    }

    if (!this.hasOpenAI) {
      throw new BadRequestException('OpenAI API key is not configured');
    }

    const data = await this.fetchFromOpenAI(domains, country);

    await this.prisma.keywordGapCache.upsert({
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
  ): Promise<KeywordGapData> {
    try {
      const yourDomain = domains[0];
      const competitors = domains.slice(1);

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
              content: `SEO keyword gap analyst. First domain="you", rest=competitors. Return JSON:
{"summary":{"totalKeywords":<int>,"shared":<int>,"missing":<int>,"weak":<int>,"strong":<int>,"untapped":<int>,"unique":<int>},"keywords":[{"keyword":"<str>","volume":<int>,"kd":<0-100>,"cpc":<float>,"intent":"informational","positions":{"dom1":<int|null>},"gapType":"shared"}] 15 items}
gapType: shared=all rank, missing=competitors rank you don't, weak=you lower, strong=you higher, untapped=you don't rank 1+ competitor does, unique=only you. Use actual domain names. Mix: 3 shared,3 missing,2 weak,3 strong,2 untapped,2 unique. Realistic.`,
            },
            {
              role: 'user',
              content: `Your domain: "${yourDomain}"\nCompetitors: ${competitors.join(', ')}\nCountry: ${country}`,
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
        domains,
        country,
        summary: parsed.summary || { totalKeywords: 0, shared: 0, missing: 0, weak: 0, strong: 0, untapped: 0, unique: 0 },
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      };
    } catch (err: any) {
      const detail = err?.response?.data || err?.message || err;
      this.logger.error(`OpenAI keyword gap error: ${JSON.stringify(detail)}`);
      throw new BadRequestException(`Keyword gap failed: ${err?.message || 'Unknown error'}`);
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
          metric: 'KEYWORD_GAP',
          period,
        },
      },
      create: {
        userId,
        metric: 'KEYWORD_GAP',
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
