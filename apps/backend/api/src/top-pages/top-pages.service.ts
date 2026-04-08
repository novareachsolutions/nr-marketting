import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeDomain } from '../common/utils/domain';
import { callOpenAIJson } from '../common/utils/openai';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;

    if (!this.hasOpenAI) {
      this.logger.warn('OpenAI not configured for top pages');
    }
  }

  async getTopPages(
    domain: string,
    country: string,
    userId: string,
  ): Promise<TopPagesData> {
    const normalized = normalizeDomain(domain);
    if (!normalized) throw new BadRequestException('Invalid domain');

    // Check cache (7-day TTL)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const cached = await this.prisma.topPagesCache.findUnique({
      where: { domain_country: { domain: normalized, country } },
    });

    if (cached && cached.updatedAt > sevenDaysAgo) {
      return cached.data as unknown as TopPagesData;
    }

    if (!this.hasOpenAI) throw new BadRequestException('OpenAI API key is not configured');

    const data = await this.fetchFromOpenAI(normalized, country);

    await this.prisma.topPagesCache.upsert({
      where: { domain_country: { domain: normalized, country } },
      create: { domain: normalized, country, data: data as any },
      update: { data: data as any },
    });

    await incrementDailyUsage(this.prisma, userId, 'TOP_PAGES');

    return data;
  }

  private async fetchFromOpenAI(domain: string, country: string): Promise<TopPagesData> {
    try {
      const parsed = await callOpenAIJson({
        apiKey: this.openaiKey,
        systemPrompt: `SEO analyst. Return JSON estimating top pages for a domain.
{"summary":{"totalPages":<int>,"totalOrganicTraffic":<int>,"avgKeywordsPerPage":<int>},"pages":[{"url":"<path>","traffic":<int>,"trafficPercent":<float>,"keywords":<int>,"topKeyword":"<str>","topKeywordPosition":<1-100>,"backlinks":<int>,"trafficTrend":[<6 ints>]}] 10 items by traffic desc}
Short paths. Realistic.`,
        userPrompt: `Domain: "${domain}"\nCountry: ${country}`,
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
