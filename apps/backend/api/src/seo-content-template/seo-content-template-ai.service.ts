import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

export interface RivalItem {
  rank: number;
  url: string;
  title: string;
  snippet: string;
  totalOccurrences: number;
  exampleSentences: string[];
}

export interface GeneratedBrief {
  topRivals: RivalItem[];
  backlinkTargets: string[];
  semanticKeywords: string[];
  avgReadability: number;
  recommendedWordCount: number;
  titleSuggestion: string;
  metaSuggestion: string;
  h1Suggestion: string;
}

@Injectable()
export class SeoContentTemplateAiService {
  private readonly logger = new Logger(SeoContentTemplateAiService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;
  }

  // ─── GENERATE BRIEF ────────────────────────────────────

  async generateBrief(
    keywords: string[],
    country: string,
  ): Promise<GeneratedBrief> {
    this.ensureOpenAI();

    const cacheKey = `brief|${country}|${this.simpleHash(
      keywords.map((k) => k.toLowerCase()).sort().join('|'),
    )}`;

    const cached = await this.getCache(cacheKey, 7);
    if (cached) return cached as unknown as GeneratedBrief;

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(keywords, country);

    const raw = await this.callOpenAI(systemPrompt, userPrompt, 4000);
    const brief = this.normalizeBrief(raw, keywords);

    await this.setCache(cacheKey, brief as any);
    return brief;
  }

  // ─── PROMPTS ───────────────────────────────────────────

  private buildSystemPrompt(): string {
    return `You are an expert SEO content strategist. Given target keywords and a country, produce a comprehensive SEO content brief that mirrors what Semrush's "SEO Content Template" tool returns.

Your job is to estimate — based on your knowledge of the web — what the top 10 Google-ranking pages for these keywords would likely look like, and extract actionable recommendations.

Return a single JSON object with EXACTLY this shape (no extra keys, no missing keys):

{
  "topRivals": [
    {
      "rank": 1,
      "url": "https://example.com/page",
      "title": "Page title as it would appear in SERP",
      "snippet": "A 2-3 sentence excerpt from the page showing how the keyword is used in context",
      "totalOccurrences": 12,
      "exampleSentences": [
        "First sentence showing keyword usage.",
        "Second sentence showing keyword usage."
      ]
    }
    // ... exactly 10 items, ranks 1-10
  ],
  "backlinkTargets": [
    "example-blog.com",
    "industry-publication.com"
    // ... exactly 15 realistic referring-domain suggestions
  ],
  "semanticKeywords": [
    "related term 1",
    "related term 2"
    // ... 12-18 semantically related / LSI keywords
  ],
  "avgReadability": 65,
  "recommendedWordCount": 1900,
  "titleSuggestion": "A compelling page title (≤55 chars) containing the primary target keyword exactly once",
  "metaSuggestion": "A compelling meta description (≤160 chars) containing the primary target keyword",
  "h1Suggestion": "An H1 heading containing the primary target keyword exactly once"
}

Rules:
- "topRivals" MUST have exactly 10 items.
- "backlinkTargets" MUST have exactly 15 items. Use bare domains (no https://, no paths).
- "semanticKeywords" should be 12-18 LSI / semantically related terms writers should naturally include.
- "avgReadability" is a Flesch reading-ease style score from 0-100 (50-70 is typical for well-written content).
- "recommendedWordCount" is an integer (usually 800-3000).
- "titleSuggestion" MUST be 55 characters or fewer.
- "metaSuggestion" MUST be 160 characters or fewer.
- URLs in topRivals must be plausible real-looking URLs. Favor domains that would realistically rank (major brands, established publishers) and reflect the country's TLD where relevant (e.g. .com.au for Australia, .co.uk for UK).
- "exampleSentences" should contain the target keyword and show how competitors naturally use it in prose.
- Return ONLY the JSON object. No markdown, no commentary.`;
  }

  private buildUserPrompt(keywords: string[], country: string): string {
    const countryName = this.countryName(country);
    return `Target keywords: ${keywords.join(', ')}
Country: ${countryName} (${country})

Generate the SEO content brief JSON now.`;
  }

  private countryName(code: string): string {
    const map: Record<string, string> = {
      US: 'United States',
      GB: 'United Kingdom',
      UK: 'United Kingdom',
      AU: 'Australia',
      CA: 'Canada',
      IN: 'India',
      DE: 'Germany',
      FR: 'France',
      ES: 'Spain',
      IT: 'Italy',
      BR: 'Brazil',
      JP: 'Japan',
      SG: 'Singapore',
      NZ: 'New Zealand',
    };
    return map[code.toUpperCase()] || code;
  }

  // ─── NORMALIZE / VALIDATE ──────────────────────────────

  private normalizeBrief(
    raw: Record<string, any>,
    keywords: string[],
  ): GeneratedBrief {
    const primaryKw = keywords[0] || '';

    const topRivals: RivalItem[] = Array.isArray(raw.topRivals)
      ? raw.topRivals.slice(0, 10).map((r: any, idx: number) => ({
          rank: Number(r.rank) || idx + 1,
          url: String(r.url || ''),
          title: String(r.title || ''),
          snippet: String(r.snippet || ''),
          totalOccurrences: Number(r.totalOccurrences) || 0,
          exampleSentences: Array.isArray(r.exampleSentences)
            ? r.exampleSentences.map((s: any) => String(s)).slice(0, 5)
            : [],
        }))
      : [];

    const backlinkTargets: string[] = Array.isArray(raw.backlinkTargets)
      ? raw.backlinkTargets
          .map((d: any) => String(d).replace(/^https?:\/\//, '').replace(/\/$/, ''))
          .slice(0, 15)
      : [];

    const semanticKeywords: string[] = Array.isArray(raw.semanticKeywords)
      ? raw.semanticKeywords.map((s: any) => String(s)).slice(0, 20)
      : [];

    return {
      topRivals,
      backlinkTargets,
      semanticKeywords,
      avgReadability: this.clampInt(raw.avgReadability, 0, 100, 60),
      recommendedWordCount: this.clampInt(raw.recommendedWordCount, 200, 10000, 1500),
      titleSuggestion: String(raw.titleSuggestion || primaryKw).slice(0, 70),
      metaSuggestion: String(raw.metaSuggestion || '').slice(0, 200),
      h1Suggestion: String(raw.h1Suggestion || primaryKw).slice(0, 120),
    };
  }

  private clampInt(v: any, min: number, max: number, fallback: number): number {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  // ─── HELPERS ───────────────────────────────────────────

  private ensureOpenAI() {
    if (!this.hasOpenAI) {
      throw new BadRequestException('OpenAI API key is not configured');
    }
  }

  private async callOpenAI(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
  ): Promise<Record<string, any>> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          temperature: 0.4,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        },
      );

      const content = response.data.choices?.[0]?.message?.content;
      return JSON.parse(content);
    } catch (err: any) {
      this.logger.error(`OpenAI error: ${err?.message}`);
      throw new BadRequestException('AI request failed. Please try again.');
    }
  }

  private async getCache(
    cacheKey: string,
    ttlDays: number,
  ): Promise<Record<string, any> | null> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ttlDays);

    const cached = await this.prisma.seoBriefCache.findUnique({
      where: { cacheKey },
    });

    if (cached && cached.updatedAt > cutoff) {
      return cached.data as Record<string, any>;
    }
    return null;
  }

  private async setCache(
    cacheKey: string,
    data: Record<string, any>,
  ): Promise<void> {
    await this.prisma.seoBriefCache.upsert({
      where: { cacheKey },
      create: { cacheKey, data: data as any },
      update: { data: data as any },
    });
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return String(Math.abs(hash));
  }
}
