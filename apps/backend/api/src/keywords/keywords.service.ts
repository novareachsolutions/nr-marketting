import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

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
  private readonly dataForSeoLogin: string;
  private readonly dataForSeoPassword: string;
  private readonly isConfigured: boolean;
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.dataForSeoLogin = this.config.get<string>('DATAFORSEO_LOGIN') || '';
    this.dataForSeoPassword =
      this.config.get<string>('DATAFORSEO_PASSWORD') || '';
    this.isConfigured =
      this.dataForSeoLogin.length > 0 && this.dataForSeoPassword.length > 0;

    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;

    if (!this.isConfigured && this.hasOpenAI) {
      this.logger.log(
        'DataForSEO not configured — using OpenAI for keyword estimates',
      );
    } else if (!this.isConfigured) {
      this.logger.warn(
        'DataForSEO + OpenAI not configured — using hardcoded mock data',
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

    // Fetch from DataForSEO, OpenAI, or mock
    let data: KeywordData;
    if (this.isConfigured) {
      data = await this.fetchFromDataForSeo(normalized, country);
    } else if (this.hasOpenAI) {
      data = await this.fetchFromOpenAI(normalized, country);
    } else {
      data = this.getMockKeywordData(normalized, country);
    }

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
    if (this.isConfigured) {
      result = await this.fetchSuggestionsFromDataForSeo(normalized, country, limit * 3, 1); // fetch more for filtering
    } else if (this.hasOpenAI) {
      result = await this.fetchSuggestionsFromOpenAI(normalized, country, limit * 2);
    } else {
      result = this.getMockSuggestions(normalized, limit * 3, 1);
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

    return {
      keywords,
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
    // Since we don't have SERP API, we approximate by getting suggestions for
    // the competitor's core terms
    const competitorKeywords: Record<string, Set<string>> = {};

    for (const domain of competitorDomains.slice(0, 4)) {
      // Extract meaningful words from domain (e.g., "example-seo-tools.com" → "seo tools")
      const domainWords = domain.replace(/\.(com|org|net|io|co|au|uk)$/i, '')
        .replace(/^www\./, '')
        .replace(/[-_.]/g, ' ')
        .trim();

      // Get suggestions for the domain's core terms
      let result: { keywords: KeywordSuggestion[]; total: number };
      if (this.isConfigured) {
        result = await this.fetchSuggestionsFromDataForSeo(domainWords, 'US', 100, 1);
      } else if (this.hasOpenAI) {
        result = await this.fetchSuggestionsFromOpenAI(domainWords, 'US', 50);
      } else {
        result = this.getMockSuggestions(domainWords, 100, 1);
      }

      competitorKeywords[domain] = new Set(
        result.keywords.map((k) => this.enrichSuggestion(k).keyword.toLowerCase()),
      );
    }

    // Compute gap categories
    const allCompetitorKws = new Set<string>();
    for (const kwSet of Object.values(competitorKeywords)) {
      for (const kw of kwSet) allCompetitorKws.add(kw);
    }

    const missing: KeywordSuggestion[] = []; // Competitors have, you don't
    const shared: string[] = [];   // Both have
    const unique: string[] = [];   // Only you have

    for (const kw of allCompetitorKws) {
      if (!yourKeywords.has(kw)) {
        // It's a missing keyword — enrich it with mock data for display
        const h = this.simpleHash(kw);
        missing.push(this.enrichSuggestion({
          keyword: kw,
          searchVolume: 100 + (h % 30000),
          difficulty: 5 + (h % 90),
          cpc: parseFloat((0.1 + (h % 1200) / 100).toFixed(2)),
          competition: this.difficultyToCompetition(5 + (h % 90)),
          intent: 'INFORMATIONAL',
          wordCount: 0,
          isQuestion: false,
          priorityScore: 0,
        }));
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

  // ─── DATAFORSEO API CALLS ──────────────────────────────

  private getAuthHeader(): string {
    const credentials = Buffer.from(
      `${this.dataForSeoLogin}:${this.dataForSeoPassword}`,
    ).toString('base64');
    return `Basic ${credentials}`;
  }

  private async fetchFromDataForSeo(
    keyword: string,
    country: string,
  ): Promise<KeywordData> {
    try {
      const response = await axios.post(
        'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
        [
          {
            keywords: [keyword],
            location_code: this.countryToLocationCode(country),
            language_code: 'en',
          },
        ],
        {
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
        },
      );

      const result = response.data?.tasks?.[0]?.result?.[0];

      if (!result) {
        this.logger.warn(
          `No DataForSEO result for "${keyword}", falling back to mock`,
        );
        return this.getMockKeywordData(keyword, country);
      }

      const monthlySearches: number[] = (
        result.monthly_searches || []
      ).map((m: any) => m.search_volume || 0);

      return {
        keyword,
        country,
        searchVolume: result.search_volume ?? null,
        difficulty: result.competition_index
          ? Math.round(result.competition_index * 100)
          : null,
        cpc: result.cpc ?? null,
        trend: monthlySearches.length > 0 ? monthlySearches : null,
        competition: result.competition || 'UNKNOWN',
        intent: 'INFORMATIONAL' as SearchIntent,
        wordCount: 0,
        isQuestion: false,
        priorityScore: 0,
      };
    } catch (err) {
      this.logger.error(`DataForSEO search_volume error: ${err}`);
      return this.getMockKeywordData(keyword, country);
    }
  }

  private async fetchSuggestionsFromDataForSeo(
    keyword: string,
    country: string,
    limit: number,
    page: number,
  ): Promise<{ keywords: KeywordSuggestion[]; total: number }> {
    try {
      const offset = (page - 1) * limit;

      const response = await axios.post(
        'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live',
        [
          {
            keyword,
            location_code: this.countryToLocationCode(country),
            language_code: 'en',
            limit,
            offset,
            include_seed_keyword: false,
          },
        ],
        {
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
        },
      );

      const taskResult = response.data?.tasks?.[0]?.result?.[0];

      if (!taskResult?.items) {
        return this.getMockSuggestions(keyword, limit, page);
      }

      const keywords: KeywordSuggestion[] = taskResult.items.map(
        (item: any) => ({
          keyword: item.keyword,
          searchVolume: item.keyword_info?.search_volume ?? null,
          difficulty: item.keyword_properties?.keyword_difficulty
            ? Math.round(item.keyword_properties.keyword_difficulty)
            : null,
          cpc: item.keyword_info?.cpc ?? null,
          competition: item.keyword_info?.competition || 'UNKNOWN',
          intent: 'INFORMATIONAL' as SearchIntent,
          wordCount: 0,
          isQuestion: false,
          priorityScore: 0,
        }),
      );

      return {
        keywords,
        total: taskResult.total_count || keywords.length,
      };
    } catch (err) {
      this.logger.error(`DataForSEO suggestions error: ${err}`);
      return this.getMockSuggestions(keyword, limit, page);
    }
  }

  // ─── OPENAI KEYWORD ESTIMATION ──────────────────────────

  private async fetchFromOpenAI(
    keyword: string,
    country: string,
  ): Promise<KeywordData> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are an SEO data analyst. Given a keyword and country, estimate realistic SEO metrics based on your knowledge. Return ONLY valid JSON with this exact structure:
{
  "searchVolume": <estimated monthly searches as integer>,
  "difficulty": <0-100 integer, how hard to rank>,
  "cpc": <estimated cost per click in USD as float>,
  "competition": "<LOW|MEDIUM|HIGH|VERY_HIGH>",
  "trend": [<12 integers representing monthly search volume for last 12 months, most recent first>]
}
Base your estimates on real-world search patterns. Be realistic — don't inflate numbers.`,
            },
            {
              role: 'user',
              content: `Keyword: "${keyword}"\nCountry: ${country}`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      const content = response.data.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content);

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
      this.logger.error(`OpenAI keyword search error: ${err}`);
      return this.getMockKeywordData(keyword, country);
    }
  }

  private async fetchSuggestionsFromOpenAI(
    keyword: string,
    country: string,
    limit: number,
  ): Promise<{ keywords: KeywordSuggestion[]; total: number }> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          temperature: 0.5,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are an SEO keyword research expert. Given a seed keyword, generate ${limit} related keyword suggestions that people actually search for. Include long-tail variations, questions, comparisons, and buying-intent keywords. Return ONLY valid JSON:
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
            },
            {
              role: 'user',
              content: `Seed keyword: "${keyword}"\nCountry: ${country}\nGenerate ${limit} suggestions.`,
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
      this.logger.error(`OpenAI suggestions error: ${err}`);
      return this.getMockSuggestions(keyword, limit, 1);
    }
  }

  // ─── MOCK DATA ──────────────────────────────────────────

  private getMockKeywordData(keyword: string, country: string): KeywordData {
    const hash = this.simpleHash(keyword);
    const volume = 500 + (hash % 50000);
    const difficulty = 10 + (hash % 80);
    const cpc = parseFloat((0.2 + (hash % 1500) / 100).toFixed(2));

    const trend: number[] = [];
    for (let i = 0; i < 12; i++) {
      trend.push(Math.max(100, volume + Math.floor(Math.sin(i) * volume * 0.2)));
    }

    return {
      keyword,
      country,
      searchVolume: volume,
      difficulty,
      cpc,
      trend,
      competition: this.difficultyToCompetition(difficulty),
      intent: 'INFORMATIONAL' as SearchIntent,
      wordCount: 0,
      isQuestion: false,
      priorityScore: 0,
    };
  }

  private getMockSuggestions(
    keyword: string,
    limit: number,
    page: number,
  ): { keywords: KeywordSuggestion[]; total: number } {
    const prefixes = [
      'best',
      'top',
      'how to',
      'what is',
      'free',
      'cheap',
      'online',
      'near me',
      '',
      'buy',
    ];
    const suffixes = [
      'tools',
      'software',
      'services',
      'guide',
      'tips',
      'examples',
      'review',
      'alternatives',
      'pricing',
      'vs',
      'for beginners',
      'tutorial',
      '2026',
      'comparison',
      'benefits',
    ];

    const allSuggestions: KeywordSuggestion[] = [];

    for (const prefix of prefixes) {
      for (const suffix of suffixes) {
        const suggested = [prefix, keyword, suffix]
          .filter(Boolean)
          .join(' ')
          .trim();
        const h = this.simpleHash(suggested);
        allSuggestions.push({
          keyword: suggested,
          searchVolume: 100 + (h % 30000),
          difficulty: 5 + (h % 90),
          cpc: parseFloat((0.1 + (h % 1200) / 100).toFixed(2)),
          competition: this.difficultyToCompetition(5 + (h % 90)),
          intent: 'INFORMATIONAL' as SearchIntent,
          wordCount: 0,
          isQuestion: false,
          priorityScore: 0,
        });
      }
    }

    const total = allSuggestions.length;
    const start = (page - 1) * limit;
    const keywords = allSuggestions.slice(start, start + limit);

    return { keywords, total };
  }

  // ─── HELPERS ────────────────────────────────────────────

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private difficultyToCompetition(difficulty: number | null): string {
    if (difficulty === null) return 'UNKNOWN';
    if (difficulty < 25) return 'LOW';
    if (difficulty < 50) return 'MEDIUM';
    if (difficulty < 75) return 'HIGH';
    return 'VERY_HIGH';
  }

  private countryToLocationCode(country: string): number {
    const map: Record<string, number> = {
      US: 2840,
      GB: 2826,
      CA: 2124,
      AU: 2036,
      IN: 2356,
      DE: 2276,
      FR: 2250,
      ES: 2724,
      IT: 2380,
      BR: 2076,
      JP: 2392,
    };
    return map[country.toUpperCase()] || 2840;
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
