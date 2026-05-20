import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { callOpenAIJson } from '../common/utils/openai';
import {
  serpApiSearch,
  serpApiAutocomplete,
  isSerpApiConfigured,
} from '../common/utils/serpapi';

type SearchIntent =
  | 'INFORMATIONAL'
  | 'NAVIGATIONAL'
  | 'COMMERCIAL'
  | 'TRANSACTIONAL';

interface TopicCard {
  topic: string;
  searchVolume: number | null;
  difficulty: number | null;
  topicEfficiency: number | null;
  subtopicCount: number;
  intent: SearchIntent;
}

interface Subtopic {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: SearchIntent;
  topicEfficiency: number | null;
  isQuestion: boolean;
  wordCount: number;
}

interface TopicFilters {
  minVolume?: number;
  maxVolume?: number;
  maxKd?: number;
  minEfficiency?: number;
  intent?: string;
  questionsOnly?: boolean;
}

@Injectable()
export class TopicResearchService {
  private readonly logger = new Logger(TopicResearchService.name);
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
  }

  // ─── TOPIC RESEARCH ─────────────────────────────────────

  async researchTopic(
    topic: string,
    country: string = 'AU',
    domain?: string,
    filters?: TopicFilters,
  ): Promise<{ topic: string; country: string; cards: TopicCard[]; total: number }> {
    const normalized = topic.trim().toLowerCase();

    let cards: TopicCard[];
    if (this.hasSerpApi) {
      cards = await this.fetchTopicsFromSerpApi(normalized, country, domain);
    } else if (this.hasOpenAI) {
      cards = await this.fetchTopicsFromOpenAI(normalized, country, domain);
    } else {
      throw new ServiceUnavailableException(
        'Topic research requires SERPAPI_KEY or ANTHROPIC_API_KEY',
      );
    }

    // Enrich all cards
    cards = cards.map((c) => this.enrichTopicCard(c));

    // Apply filters
    if (filters) {
      if (filters.minVolume !== undefined)
        cards = cards.filter((c) => (c.searchVolume ?? 0) >= filters.minVolume!);
      if (filters.maxVolume !== undefined)
        cards = cards.filter((c) => (c.searchVolume ?? 0) <= filters.maxVolume!);
      if (filters.maxKd !== undefined)
        cards = cards.filter((c) => (c.difficulty ?? 0) <= filters.maxKd!);
      if (filters.minEfficiency !== undefined)
        cards = cards.filter(
          (c) => (c.topicEfficiency ?? 0) >= filters.minEfficiency!,
        );
      if (filters.intent)
        cards = cards.filter((c) => c.intent === filters.intent);
    }

    // Sort by efficiency descending
    cards.sort((a, b) => (b.topicEfficiency ?? 0) - (a.topicEfficiency ?? 0));

    // Cache top results
    for (const card of cards.slice(0, 20)) {
      try {
        await this.prisma.topicCache.upsert({
          where: { topic_country: { topic: card.topic.toLowerCase(), country } },
          create: {
            topic: card.topic.toLowerCase(),
            country,
            searchVolume: card.searchVolume,
            difficulty: card.difficulty,
            topicEfficiency: card.topicEfficiency,
            subtopicCount: card.subtopicCount,
          },
          update: {
            searchVolume: card.searchVolume,
            difficulty: card.difficulty,
            topicEfficiency: card.topicEfficiency,
            subtopicCount: card.subtopicCount,
          },
        });
      } catch {
        // Ignore cache errors
      }
    }

    return {
      topic: normalized,
      country,
      cards,
      total: cards.length,
    };
  }

  // ─── SUBTOPICS ──────────────────────────────────────────

  async getSubtopics(
    topic: string,
    parentTopic: string,
    country: string = 'AU',
    page: number = 1,
  ): Promise<{
    topic: string;
    subtopics: Subtopic[];
    total: number;
    page: number;
    totalPages: number;
    headlines: string[];
    questions: string[];
  }> {
    const normalized = topic.trim().toLowerCase();
    const limit = 20;

    let subtopics: Subtopic[];
    let headlines: string[];
    let questions: string[];

    if (this.hasSerpApi) {
      const result = await this.fetchSubtopicsFromSerpApi(
        normalized,
        country,
        limit * 3,
      );
      subtopics = result.subtopics;
      headlines = result.headlines;
      questions = result.questions;
    } else if (this.hasOpenAI) {
      const result = await this.fetchSubtopicsFromOpenAI(
        normalized,
        parentTopic,
        country,
      );
      subtopics = result.subtopics;
      headlines = result.headlines;
      questions = result.questions;
    } else {
      throw new ServiceUnavailableException(
        'Subtopic research requires SERPAPI_KEY or ANTHROPIC_API_KEY',
      );
    }

    // Enrich
    subtopics = subtopics.map((s) => this.enrichSubtopic(s));

    // Paginate
    const total = subtopics.length;
    const start = (page - 1) * limit;
    const paginated = subtopics.slice(start, start + limit);

    return {
      topic: normalized,
      subtopics: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      headlines,
      questions,
    };
  }

  // ─── SERPAPI ────────────────────────────────────────────

  /**
   * Collect a keyword pool from SerpAPI (autocomplete + related searches + PAA)
   * and optionally enrich each with Anthropic-estimated volume/KD/CPC.
   */
  private async collectKeywordPool(
    seed: string,
    country: string,
  ): Promise<{ keywords: string[]; questions: string[] }> {
    const [autocompletions, searchResult] = await Promise.all([
      serpApiAutocomplete({
        apiKey: this.serpApiKey,
        query: seed,
        country,
      }).catch((err) => {
        this.logger.warn(`SerpAPI autocomplete failed: ${err}`);
        return [] as string[];
      }),
      serpApiSearch({
        apiKey: this.serpApiKey,
        query: seed,
        country,
        num: 100,
      }).catch((err) => {
        this.logger.warn(`SerpAPI search failed: ${err}`);
        return null;
      }),
    ]);

    const pool = new Set<string>();
    for (const kw of autocompletions) pool.add(kw.toLowerCase().trim());

    const questions: string[] = [];
    if (searchResult) {
      for (const kw of searchResult.relatedSearches)
        pool.add(kw.toLowerCase().trim());
      for (const q of searchResult.relatedQuestions) {
        questions.push(q);
        pool.add(q.toLowerCase().trim().replace(/\?$/, ''));
      }
    }

    pool.delete(seed.toLowerCase().trim());

    return { keywords: Array.from(pool), questions };
  }

  /**
   * Estimate metrics for a list of keywords via Anthropic. Returns a map
   * keyed by normalized keyword (lowercase, trimmed, trailing punctuation stripped).
   * Processed in small sub-batches so one bad JSON response doesn't wipe metrics
   * for every keyword.
   */
  private async estimateKeywordMetrics(
    keywords: string[],
    country: string,
  ): Promise<Map<string, { searchVolume: number | null; difficulty: number | null; cpc: number | null }>> {
    const map = new Map<
      string,
      { searchVolume: number | null; difficulty: number | null; cpc: number | null }
    >();
    if (!this.hasOpenAI || keywords.length === 0) return map;

    const normalize = (s: string) =>
      s.toLowerCase().trim().replace(/[?,.!]+$/, '');
    const BATCH_SIZE = 10;

    for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
      const batch = keywords.slice(i, i + BATCH_SIZE);
      try {
        const list = batch.map((k, j) => `${j + 1}. ${k}`).join('\n');
        const parsed = await callOpenAIJson<any>({
          apiKey: this.openaiKey,
          systemPrompt: `You are an SEO data analyst. Estimate realistic monthly search volume (integer), keyword difficulty (0-100), and CPC (USD float) for each keyword.

Return ONLY valid JSON:
{
  "results": [
    { "keyword": "<echo exactly as provided>", "searchVolume": <int>, "difficulty": <0-100>, "cpc": <float> }
  ]
}

Rules:
- Return exactly ${batch.length} results in the same order as the input.
- Never return null — always give your best estimate.
- Be realistic. Long-tail = 50-500. Head terms = 10k+.`,
          userPrompt: `Country: ${country}\n\nKeywords (in order):\n${list}`,
          temperature: 0.3,
          maxTokens: 2000,
          timeout: 30000,
        });

        const rawResults = Array.isArray(parsed.results) ? parsed.results : [];

        // String-match first, fall back to index for any keyword Anthropic
        // returned with slightly different casing/punctuation.
        const byKeyword = new Map<string, any>();
        for (const r of rawResults) {
          if (typeof r?.keyword === 'string') {
            byKeyword.set(normalize(r.keyword), r);
          }
        }

        batch.forEach((kw, idx) => {
          const r = byKeyword.get(normalize(kw)) ?? rawResults[idx];
          if (!r) return;
          map.set(normalize(kw), {
            searchVolume:
              typeof r.searchVolume === 'number' ? r.searchVolume : null,
            difficulty:
              typeof r.difficulty === 'number' ? r.difficulty : null,
            cpc: typeof r.cpc === 'number' ? r.cpc : null,
          });
        });
      } catch (err) {
        this.logger.error(
          `Anthropic sub-batch metric estimation failed (batch ${i / BATCH_SIZE + 1}): ${err}`,
        );
      }
    }

    return map;
  }

  private async fetchTopicsFromSerpApi(
    topic: string,
    country: string,
    domain?: string,
  ): Promise<TopicCard[]> {
    try {
      const { keywords } = await this.collectKeywordPool(topic, country);

      if (keywords.length === 0) {
        if (this.hasOpenAI)
          return this.fetchTopicsFromOpenAI(topic, country, domain);
        return [];
      }

      const metricsMap = await this.estimateKeywordMetrics(
        keywords.slice(0, 60),
        country,
      );

      const normKey = (s: string) =>
        s.toLowerCase().trim().replace(/[?,.!]+$/, '');
      const items = keywords.map((kw) => ({
        keyword: kw,
        keyword_info: {
          search_volume: metricsMap.get(normKey(kw))?.searchVolume ?? null,
        },
        keyword_properties: {
          keyword_difficulty:
            metricsMap.get(normKey(kw))?.difficulty ?? null,
        },
      }));

      const clusters = this.clusterIntoTopics(items, topic);
      return clusters;
    } catch (err) {
      this.logger.error(`SerpAPI topic research error: ${err}`);
      if (this.hasOpenAI)
        return this.fetchTopicsFromOpenAI(topic, country, domain);
      throw new ServiceUnavailableException('SerpAPI request failed and no fallback configured');
    }
  }

  private async fetchSubtopicsFromSerpApi(
    topic: string,
    country: string,
    limit: number,
  ): Promise<{ subtopics: Subtopic[]; headlines: string[]; questions: string[] }> {
    try {
      const { keywords, questions: paaQuestions } = await this.collectKeywordPool(
        topic,
        country,
      );

      if (keywords.length === 0) {
        return { subtopics: [], headlines: [], questions: [] };
      }

      const sliced = keywords.slice(0, limit);
      const metricsMap = await this.estimateKeywordMetrics(sliced, country);

      const normKey = (s: string) =>
        s.toLowerCase().trim().replace(/[?,.!]+$/, '');
      const subtopics: Subtopic[] = sliced.map((kw) => {
        const m = metricsMap.get(normKey(kw));
        return {
          keyword: kw,
          searchVolume: m?.searchVolume ?? null,
          difficulty: m?.difficulty ?? null,
          cpc: m?.cpc ?? null,
          intent: 'INFORMATIONAL' as SearchIntent,
          topicEfficiency: null,
          isQuestion: false,
          wordCount: 0,
        };
      });

      const inferredQuestions = subtopics
        .filter((s) => this.isQuestionKeyword(s.keyword))
        .map((s) => s.keyword);
      const questions = Array.from(
        new Set([...paaQuestions, ...inferredQuestions]),
      ).slice(0, 10);

      const headlines = this.generateHeadlines(topic, subtopics);

      return { subtopics, headlines, questions };
    } catch (err) {
      this.logger.error(`SerpAPI subtopics error: ${err}`);
      throw new ServiceUnavailableException('SerpAPI request failed for subtopics');
    }
  }

  // ─── OPENAI ─────────────────────────────────────────────

  private async fetchTopicsFromOpenAI(
    topic: string,
    country: string,
    domain?: string,
  ): Promise<TopicCard[]> {
    try {
      const domainContext = domain
        ? `\nThe content is for the domain: ${domain}`
        : '';

      const parsed = await callOpenAIJson<any>({
        apiKey: this.openaiKey,
        systemPrompt: `You are an SEO topic research expert. Given a seed topic, generate 15-20 related topic clusters that people search for. Each cluster is a broader subtopic related to the seed keyword. Return ONLY valid JSON:
{
  "topics": [
    {
      "topic": "<cluster topic name>",
      "searchVolume": <estimated monthly searches>,
      "difficulty": <0-100>,
      "subtopicCount": <estimated number of sub-keywords in this cluster, 3-15>,
      "competition": "<LOW|MEDIUM|HIGH|VERY_HIGH>"
    }
  ]
}
Make topics diverse: include informational, commercial, how-to, comparison, and question-based clusters. Order by estimated search volume descending. Be realistic with metrics.`,
        userPrompt: `Seed topic: "${topic}"\nCountry: ${country}${domainContext}\nGenerate 15-20 topic clusters.`,
        temperature: 0.5,
        timeout: 30000,
      });

      return (parsed.topics || []).map((t: any) => ({
        topic: t.topic,
        searchVolume: t.searchVolume ?? null,
        difficulty: t.difficulty ?? null,
        topicEfficiency: null,
        subtopicCount: t.subtopicCount ?? 5,
        intent: 'INFORMATIONAL' as SearchIntent,
      }));
    } catch (err) {
      this.logger.error(`Anthropic topic research error: ${err}`);
      throw new ServiceUnavailableException('Topic research estimation failed');
    }
  }

  private async fetchSubtopicsFromOpenAI(
    topic: string,
    parentTopic: string,
    country: string,
  ): Promise<{ subtopics: Subtopic[]; headlines: string[]; questions: string[] }> {
    try {
      const parsed = await callOpenAIJson<any>({
        apiKey: this.openaiKey,
        systemPrompt: `You are an SEO content research expert. Given a topic and its parent topic, generate related subtopics (keywords), headline ideas, and common questions people ask. Return ONLY valid JSON:
{
  "subtopics": [
    {
      "keyword": "<related keyword>",
      "searchVolume": <estimated monthly searches>,
      "difficulty": <0-100>,
      "cpc": <USD float>,
      "competition": "<LOW|MEDIUM|HIGH|VERY_HIGH>"
    }
  ],
  "headlines": ["<headline idea 1>", "<headline idea 2>", ...],
  "questions": ["<question 1>", "<question 2>", ...]
}
Generate 15-20 subtopics, 8-10 headline ideas, and 8-10 questions. Be realistic with metrics.`,
        userPrompt: `Topic: "${topic}"\nParent topic: "${parentTopic}"\nCountry: ${country}`,
        temperature: 0.5,
        timeout: 30000,
      });

      const subtopics: Subtopic[] = (parsed.subtopics || []).map((s: any) => ({
        keyword: s.keyword,
        searchVolume: s.searchVolume ?? null,
        difficulty: s.difficulty ?? null,
        cpc: s.cpc ?? null,
        intent: 'INFORMATIONAL' as SearchIntent,
        topicEfficiency: null,
        isQuestion: false,
        wordCount: 0,
      }));

      return {
        subtopics,
        headlines: parsed.headlines || [],
        questions: parsed.questions || [],
      };
    } catch (err) {
      this.logger.error(`Anthropic subtopics error: ${err}`);
      throw new ServiceUnavailableException('Subtopic estimation failed');
    }
  }

  // ─── CLUSTERING ──────────────────────────────────────

  private clusterIntoTopics(items: any[], seedTopic: string): TopicCard[] {
    const stopWords = new Set([
      'a', 'an', 'the', 'to', 'for', 'in', 'on', 'of', 'and', 'or',
      'is', 'are', 'how', 'what', 'why', 'when', 'where', 'who', 'which',
      'with', 'by', 'at', 'from',
    ]);

    const clusters: Record<string, any[]> = {};

    for (const item of items) {
      const keyword = item.keyword || '';
      const words = keyword
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => !stopWords.has(w) && w.length > 2);

      // Use the most distinctive word (not in seed topic) as cluster key
      const seedWords = new Set(seedTopic.toLowerCase().split(/\s+/));
      const distinctWord =
        words.find((w: string) => !seedWords.has(w)) ||
        words[0] ||
        'general';

      if (!clusters[distinctWord]) clusters[distinctWord] = [];
      clusters[distinctWord].push(item);
    }

    // Convert clusters to TopicCards
    const cards: TopicCard[] = Object.entries(clusters)
      .filter(([, items]) => items.length >= 2)
      .map(([clusterName, clusterItems]) => {
        // Average metrics across cluster
        const volumes = clusterItems
          .map((i) => i.keyword_info?.search_volume)
          .filter(Boolean);
        const diffs = clusterItems
          .map((i) =>
            i.keyword_properties?.keyword_difficulty
              ? Math.round(i.keyword_properties.keyword_difficulty)
              : null,
          )
          .filter(Boolean);

        const avgVolume =
          volumes.length > 0
            ? Math.round(volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length)
            : null;
        const avgDifficulty =
          diffs.length > 0
            ? Math.round(
                (diffs as number[]).reduce((a, b) => a + b, 0) / diffs.length,
              )
            : null;

        // Use the most popular keyword as topic name
        const bestItem = clusterItems.sort(
          (a: any, b: any) =>
            (b.keyword_info?.search_volume || 0) -
            (a.keyword_info?.search_volume || 0),
        )[0];

        return {
          topic: bestItem.keyword || `${seedTopic} ${clusterName}`,
          searchVolume: avgVolume,
          difficulty: avgDifficulty,
          topicEfficiency: null,
          subtopicCount: clusterItems.length,
          intent: 'INFORMATIONAL' as SearchIntent,
        };
      })
      .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
      .slice(0, 20);

    return cards;
  }

  private generateHeadlines(topic: string, subtopics: Subtopic[]): string[] {
    const topKeywords = subtopics
      .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
      .slice(0, 5)
      .map((s) => s.keyword);

    const headlines: string[] = [
      `The Complete Guide to ${topic}`,
      `${topic}: Everything You Need to Know`,
    ];

    for (const kw of topKeywords) {
      headlines.push(`How to ${kw}: Expert Tips & Strategies`);
    }

    headlines.push(
      `Top 10 ${topic} Strategies for 2026`,
      `${topic} Best Practices: What Experts Recommend`,
    );

    return headlines.slice(0, 10);
  }

  // ─── HELPERS ────────────────────────────────────────────

  private enrichTopicCard(card: TopicCard): TopicCard {
    card.intent = this.classifyIntent(card.topic);
    card.topicEfficiency = this.calculateEfficiency(
      card.searchVolume,
      card.difficulty,
    );
    return card;
  }

  private enrichSubtopic(sub: Subtopic): Subtopic {
    sub.intent = this.classifyIntent(sub.keyword);
    sub.isQuestion = this.isQuestionKeyword(sub.keyword);
    sub.wordCount = sub.keyword.trim().split(/\s+/).length;
    sub.topicEfficiency = this.calculateEfficiency(
      sub.searchVolume,
      sub.difficulty,
    );
    return sub;
  }

  /**
   * Topic Efficiency Score (0-100):
   * High volume + low difficulty = high efficiency
   */
  private calculateEfficiency(
    volume: number | null,
    difficulty: number | null,
  ): number {
    const vol = volume ?? 0;
    const kd = difficulty ?? 50;

    // Volume component: log-scale, 0-100
    const volumeScore =
      vol > 0
        ? Math.min(100, Math.round((Math.log10(vol) / Math.log10(100000)) * 100))
        : 0;

    // Difficulty inverse: easier = higher score
    const kdInverse = Math.round(((100 - kd) / 100) * 100);

    // Weighted: 50% volume, 50% ease
    return Math.round(volumeScore * 0.5 + kdInverse * 0.5);
  }

  private classifyIntent(keyword: string): SearchIntent {
    const kw = keyword.toLowerCase().trim();

    if (
      /\b(buy|purchase|order|subscribe|download|get|hire|book|coupon|discount|deal|cheap|price|pricing|cost|affordable|for sale|shop)\b/.test(
        kw,
      )
    ) {
      return 'TRANSACTIONAL';
    }

    if (
      /\b(best|top|review|reviews|comparison|compare|vs|versus|alternative|alternatives|pros and cons|worth it|should i|which|recommended)\b/.test(
        kw,
      )
    ) {
      return 'COMMERCIAL';
    }

    if (
      /\b(login|log in|sign in|website|official|\.com|\.org|app|dashboard|portal|account)\b/.test(
        kw,
      )
    ) {
      return 'NAVIGATIONAL';
    }

    return 'INFORMATIONAL';
  }

  private isQuestionKeyword(keyword: string): boolean {
    const kw = keyword.toLowerCase().trim();
    return (
      /^(how|what|why|when|where|who|which|can|does|do|is|are|should|will|would|could)\b/.test(
        kw,
      ) || kw.endsWith('?')
    );
  }

}
