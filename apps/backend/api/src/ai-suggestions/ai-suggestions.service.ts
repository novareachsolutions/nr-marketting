import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiSuggestionsService {
  private readonly logger = new Logger(AiSuggestionsService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;
  }

  async getSuggestions(
    module: string,
    context: Record<string, any>,
  ): Promise<{ suggestions: string[] }> {
    if (!this.hasOpenAI) {
      throw new BadRequestException('OpenAI API key is not configured');
    }

    // Build cache key from module + stringified context
    const contextStr = JSON.stringify(context, Object.keys(context).sort());
    const cacheKey = `${module}|${this.simpleHash(contextStr)}`;

    // Check cache (7-day TTL)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const cached = await this.prisma.aiSuggestionsCache.findUnique({
      where: { cacheKey },
    });

    if (cached && cached.updatedAt > sevenDaysAgo) {
      return cached.data as unknown as { suggestions: string[] };
    }

    const systemPrompt = this.getSystemPrompt(module);
    const userPrompt = this.getUserPrompt(module, context);

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          temperature: 0.5,
          max_tokens: 1000,
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
          timeout: 30000,
        },
      );

      const content = response.data.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content);
      const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 5)
        : [];

      const result = { suggestions };

      // Cache result
      await this.prisma.aiSuggestionsCache.upsert({
        where: { cacheKey },
        create: { cacheKey, data: result as any },
        update: { data: result as any },
      });

      return result;
    } catch (err: any) {
      this.logger.error(`AI suggestions error: ${err?.message}`);
      throw new BadRequestException('Failed to generate suggestions.');
    }
  }

  private getSystemPrompt(module: string): string {
    const prompts: Record<string, string> = {
      'domain-overview': `You are an SEO consultant analyzing a domain overview. Based on the metrics provided, give 3-5 specific, actionable suggestions to improve the domain's SEO performance. Focus on authority, traffic growth, and backlink strategy.`,
      'organic-rankings': `You are an SEO consultant analyzing organic rankings data. Based on the keywords, positions, and changes, give 3-5 specific, actionable suggestions to improve organic rankings. Focus on position improvements, content optimization, and SERP feature opportunities.`,
      'top-pages': `You are an SEO consultant analyzing top pages data. Based on the page performance metrics, give 3-5 specific, actionable suggestions to improve page-level SEO. Focus on content optimization, internal linking, and traffic growth.`,
      'compare-domains': `You are an SEO consultant analyzing a domain comparison. Based on the competitive metrics, give 3-5 specific, actionable suggestions highlighting competitive advantages, weaknesses, and opportunities.`,
      'keyword-gap': `You are an SEO consultant analyzing keyword gaps. Based on the gap analysis, give 3-5 specific, actionable suggestions for closing keyword gaps. Focus on missing keywords, content creation priorities, and quick wins.`,
      'backlink-gap': `You are an SEO consultant analyzing backlink gaps. Based on the referring domain analysis, give 3-5 specific, actionable suggestions for link building outreach. Focus on high-authority prospects and outreach strategy.`,
      'keyword-research': `You are an SEO consultant analyzing keyword research data. Based on the keyword metrics, give 3-5 specific, actionable suggestions for keyword targeting strategy. Focus on difficulty, intent, and content planning.`,
      'suggest-competitors': `You are an SEO competitive analyst. Given a domain, suggest 5 competitor domains that operate in the same niche/industry. For each, provide the domain and a brief reason why they're a competitor. Return JSON: {"suggestions":["domain1.com - They compete for similar keywords in your niche","domain2.com - Major player in your industry with overlapping audience"]}. Each suggestion MUST be formatted as "domain.com - reason". Use real, well-known domains relevant to the given domain's industry.`,
    };
    return (prompts[module] || prompts['domain-overview']) +
      (module === 'suggest-competitors' ? '' : ` Return JSON: {"suggestions":["<suggestion 1>","<suggestion 2>","<suggestion 3>"]}. Each suggestion should be 1-2 sentences, specific, and actionable. Reference actual numbers from the data.`);
  }

  private getUserPrompt(module: string, context: Record<string, any>): string {
    return `Module: ${module}\nData:\n${JSON.stringify(context, null, 0)}`;
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
