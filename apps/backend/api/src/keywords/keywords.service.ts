import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { callOpenAIJson } from '../common/utils/openai';
import {
  serpApiSearch,
  serpApiAutocomplete,
  isSerpApiConfigured,
} from '../common/utils/serpapi';

type SearchIntent = 'INFORMATIONAL' | 'NAVIGATIONAL' | 'COMMERCIAL' | 'TRANSACTIONAL';

interface KeywordData {
  keyword: string;
  country: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  trend: number[] | null;
  competition: string;
  intent: SearchIntent;
  wordCount: number;
  isQuestion: boolean;
  priorityScore: number; // 0-100 composite score
}

interface KeywordSuggestion {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  competition: string;
  intent: SearchIntent;
  wordCount: number;
  isQuestion: boolean;
  priorityScore: number;
}

@Injectable()
export class KeywordsService {
  private readonly logger = new Logger(KeywordsService.name);
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

    if (this.hasSerpApi && this.hasOpenAI) {
      this.logger.log(
        'Keywords: Using SerpAPI for discovery + Anthropic for metric estimation',
      );
    } else if (this.hasSerpApi) {
      this.logger.log(
        'Keywords: Using SerpAPI for discovery — metrics will be null (Anthropic not configured)',
      );
    } else if (this.hasOpenAI) {
      this.logger.warn(
        'Keywords: SerpAPI not configured — using Anthropic-only estimates',
      );
    } else {
      this.logger.error(
        'Keywords: Neither SerpAPI nor Anthropic configured — endpoints will throw 503',
      );
    }
  }

  // ─── SEARCH KEYWORD ─────────────────────────────────────

  async searchKeyword(
    keyword: string,
    country: string = 'US',
  ): Promise<KeywordData> {
    const normalized = keyword.trim().toLowerCase();

    // Check cache (within 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const cached = await this.prisma.keywordCache.findUnique({
      where: { keyword_country: { keyword: normalized, country } },
    });

    if (cached && cached.updatedAt > thirtyDaysAgo) {
      return this.enrichKeywordData({
        keyword: cached.keyword,
        country: cached.country,
        searchVolume: cached.searchVolume,
        difficulty: cached.difficulty,
        cpc: cached.cpc,
        trend: cached.trend as number[] | null,
        competition: this.difficultyToCompetition(cached.difficulty),
        intent: 'INFORMATIONAL',
        wordCount: 0,
        isQuestion: false,
        priorityScore: 0,
      });
    }

    // SerpAPI has no volume/CPC/KD, so single-keyword lookup always needs Anthropic.
    if (!this.hasOpenAI) {
      throw new ServiceUnavailableException(
        'Keyword search requires ANTHROPIC_API_KEY to estimate volume/CPC/KD',
      );
    }
    let data: KeywordData = await this.fetchFromOpenAI(normalized, country);

    // Enrich with intent + priority
    data = this.enrichKeywordData(data);

    // Upsert cache
    await this.prisma.keywordCache.upsert({
      where: { keyword_country: { keyword: normalized, country } },
      create: {
        keyword: normalized,
        country,
        searchVolume: data.searchVolume,
        difficulty: data.difficulty,
        cpc: data.cpc,
        trend: data.trend,
      },
      update: {
        searchVolume: data.searchVolume,
        difficulty: data.difficulty,
        cpc: data.cpc,
        trend: data.trend,
      },
    });

    return data;
  }

  // ─── GET SUGGESTIONS ────────────────────────────────────

  async getSuggestions(
    keyword: string,
    country: string = 'US',
    limit: number = 50,
    page: number = 1,
    filters?: {
      minVolume?: number;
      maxVolume?: number;
      minKd?: number;
      maxKd?: number;
      intent?: string;
      questionsOnly?: boolean;
      minWords?: number;
      maxWords?: number;
      matchType?: 'broad' | 'phrase' | 'exact' | 'questions';
      includeWords?: string;
      excludeWords?: string;
    },
  ): Promise<{ keywords: KeywordSuggestion[]; total: number; clusters?: Record<string, KeywordSuggestion[]> }> {
    const normalized = keyword.trim().toLowerCase();

    let result: { keywords: KeywordSuggestion[]; total: number };
    if (this.hasSerpApi) {
      result = await this.fetchSuggestionsFromSerpApi(normalized, country, limit * 3);
    } else if (this.hasOpenAI) {
      result = await this.fetchSuggestionsFromOpenAI(normalized, country, limit * 2);
    } else {
      throw new ServiceUnavailableException(
        'Keyword suggestions require SERPAPI_KEY or ANTHROPIC_API_KEY',
      );
    }

    // Enrich all results
    result.keywords = result.keywords.map((kw) => this.enrichSuggestion(kw));

    // Apply match type filter
    if (filters?.matchType === 'phrase') {
      result.keywords = result.keywords.filter((kw) => kw.keyword.includes(normalized));
    } else if (filters?.matchType === 'exact') {
      result.keywords = result.keywords.filter((kw) => kw.keyword === normalized);
    } else if (filters?.matchType === 'questions') {
      result.keywords = result.keywords.filter((kw) => kw.isQuestion);
    }

    // Apply filters
    if (filters) {
      if (filters.minVolume !== undefined)
        result.keywords = result.keywords.filter((kw) => (kw.searchVolume ?? 0) >= filters.minVolume!);
      if (filters.maxVolume !== undefined)
        result.keywords = result.keywords.filter((kw) => (kw.searchVolume ?? 0) <= filters.maxVolume!);
      if (filters.minKd !== undefined)
        result.keywords = result.keywords.filter((kw) => (kw.difficulty ?? 0) >= filters.minKd!);
      if (filters.maxKd !== undefined)
        result.keywords = result.keywords.filter((kw) => (kw.difficulty ?? 0) <= filters.maxKd!);
      if (filters.intent)
        result.keywords = result.keywords.filter((kw) => kw.intent === filters.intent);
      if (filters.questionsOnly)
        result.keywords = result.keywords.filter((kw) => kw.isQuestion);
      if (filters.minWords !== undefined)
        result.keywords = result.keywords.filter((kw) => kw.wordCount >= filters.minWords!);
      if (filters.maxWords !== undefined)
        result.keywords = result.keywords.filter((kw) => kw.wordCount <= filters.maxWords!);
      if (filters.includeWords) {
        const words = filters.includeWords.toLowerCase().split(',').map((w) => w.trim());
        result.keywords = result.keywords.filter((kw) => words.some((w) => kw.keyword.includes(w)));
      }
      if (filters.excludeWords) {
        const words = filters.excludeWords.toLowerCase().split(',').map((w) => w.trim());
        result.keywords = result.keywords.filter((kw) => !words.some((w) => kw.keyword.includes(w)));
      }
    }

    // Generate clusters
    const clusters = this.clusterKeywords(result.keywords);

    // Paginate after filtering
    const total = result.keywords.length;
    const start = (page - 1) * limit;
    const paginated = result.keywords.slice(start, start + limit);

    return { keywords: paginated, total, clusters };
  }

  // ─── PROJECT KEYWORDS ───────────────────────────────────

  async getProjectKeywords(
    projectId: string,
    page: number = 1,
    perPage: number = 50,
  ) {
    const skip = (page - 1) * perPage;

    const [keywords, total] = await Promise.all([
      this.prisma.projectKeyword.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.projectKeyword.count({ where: { projectId } }),
    ]);

    // Bulk-fetch cached metrics in one query (any country — prefer most recent)
    const cacheRows = await this.prisma.keywordCache.findMany({
      where: { keyword: { in: keywords.map((k) => k.keyword) } },
      orderBy: { updatedAt: 'desc' },
    });
    const cacheByKeyword = new Map<string, (typeof cacheRows)[number]>();
    for (const c of cacheRows) {
      if (!cacheByKeyword.has(c.keyword)) cacheByKeyword.set(c.keyword, c);
    }

    const enrichedKeywords = keywords.map((kw) => {
      const cached = cacheByKeyword.get(kw.keyword);
      const intent = this.classifyIntent(kw.keyword);
      const difficulty = cached?.difficulty ?? null;
      const searchVolume = cached?.searchVolume ?? null;
      const cpc = cached?.cpc ?? null;
      return {
        ...kw,
        searchVolume,
        difficulty,
        cpc,
        competition: this.difficultyToCompetition(difficulty),
        intent,
        isQuestion: this.isQuestionKeyword(kw.keyword),
        wordCount: this.getWordCount(kw.keyword),
        priorityScore: this.calculatePriorityScore(searchVolume, difficulty, intent),
      };
    });

    return {
      keywords: enrichedKeywords,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  async saveKeyword(
    projectId: string,
    keyword: string,
    targetUrl?: string,
    notes?: string,
  ) {
    const normalized = keyword.trim().toLowerCase();

    try {
      return await this.prisma.projectKeyword.create({
        data: {
          projectId,
          keyword: normalized,
          targetUrl: targetUrl || null,
          notes: notes || null,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException(
          `Keyword "${normalized}" is already saved to this project`,
        );
      }
      throw err;
    }
  }

  async removeKeyword(projectId: string, keywordId: string) {
    const kw = await this.prisma.projectKeyword.findFirst({
      where: { id: keywordId, projectId },
    });

    if (!kw) {
      throw new NotFoundException('Keyword not found in this project');
    }

    await this.prisma.projectKeyword.delete({ where: { id: keywordId } });

    return { message: 'Keyword removed' };
  }

  // ─── KEYWORD GAP ANALYSIS ─────────────────────────────

  async getKeywordGap(projectId: string, competitorDomains: string[]) {
    // Get the project domain
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { domain: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    // Get saved keywords for the project (your keywords)
    const projectKeywords = await this.prisma.projectKeyword.findMany({
      where: { projectId },
      select: { keyword: true },
    });

    const yourKeywords = new Set(projectKeywords.map((k) => k.keyword.toLowerCase()));

    // For each competitor, get suggestions based on their domain name
    const competitorKeywords: Record<string, Map<string, KeywordSuggestion>> = {};

    for (const domain of competitorDomains.slice(0, 4)) {
      competitorKeywords[domain] = new Map();
      // Extract meaningful words from domain (e.g., "example-seo-tools.com" → "seo tools")
      const domainWords = domain.replace(/\.(com|org|net|io|co|au|uk)$/i, '')
        .replace(/^www\./, '')
        .replace(/[-_.]/g, ' ')
        .trim();

      // Get suggestions for the domain's core terms
      let result: { keywords: KeywordSuggestion[]; total: number };
      if (this.hasSerpApi) {
        result = await this.fetchSuggestionsFromSerpApi(domainWords, 'US', 100);
      } else if (this.hasOpenAI) {
        result = await this.fetchSuggestionsFromOpenAI(domainWords, 'US', 50);
      } else {
        throw new ServiceUnavailableException(
          'Keyword gap analysis requires SERPAPI_KEY or ANTHROPIC_API_KEY',
        );
      }

      // Preserve enriched suggestion data (metrics from SerpAPI+Anthropic) keyed by lowercased keyword
      for (const k of result.keywords) {
        const enriched = this.enrichSuggestion(k);
        competitorKeywords[domain].set(enriched.keyword.toLowerCase(), enriched);
      }
    }

    // Compute gap categories — keep best-known metrics per keyword across all competitors
    const allCompetitorKws = new Map<string, KeywordSuggestion>();
    for (const kwMap of Object.values(competitorKeywords)) {
      for (const [kw, sug] of kwMap) {
        if (!allCompetitorKws.has(kw)) allCompetitorKws.set(kw, sug);
      }
    }

    const missing: KeywordSuggestion[] = []; // Competitors have, you don't
    const shared: string[] = [];   // Both have
    const unique: string[] = [];   // Only you have

    for (const [kw, sug] of allCompetitorKws) {
      if (!yourKeywords.has(kw)) {
        // Real metrics from SerpAPI+Anthropic discovery (or null if Anthropic absent)
        missing.push(sug);
      } else {
        shared.push(kw);
      }
    }

    for (const kw of yourKeywords) {
      if (!allCompetitorKws.has(kw)) unique.push(kw);
    }

    // Sort missing by priority score descending
    missing.sort((a, b) => b.priorityScore - a.priorityScore);

    return {
      yourDomain: project.domain,
      competitors: competitorDomains,
      yourKeywordCount: yourKeywords.size,
      summary: {
        missing: missing.length,
        shared: shared.length,
        unique: unique.length,
      },
      missingKeywords: missing.slice(0, 100), // Top 100 opportunities
      sharedKeywords: shared.slice(0, 50),
      uniqueKeywords: unique.slice(0, 50),
    };
  }

  // ─── EXPORT PROJECT KEYWORDS ────────────────────────────

  async exportProjectKeywords(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { domain: true, name: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    const keywords = await this.prisma.projectKeyword.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich each keyword with cached data
    const enriched = await Promise.all(
      keywords.map(async (kw) => {
        const cached = await this.prisma.keywordCache.findUnique({
          where: { keyword_country: { keyword: kw.keyword, country: 'US' } },
        });

        const intent = this.classifyIntent(kw.keyword);
        const wordCount = this.getWordCount(kw.keyword);
        const isQuestion = this.isQuestionKeyword(kw.keyword);

        return {
          keyword: kw.keyword,
          targetUrl: kw.targetUrl,
          notes: kw.notes,
          searchVolume: cached?.searchVolume ?? null,
          difficulty: cached?.difficulty ?? null,
          cpc: cached?.cpc ?? null,
          competition: this.difficultyToCompetition(cached?.difficulty ?? null),
          intent,
          wordCount,
          isQuestion,
          priorityScore: this.calculatePriorityScore(cached?.searchVolume ?? null, cached?.difficulty ?? null, intent),
          savedAt: kw.createdAt,
        };
      }),
    );

    return {
      project,
      keywords: enriched,
      exportedAt: new Date().toISOString(),
    };
  }

  // ─── SERPAPI KEYWORD DISCOVERY ─────────────────────────

  /**
   * SerpAPI doesn't expose search volume / CPC / KD. We use it for keyword
   * discovery (autocomplete + related searches + People Also Ask) and then
   * batch-estimate metrics via Anthropic when available.
   */
  private async fetchSuggestionsFromSerpApi(
    keyword: string,
    country: string,
    limit: number,
  ): Promise<{ keywords: KeywordSuggestion[]; total: number }> {
    try {
      // Run autocomplete + Google search in parallel to maximize keyword pool
      const [autocompletions, searchResult] = await Promise.all([
        serpApiAutocomplete({
          apiKey: this.serpApiKey,
          query: keyword,
          country,
        }).catch((err) => {
          this.logger.warn(`SerpAPI autocomplete failed: ${err}`);
          return [] as string[];
        }),
        serpApiSearch({
          apiKey: this.serpApiKey,
          query: keyword,
          country,
          num: 100,
        }).catch((err) => {
          this.logger.warn(`SerpAPI search failed: ${err}`);
          return null;
        }),
      ]);

      const discovered = new Set<string>();
      for (const kw of autocompletions) discovered.add(kw.toLowerCase().trim());
      if (searchResult) {
        for (const kw of searchResult.relatedSearches)
          discovered.add(kw.toLowerCase().trim());
        for (const q of searchResult.relatedQuestions)
          discovered.add(q.toLowerCase().trim().replace(/\?$/, ''));
      }

      // Remove the seed keyword itself
      discovered.delete(keyword.toLowerCase().trim());

      if (discovered.size === 0) {
        this.logger.warn(
          `SerpAPI returned no keyword suggestions for "${keyword}"`,
        );
        if (this.hasOpenAI)
          return this.fetchSuggestionsFromOpenAI(keyword, country, limit);
        return { keywords: [], total: 0 };
      }

      const discoveredArray = Array.from(discovered).slice(0, limit);

      // Enrich with Anthropic metric estimates if available
      let enrichedKeywords: KeywordSuggestion[];
      if (this.hasOpenAI) {
        enrichedKeywords = await this.estimateMetricsBatch(
          discoveredArray,
          country,
        );
      } else {
        enrichedKeywords = discoveredArray.map((kw) => ({
          keyword: kw,
          searchVolume: null,
          difficulty: null,
          cpc: null,
          competition: 'UNKNOWN',
          intent: 'INFORMATIONAL' as SearchIntent,
          wordCount: 0,
          isQuestion: false,
          priorityScore: 0,
        }));
      }

      return {
        keywords: enrichedKeywords,
        total: enrichedKeywords.length,
      };
    } catch (err) {
      this.logger.error(`SerpAPI suggestions error: ${err}`);
      if (this.hasOpenAI)
        return this.fetchSuggestionsFromOpenAI(keyword, country, limit);
      throw new ServiceUnavailableException('SerpAPI request failed and no fallback configured');
    }
  }

  /**
   * Estimate volume/CPC/KD for a batch of keywords via Anthropic.
   * Splits into small sub-batches (10 each) for reliability — one large
   * batch tends to truncate or produce malformed JSON which would wipe
   * metrics for every keyword. Each sub-batch failure only affects its
   * own keywords.
   */
  private async estimateMetricsBatch(
    keywords: string[],
    country: string,
  ): Promise<KeywordSuggestion[]> {
    const BATCH_SIZE = 10;
    const results: KeywordSuggestion[] = [];

    for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
      const batch = keywords.slice(i, i + BATCH_SIZE);
      const batchResults = await this.estimateMetricsSubBatch(batch, country);
      results.push(...batchResults);
    }

    return results;
  }

  private async estimateMetricsSubBatch(
    keywords: string[],
    country: string,
  ): Promise<KeywordSuggestion[]> {
    const empty = (kw: string): KeywordSuggestion => ({
      keyword: kw,
      searchVolume: null,
      difficulty: null,
      cpc: null,
      competition: 'UNKNOWN',
      intent: 'INFORMATIONAL' as SearchIntent,
      wordCount: 0,
      isQuestion: false,
      priorityScore: 0,
    });

    try {
      const keywordList = keywords.map((k, i) => `${i + 1}. ${k}`).join('\n');

      const parsed = await callOpenAIJson<any>({
        apiKey: this.openaiKey,
        systemPrompt: `You are an SEO data analyst. Estimate realistic SEO metrics for each keyword in the list.

Return ONLY valid JSON in this exact shape:
{
  "results": [
    {
      "keyword": "<echo the keyword exactly as provided, same case, same spelling>",
      "searchVolume": <integer monthly searches, e.g. 1200>,
      "difficulty": <integer 0-100>,
      "cpc": <float USD, e.g. 3.45>,
      "competition": "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH"
    }
  ]
}

Rules:
- Return exactly ${keywords.length} results in the same order as the input.
- Never return null for searchVolume, difficulty, or cpc — always give your best estimate.
- Be realistic. Long-tail keywords have low volume (50-500). Head terms have high volume (10k+).
- Local/branded keywords have lower difficulty than head terms.`,
        userPrompt: `Country: ${country}\n\nKeywords (in order):\n${keywordList}`,
        temperature: 0.3,
        maxTokens: 2000,
        timeout: 30000,
      });

      const rawResults = Array.isArray(parsed.results) ? parsed.results : [];

      // Build a normalized-keyword lookup for resilient string matching
      const normalize = (s: string) =>
        s.toLowerCase().trim().replace(/[?,.!]+$/, '');
      const byKeyword = new Map<string, any>();
      for (const r of rawResults) {
        if (typeof r?.keyword === 'string') {
          byKeyword.set(normalize(r.keyword), r);
        }
      }

      // Match by normalized keyword string first, fall back to position index
      // since the prompt instructs Anthropic to maintain input order.
      return keywords.map((kw, idx) => {
        const r = byKeyword.get(normalize(kw)) ?? rawResults[idx];
        if (!r) return empty(kw);

        return {
          keyword: kw,
          searchVolume:
            typeof r.searchVolume === 'number' ? r.searchVolume : null,
          difficulty: typeof r.difficulty === 'number' ? r.difficulty : null,
          cpc: typeof r.cpc === 'number' ? r.cpc : null,
          competition: r.competition || 'UNKNOWN',
          intent: 'INFORMATIONAL' as SearchIntent,
          wordCount: 0,
          isQuestion: false,
          priorityScore: 0,
        };
      });
    } catch (err) {
      this.logger.error(
        `Anthropic sub-batch metric estimation failed (keywords: ${keywords.length}): ${err}`,
      );
      return keywords.map(empty);
    }
  }

  // ─── OPENAI KEYWORD ESTIMATION ──────────────────────────

  private async fetchFromOpenAI(
    keyword: string,
    country: string,
  ): Promise<KeywordData> {
    try {
      const parsed = await callOpenAIJson<any>({
        apiKey: this.openaiKey,
        systemPrompt: `You are an SEO data analyst. Given a keyword and country, estimate realistic SEO metrics based on your knowledge. Return ONLY valid JSON with this exact structure:
{
  "searchVolume": <estimated monthly searches as integer>,
  "difficulty": <0-100 integer, how hard to rank>,
  "cpc": <estimated cost per click in USD as float>,
  "competition": "<LOW|MEDIUM|HIGH|VERY_HIGH>",
  "trend": [<12 integers representing monthly search volume for last 12 months, most recent first>]
}
Base your estimates on real-world search patterns. Be realistic — don't inflate numbers.`,
        userPrompt: `Keyword: "${keyword}"\nCountry: ${country}`,
        temperature: 0.3,
        timeout: 15000,
      });

      return {
        keyword,
        country,
        searchVolume: parsed.searchVolume ?? null,
        difficulty: parsed.difficulty ?? null,
        cpc: parsed.cpc ?? null,
        trend: Array.isArray(parsed.trend) ? parsed.trend : null,
        competition: parsed.competition || 'UNKNOWN',
        intent: 'INFORMATIONAL' as SearchIntent,
        wordCount: 0,
        isQuestion: false,
        priorityScore: 0,
      };
    } catch (err) {
      this.logger.error(`Anthropic keyword search error: ${err}`);
      throw new ServiceUnavailableException('Keyword metric estimation failed');
    }
  }

  private async fetchSuggestionsFromOpenAI(
    keyword: string,
    country: string,
    limit: number,
  ): Promise<{ keywords: KeywordSuggestion[]; total: number }> {
    try {
      const parsed = await callOpenAIJson<any>({
        apiKey: this.openaiKey,
        systemPrompt: `You are an SEO keyword research expert. Given a seed keyword, generate ${limit} related keyword suggestions that people actually search for. Include long-tail variations, questions, comparisons, and buying-intent keywords. Return ONLY valid JSON:
{
  "keywords": [
    {
      "keyword": "<suggested keyword>",
      "searchVolume": <estimated monthly searches>,
      "difficulty": <0-100>,
      "cpc": <USD float>,
      "competition": "<LOW|MEDIUM|HIGH|VERY_HIGH>"
    }
  ]
}
Make suggestions realistic, varied, and useful for SEO content planning. Order by estimated search volume descending.`,
        userPrompt: `Seed keyword: "${keyword}"\nCountry: ${country}\nGenerate ${limit} suggestions.`,
        temperature: 0.5,
        timeout: 30000,
      });

      const keywords: KeywordSuggestion[] = (parsed.keywords || []).map(
        (item: any) => ({
          keyword: item.keyword,
          searchVolume: item.searchVolume ?? null,
          difficulty: item.difficulty ?? null,
          cpc: item.cpc ?? null,
          competition: item.competition || 'UNKNOWN',
          intent: 'INFORMATIONAL' as SearchIntent,
          wordCount: 0,
          isQuestion: false,
          priorityScore: 0,
        }),
      );

      return { keywords, total: keywords.length };
    } catch (err) {
      this.logger.error(`Anthropic suggestions error: ${err}`);
      throw new ServiceUnavailableException('Keyword suggestion estimation failed');
    }
  }

  // ─── HELPERS ────────────────────────────────────────────

  private difficultyToCompetition(difficulty: number | null): string {
    if (difficulty === null) return 'UNKNOWN';
    if (difficulty < 25) return 'LOW';
    if (difficulty < 50) return 'MEDIUM';
    if (difficulty < 75) return 'HIGH';
    return 'VERY_HIGH';
  }

  // ─── INTENT CLASSIFICATION (pattern-based) ──────────────

  private classifyIntent(keyword: string): SearchIntent {
    const kw = keyword.toLowerCase().trim();

    // Transactional: user ready to buy/act
    if (/\b(buy|purchase|order|subscribe|sign up|signup|download|get|hire|book|reserve|coupon|discount|deal|cheap|price|pricing|cost|affordable|for sale|shop|checkout)\b/.test(kw)) {
      return 'TRANSACTIONAL';
    }

    // Commercial: user researching before buying
    if (/\b(best|top|review|reviews|comparison|compare|vs|versus|alternative|alternatives|pros and cons|worth it|should i|which|recommended)\b/.test(kw)) {
      return 'COMMERCIAL';
    }

    // Navigational: user looking for specific site/brand
    if (/\b(login|log in|sign in|signin|website|official|\.com|\.org|\.net|app|dashboard|portal|account)\b/.test(kw)) {
      return 'NAVIGATIONAL';
    }

    // Informational: user wants to learn
    if (/^(how|what|why|when|where|who|which|can|does|do|is|are|should|will|guide|tutorial|tips|ways to|steps to|learn|understand|explain|definition|meaning|example)\b/.test(kw) || kw.endsWith('?')) {
      return 'INFORMATIONAL';
    }

    // Default: classify based on CPC hint — higher CPC suggests commercial/transactional
    // But since we don't have CPC here, default to informational
    return 'INFORMATIONAL';
  }

  private isQuestionKeyword(keyword: string): boolean {
    const kw = keyword.toLowerCase().trim();
    return /^(how|what|why|when|where|who|which|can|does|do|is|are|should|will|would|could)\b/.test(kw) || kw.endsWith('?');
  }

  private getWordCount(keyword: string): number {
    return keyword.trim().split(/\s+/).length;
  }

  /**
   * Priority Score (0-100) based on Semrush formula:
   * Priority = (Volume × 0.4) + (Intent × 0.3) + (KD_Inverse × 0.3)
   * Each component normalized to 0-100 scale
   */
  private calculatePriorityScore(
    searchVolume: number | null,
    difficulty: number | null,
    intent: SearchIntent,
  ): number {
    // Volume component (0-100): log-scale normalization
    const vol = searchVolume ?? 0;
    const volumeScore = vol > 0 ? Math.min(100, Math.round(Math.log10(vol) / Math.log10(100000) * 100)) : 0;

    // Intent component (0-100)
    const intentScores: Record<SearchIntent, number> = {
      TRANSACTIONAL: 100,
      COMMERCIAL: 75,
      INFORMATIONAL: 50,
      NAVIGATIONAL: 25,
    };
    const intentScore = intentScores[intent];

    // KD Inverse (0-100): easier = higher score
    const kd = difficulty ?? 50;
    const kdInverse = Math.round(((100 - kd) / 100) * 100);

    return Math.round(volumeScore * 0.4 + intentScore * 0.3 + kdInverse * 0.3);
  }

  /** Enrich a KeywordData with intent, wordCount, isQuestion, priorityScore */
  private enrichKeywordData(data: KeywordData): KeywordData {
    data.intent = this.classifyIntent(data.keyword);
    data.wordCount = this.getWordCount(data.keyword);
    data.isQuestion = this.isQuestionKeyword(data.keyword);
    data.priorityScore = this.calculatePriorityScore(data.searchVolume, data.difficulty, data.intent);
    return data;
  }

  /** Enrich a KeywordSuggestion with intent, wordCount, isQuestion, priorityScore */
  private enrichSuggestion(sug: KeywordSuggestion): KeywordSuggestion {
    sug.intent = this.classifyIntent(sug.keyword);
    sug.wordCount = this.getWordCount(sug.keyword);
    sug.isQuestion = this.isQuestionKeyword(sug.keyword);
    sug.priorityScore = this.calculatePriorityScore(sug.searchVolume, sug.difficulty, sug.intent);
    return sug;
  }

  // ─── KEYWORD CLUSTERING (shared-word grouping) ──────────

  clusterKeywords(keywords: KeywordSuggestion[]): Record<string, KeywordSuggestion[]> {
    const clusters: Record<string, KeywordSuggestion[]> = {};

    for (const kw of keywords) {
      // Extract the most significant word (longest, non-stop-word)
      const stopWords = new Set(['a', 'an', 'the', 'to', 'for', 'in', 'on', 'of', 'and', 'or', 'is', 'are', 'how', 'what', 'why', 'when', 'where', 'who', 'which', 'best', 'top', 'vs', 'with', 'by', 'at', 'from']);
      const words = kw.keyword.toLowerCase().split(/\s+/).filter(w => !stopWords.has(w) && w.length > 2);
      const group = words.length > 0 ? words.sort((a, b) => b.length - a.length)[0] : 'other';

      if (!clusters[group]) clusters[group] = [];
      clusters[group].push(kw);
    }

    // Sort clusters by size descending
    const sorted: Record<string, KeywordSuggestion[]> = {};
    Object.entries(clusters)
      .sort(([, a], [, b]) => b.length - a.length)
      .forEach(([key, val]) => { sorted[key] = val; });

    return sorted;
  }
}
