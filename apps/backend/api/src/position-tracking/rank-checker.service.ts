import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  callOpenAIJson,
  callOpenAIJsonWithSearch,
  isWebSearchEnabled,
} from '../common/utils/openai';
import {
  serpApiSearch,
  isSerpApiConfigured,
  findDomainPosition,
} from '../common/utils/serpapi';

interface PositionResult {
  keyword: string;
  position: number | null;
  rankingUrl: string | null;
  serpFeatures: string[];
}

@Injectable()
export class RankCheckerService {
  private readonly logger = new Logger(RankCheckerService.name);
  private readonly serpApiKey: string;
  private readonly hasSerpApi: boolean;
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.serpApiKey = this.config.get<string>('SERPAPI_KEY') || '';
    this.hasSerpApi = isSerpApiConfigured(this.serpApiKey);
    this.openaiKey = this.config.get<string>('ANTHROPIC_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;

    if (this.hasSerpApi) {
      this.logger.log('Position Tracking: Using SerpAPI for real Google rank checks');
    } else if (this.hasOpenAI) {
      this.logger.log('Position Tracking: SerpAPI not configured — falling back to Anthropic estimation');
    } else {
      this.logger.error('Position Tracking: Neither SerpAPI nor Anthropic configured — rank checks will throw 503');
    }
  }

  /**
   * Check positions for all active tracked keywords in a project.
   * If `country` is provided, all active keywords are first updated to that
   * country (e.g. "AU"), then checked on the correct Google domain.
   */
  async checkPositions(projectId: string, country?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { domain: true, lastRankCheckAt: true },
    });
    if (!project) throw new BadRequestException('Project not found');

    // Apply the selected country to all active keywords before checking
    const normalizedCountry = country?.trim().toUpperCase();
    if (normalizedCountry) {
      await this.prisma.trackedKeyword.updateMany({
        where: { projectId, isActive: true },
        data: { country: normalizedCountry },
      });
    }

    const trackedKeywords = await this.prisma.trackedKeyword.findMany({
      where: { projectId, isActive: true },
    });

    if (trackedKeywords.length === 0) {
      return { jobStarted: false, message: 'No tracked keywords found', keywordCount: 0 };
    }

    if (!this.hasSerpApi && !this.hasOpenAI) {
      throw new ServiceUnavailableException(
        'Rank checks require SERPAPI_KEY or ANTHROPIC_API_KEY',
      );
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

    return { jobStarted: true, keywordCount, country: normalizedCountry || null };
  }

  /**
   * Check a single tracked keyword on demand. Runs synchronously and returns
   * the resolved position so the UI can update the row immediately.
   * Skips the project-level hourly rate limit since this is an explicit
   * per-keyword action.
   */
  async checkSingleKeywordPosition(projectId: string, keywordId: string) {
    if (!this.hasSerpApi && !this.hasOpenAI) {
      throw new ServiceUnavailableException(
        'Rank checks require SERPAPI_KEY or ANTHROPIC_API_KEY',
      );
    }

    const tk = await this.prisma.trackedKeyword.findFirst({
      where: { id: keywordId, projectId },
    });
    if (!tk) {
      throw new NotFoundException('Tracked keyword not found in this project');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { domain: true },
    });
    if (!project) throw new BadRequestException('Project not found');

    this.logger.log(
      `Single rank check for "${tk.keyword}" on ${project.domain} (${tk.country}/${tk.device})`,
    );

    const results: PositionResult[] = this.hasSerpApi
      ? await this.fetchFromSerpApi([tk.keyword], project.domain, tk.country, tk.device)
      : await this.fetchFromOpenAI([tk.keyword], project.domain, tk.country, tk.device);

    const result = results[0];
    if (!result) {
      throw new ServiceUnavailableException(
        'Rank check failed — provider returned no result',
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const saved = await this.prisma.rankingHistory.upsert({
      where: {
        trackedKeywordId_date_source: {
          trackedKeywordId: tk.id,
          date: today,
          source: 'SERPAPI',
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
        source: 'SERPAPI',
      },
    });

    return {
      keywordId: tk.id,
      keyword: tk.keyword,
      country: tk.country,
      device: tk.device,
      position: saved.position,
      rankingUrl: saved.rankingUrl,
      serpFeatures: result.serpFeatures,
      date: saved.date,
      source: saved.source,
    };
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

      if (this.hasSerpApi) {
        results = await this.fetchFromSerpApi(keywordTexts, domain, country, device);
      } else {
        results = await this.fetchFromOpenAI(keywordTexts, domain, country, device);
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
              source: 'SERPAPI',
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
            source: 'SERPAPI',
          },
        });
      }
    }

    this.logger.log(`Rank check completed for ${domain}`);
  }

  // ─── SERPAPI REAL RANK CHECK ────────────────────────────

  /**
   * Fetch real Google SERP positions via SerpAPI. One request per keyword,
   * serially, to respect the rate limit. Keywords that fail are skipped
   * (no row written) — they will be retried on the next check.
   */
  private async fetchFromSerpApi(
    keywords: string[],
    domain: string,
    country: string,
    device: string,
  ): Promise<PositionResult[]> {
    const results: PositionResult[] = [];

    for (const keyword of keywords) {
      try {
        const searchResult = await serpApiSearch({
          apiKey: this.serpApiKey,
          query: keyword,
          country,
          device: device as 'desktop' | 'mobile' | 'tablet',
          num: 100,
        });

        const { position, rankingUrl } = findDomainPosition(
          searchResult.organicResults,
          domain,
        );

        results.push({
          keyword,
          position,
          rankingUrl,
          serpFeatures: searchResult.serpFeatures,
        });
      } catch (err) {
        this.logger.error(`SerpAPI rank check failed for "${keyword}": ${err}`);
        // Skip this keyword — no row written; will be retried next check
      }
    }

    return results;
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
        // Skip this batch — no rows written; will be retried next check
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
    const useSearch = isWebSearchEnabled('position-tracking');

    const baseSystem = `You are a SERP analysis expert. Given a domain and a list of keywords, determine where the domain ranks on Google for each keyword.

Return ONLY valid JSON with this structure:
{
  "results": [
    {
      "keyword": "<the keyword>",
      "position": <integer 1-100 or null if not ranking in top 100>,
      "rankingUrl": "<the URL on the domain that ranks, or null>",
      "serpFeatures": [<array of SERP features present for this keyword, from: "featured_snippet", "people_also_ask", "sitelinks", "local_pack", "knowledge_graph", "video", "image_pack", "top_stories", "shopping", "reviews">]
    }
  ]
}`;

    const searchSystem =
      baseSystem +
      `\n\nUse web search to look up the live Google SERP for each keyword in the requested country. Report the actual position of the domain (1-100) and the actual URL that ranks. If the domain is not in the top 100, return null. Identify SERP features visible in the results.`;

    const estimateSystem =
      baseSystem +
      `\n\nBe realistic:
- New/small domains typically rank position 20-100 or not at all
- Well-established domains with relevant content rank 1-20
- Very competitive keywords are harder to rank for
- Include null position for keywords the domain likely doesn't rank for
- Vary positions realistically — don't give the same position for all keywords`;

    const userPrompt = `Domain: ${domain}\nCountry: ${country}\nDevice: ${device}\n\nKeywords:\n${keywordList}`;

    const parsed: any = useSearch
      ? await callOpenAIJsonWithSearch({
          apiKey: this.openaiKey,
          systemPrompt: searchSystem,
          userPrompt,
          country,
          temperature: 0.2,
          maxTokens: 4000,
        })
      : await callOpenAIJson({
          apiKey: this.openaiKey,
          systemPrompt: estimateSystem,
          userPrompt,
          temperature: 0.3,
          maxTokens: 3000,
          timeout: 30000,
        });

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

}
