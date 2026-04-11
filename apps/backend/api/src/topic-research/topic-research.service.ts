import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

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
    if (this.isConfigured) {
      cards = await this.fetchTopicsFromDataForSeo(normalized, country);
    } else if (this.hasOpenAI) {
      cards = await this.fetchTopicsFromOpenAI(normalized, country, domain);
    } else {
      cards = this.getMockTopics(normalized);
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

    if (this.isConfigured) {
      const result = await this.fetchSubtopicsFromDataForSeo(
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
      const result = this.getMockSubtopics(normalized);
      subtopics = result.subtopics;
      headlines = result.headlines;
      questions = result.questions;
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

  // ─── DATAFORSEO ─────────────────────────────────────────

  private getAuthHeader(): string {
    const credentials = Buffer.from(
      `${this.dataForSeoLogin}:${this.dataForSeoPassword}`,
    ).toString('base64');
    return `Basic ${credentials}`;
  }

  private async fetchTopicsFromDataForSeo(
    topic: string,
    country: string,
  ): Promise<TopicCard[]> {
    try {
      const response = await axios.post(
        'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live',
        [
          {
            keyword: topic,
            location_code: this.countryToLocationCode(country),
            language_code: 'en',
            limit: 100,
            include_seed_keyword: false,
          },
        ],
        {
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const taskResult = response.data?.tasks?.[0]?.result?.[0];
      if (!taskResult?.items) {
        return this.getMockTopics(topic);
      }

      // Group suggestions into topic clusters
      const clusters = this.clusterIntoTopics(taskResult.items, topic);
      return clusters;
    } catch (err) {
      this.logger.error(`DataForSEO topic research error: ${err}`);
      return this.getMockTopics(topic);
    }
  }

  private async fetchSubtopicsFromDataForSeo(
    topic: string,
    country: string,
    limit: number,
  ): Promise<{ subtopics: Subtopic[]; headlines: string[]; questions: string[] }> {
    try {
      const response = await axios.post(
        'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live',
        [
          {
            keyword: topic,
            location_code: this.countryToLocationCode(country),
            language_code: 'en',
            limit,
            include_seed_keyword: true,
          },
        ],
        {
          headers: {
            Authorization: this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const taskResult = response.data?.tasks?.[0]?.result?.[0];
      if (!taskResult?.items) {
        return this.getMockSubtopics(topic);
      }

      const subtopics: Subtopic[] = taskResult.items.map((item: any) => ({
        keyword: item.keyword,
        searchVolume: item.keyword_info?.search_volume ?? null,
        difficulty: item.keyword_properties?.keyword_difficulty
          ? Math.round(item.keyword_properties.keyword_difficulty)
          : null,
        cpc: item.keyword_info?.cpc ?? null,
        intent: 'INFORMATIONAL' as SearchIntent,
        topicEfficiency: null,
        isQuestion: false,
        wordCount: 0,
      }));

      const questions = subtopics
        .filter((s) => this.isQuestionKeyword(s.keyword))
        .map((s) => s.keyword)
        .slice(0, 10);

      const headlines = this.generateHeadlines(topic, subtopics);

      return { subtopics, headlines, questions };
    } catch (err) {
      this.logger.error(`DataForSEO subtopics error: ${err}`);
      return this.getMockSubtopics(topic);
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

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          temperature: 0.5,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are an SEO topic research expert. Given a seed topic, generate 15-20 related topic clusters that people search for. Each cluster is a broader subtopic related to the seed keyword. Return ONLY valid JSON:
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
            },
            {
              role: 'user',
              content: `Seed topic: "${topic}"\nCountry: ${country}${domainContext}\nGenerate 15-20 topic clusters.`,
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

      return (parsed.topics || []).map((t: any) => ({
        topic: t.topic,
        searchVolume: t.searchVolume ?? null,
        difficulty: t.difficulty ?? null,
        topicEfficiency: null,
        subtopicCount: t.subtopicCount ?? 5,
        intent: 'INFORMATIONAL' as SearchIntent,
      }));
    } catch (err) {
      this.logger.error(`OpenAI topic research error: ${err}`);
      return this.getMockTopics(topic);
    }
  }

  private async fetchSubtopicsFromOpenAI(
    topic: string,
    parentTopic: string,
    country: string,
  ): Promise<{ subtopics: Subtopic[]; headlines: string[]; questions: string[] }> {
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
              content: `You are an SEO content research expert. Given a topic and its parent topic, generate related subtopics (keywords), headline ideas, and common questions people ask. Return ONLY valid JSON:
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
            },
            {
              role: 'user',
              content: `Topic: "${topic}"\nParent topic: "${parentTopic}"\nCountry: ${country}`,
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
      this.logger.error(`OpenAI subtopics error: ${err}`);
      return this.getMockSubtopics(topic);
    }
  }

  // ─── MOCK DATA ──────────────────────────────────────────

  private getMockTopics(topic: string): TopicCard[] {
    const modifiers = [
      'best', 'how to', 'top', 'guide', 'tips', 'for beginners',
      'tools', 'strategies', 'examples', 'trends', 'ideas',
      'checklist', 'vs', 'benefits', 'mistakes', 'templates',
    ];

    return modifiers.map((mod) => {
      const topicName = `${mod} ${topic}`.trim();
      const h = this.simpleHash(topicName);
      const volume = 200 + (h % 40000);
      const difficulty = 5 + (h % 85);

      return {
        topic: topicName,
        searchVolume: volume,
        difficulty,
        topicEfficiency: null,
        subtopicCount: 3 + (h % 12),
        intent: 'INFORMATIONAL' as SearchIntent,
      };
    });
  }

  private getMockSubtopics(topic: string): {
    subtopics: Subtopic[];
    headlines: string[];
    questions: string[];
  } {
    const suffixes = [
      'guide', 'tips', 'examples', 'tools', 'software',
      'free', 'best practices', 'strategy', 'tutorial', 'course',
      'for small business', 'templates', 'checklist', 'framework', 'audit',
    ];

    const subtopics: Subtopic[] = suffixes.map((suf) => {
      const kw = `${topic} ${suf}`;
      const h = this.simpleHash(kw);
      return {
        keyword: kw,
        searchVolume: 100 + (h % 25000),
        difficulty: 5 + (h % 85),
        cpc: parseFloat((0.1 + (h % 1200) / 100).toFixed(2)),
        intent: 'INFORMATIONAL' as SearchIntent,
        topicEfficiency: null,
        isQuestion: false,
        wordCount: 0,
      };
    });

    const headlines = [
      `The Ultimate Guide to ${topic}`,
      `10 ${topic} Tips That Actually Work`,
      `${topic}: Everything You Need to Know in 2026`,
      `How to Master ${topic} Step by Step`,
      `${topic} for Beginners: A Complete Walkthrough`,
      `Why ${topic} Matters More Than Ever`,
      `${topic} Best Practices: Expert Insights`,
      `The Complete ${topic} Checklist`,
    ];

    const questions = [
      `What is ${topic}?`,
      `How does ${topic} work?`,
      `Why is ${topic} important?`,
      `How to get started with ${topic}?`,
      `What are the best ${topic} tools?`,
      `How much does ${topic} cost?`,
      `Is ${topic} worth it?`,
      `What are common ${topic} mistakes?`,
    ];

    return { subtopics, headlines, questions };
  }

  // ─── CLUSTERING ─────────────────────────────────────────

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

    return cards.length > 0 ? cards : this.getMockTopics(seedTopic);
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

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
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
}
