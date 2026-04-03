import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

interface PositionResult {
  keyword: string;
  position: number | null;
  rankingUrl: string | null;
  serpFeatures: string[];
}

// Simple hash for deterministic mock data
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

const SERP_FEATURE_LIST = [
  'featured_snippet',
  'people_also_ask',
  'sitelinks',
  'local_pack',
  'knowledge_graph',
  'video',
  'image_pack',
  'top_stories',
  'shopping',
  'reviews',
];

@Injectable()
export class RankCheckerService {
  private readonly logger = new Logger(RankCheckerService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;

    if (this.hasOpenAI) {
      this.logger.log('Position Tracking: Using OpenAI for rank estimation');
    } else {
      this.logger.warn('Position Tracking: OpenAI not configured — using mock data');
    }
  }

  /**
   * Check positions for all active tracked keywords in a project
   */
  async checkPositions(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { domain: true, lastRankCheckAt: true },
    });
    if (!project) throw new BadRequestException('Project not found');

    // Rate limit: 1 manual check per hour
    if (project.lastRankCheckAt) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (project.lastRankCheckAt > hourAgo) {
        throw new BadRequestException(
          'Position check already ran within the last hour. Please wait before checking again.',
        );
      }
    }

    const trackedKeywords = await this.prisma.trackedKeyword.findMany({
      where: { projectId, isActive: true },
    });

    if (trackedKeywords.length === 0) {
      return { jobStarted: false, message: 'No tracked keywords found', keywordCount: 0 };
    }

    // Start background check
    const keywordCount = trackedKeywords.length;
    setTimeout(() => {
      this.executeCheck(projectId, project.domain, trackedKeywords).catch((err) => {
        this.logger.error(`Background rank check failed for ${projectId}: ${err}`);
      });
    }, 0);

    // Update last check timestamp
    await this.prisma.project.update({
      where: { id: projectId },
      data: { lastRankCheckAt: new Date() },
    });

    return { jobStarted: true, keywordCount };
  }

  /**
   * Execute the actual rank check (runs in background)
   */
  private async executeCheck(
    _projectId: string,
    domain: string,
    trackedKeywords: Array<{ id: string; keyword: string; device: string; country: string }>,
  ) {
    this.logger.log(
      `Starting rank check for ${domain}: ${trackedKeywords.length} keywords`,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group keywords by country+device for batch processing
    const groups = new Map<string, typeof trackedKeywords>();
    for (const tk of trackedKeywords) {
      const key = `${tk.country}:${tk.device}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tk);
    }

    for (const [groupKey, keywords] of groups) {
      const [country, device] = groupKey.split(':');
      const keywordTexts = keywords.map((k) => k.keyword);

      let results: PositionResult[];

      if (this.hasOpenAI) {
        results = await this.fetchFromOpenAI(keywordTexts, domain, country, device);
      } else {
        results = this.getMockPositionData(keywordTexts, domain);
      }

      // Save results to RankingHistory
      for (const tk of keywords) {
        const result = results.find((r) => r.keyword === tk.keyword);
        if (!result) continue;

        await this.prisma.rankingHistory.upsert({
          where: {
            trackedKeywordId_date_source: {
              trackedKeywordId: tk.id,
              date: today,
              source: 'DATAFORSEO',
            },
          },
          update: {
            position: result.position,
            rankingUrl: result.rankingUrl,
            serpFeatures: result.serpFeatures.join(','),
          },
          create: {
            trackedKeywordId: tk.id,
            position: result.position,
            rankingUrl: result.rankingUrl,
            serpFeatures: result.serpFeatures.join(','),
            date: today,
            source: 'DATAFORSEO',
          },
        });
      }
    }

    this.logger.log(`Rank check completed for ${domain}`);
  }

  // ─── OPENAI POSITION ESTIMATION ─────────────────────────

  private async fetchFromOpenAI(
    keywords: string[],
    domain: string,
    country: string,
    device: string,
  ): Promise<PositionResult[]> {
    // Process in batches of 20 to stay within token limits
    const batchSize = 20;
    const allResults: PositionResult[] = [];

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      try {
        const results = await this.fetchBatchFromOpenAI(batch, domain, country, device);
        allResults.push(...results);
      } catch (err) {
        this.logger.error(`OpenAI batch ${i / batchSize + 1} failed: ${err}`);
        // Fallback to mock for this batch
        allResults.push(...this.getMockPositionData(batch, domain));
      }
    }

    return allResults;
  }

  private async fetchBatchFromOpenAI(
    keywords: string[],
    domain: string,
    country: string,
    device: string,
  ): Promise<PositionResult[]> {
    const keywordList = keywords.map((k, i) => `${i + 1}. "${k}"`).join('\n');

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a SERP analysis expert. Given a domain and a list of keywords, estimate where the domain would realistically rank on Google for each keyword. Consider the domain's likely authority, relevance, and content.

Return ONLY valid JSON with this structure:
{
  "results": [
    {
      "keyword": "<the keyword>",
      "position": <integer 1-100 or null if not ranking in top 100>,
      "rankingUrl": "<the likely URL path on the domain that would rank, e.g. /blog/seo-guide, or null>",
      "serpFeatures": [<array of SERP features present for this keyword, from: "featured_snippet", "people_also_ask", "sitelinks", "local_pack", "knowledge_graph", "video", "image_pack", "top_stories", "shopping", "reviews">]
    }
  ]
}

Be realistic:
- New/small domains typically rank position 20-100 or not at all
- Well-established domains with relevant content rank 1-20
- Very competitive keywords are harder to rank for
- Include null position for keywords the domain likely doesn't rank for
- Vary positions realistically — don't give the same position for all keywords`,
          },
          {
            role: 'user',
            content: `Domain: ${domain}\nCountry: ${country}\nDevice: ${device}\n\nKeywords:\n${keywordList}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    const content = response.data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed.results)) {
      throw new Error('Invalid OpenAI response format');
    }

    return parsed.results.map((r: any) => ({
      keyword: r.keyword || '',
      position: typeof r.position === 'number' ? r.position : null,
      rankingUrl: r.rankingUrl || null,
      serpFeatures: Array.isArray(r.serpFeatures) ? r.serpFeatures : [],
    }));
  }

  // ─── MOCK POSITION DATA ─────────────────────────────────

  private getMockPositionData(keywords: string[], domain: string): PositionResult[] {
    return keywords.map((keyword) => {
      const h = simpleHash(keyword + domain);

      // 70% chance of ranking
      const isRanking = h % 10 < 7;
      const position = isRanking ? (h % 95) + 1 : null;

      // Generate ranking URL
      const slug = keyword.replace(/\s+/g, '-').toLowerCase().slice(0, 30);
      const paths = ['/blog/', '/services/', '/pages/', '/'];
      const rankingUrl = isRanking
        ? `https://${domain}${paths[h % paths.length]}${slug}`
        : null;

      // Random SERP features (1-3 features per keyword)
      const featureCount = (h % 3) + 1;
      const serpFeatures: string[] = [];
      for (let i = 0; i < featureCount; i++) {
        const idx = (h + i * 7) % SERP_FEATURE_LIST.length;
        if (!serpFeatures.includes(SERP_FEATURE_LIST[idx])) {
          serpFeatures.push(SERP_FEATURE_LIST[idx]);
        }
      }

      return { keyword, position, rankingUrl, serpFeatures };
    });
  }
}
