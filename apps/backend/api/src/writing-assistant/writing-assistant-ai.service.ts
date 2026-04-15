import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WritingAssistantAiService {
  private readonly logger = new Logger(WritingAssistantAiService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;
  }

  // ─── REPHRASE ──────────────────────────────────────────

  async rephrase(
    text: string,
    mode: 'simplify' | 'expand' | 'rephrase' | 'summarize',
    context?: string,
  ): Promise<{ result: string }> {
    this.ensureOpenAI();

    const cacheKey = `rephrase|${mode}|${this.simpleHash(text)}`;
    const cached = await this.getCache(cacheKey, 1);
    if (cached) return cached as { result: string };

    const systemPrompts: Record<string, string> = {
      simplify:
        'Rewrite the following text in simpler, clearer language. Use shorter sentences and common words. Maintain the same meaning. Return JSON: {"result": "<rewritten text>"}',
      expand:
        'Expand the following text with more detail, examples, and explanation. Roughly double the length. Keep the same tone and meaning. Return JSON: {"result": "<expanded text>"}',
      rephrase:
        'Rephrase the following text using different words and sentence structures while keeping the exact same meaning. Return JSON: {"result": "<rephrased text>"}',
      summarize:
        'Summarize the following text to roughly 1/3 its original length. Keep the most important points. Return JSON: {"result": "<summarized text>"}',
    };

    const userPrompt = context
      ? `Context from surrounding content:\n${context.slice(0, 500)}\n\nText to ${mode}:\n${text}`
      : `Text to ${mode}:\n${text}`;

    const result = await this.callOpenAI(systemPrompts[mode], userPrompt, 1500);
    await this.setCache(cacheKey, result);
    return result as { result: string };
  }

  // ─── COMPOSE ───────────────────────────────────────────

  async compose(
    topic: string,
    keywords?: string[],
    tone?: string,
    contentType?: string,
    length?: string,
  ): Promise<{ content: string; outline?: string[] }> {
    this.ensureOpenAI();

    const cacheKey = `compose|${this.simpleHash(
      JSON.stringify({ topic, keywords, tone, contentType, length }),
    )}`;
    const cached = await this.getCache(cacheKey, 1);
    if (cached) return cached as { content: string; outline?: string[] };

    const systemPrompt = `You are an SEO content writer. Generate high-quality ${contentType || 'paragraph'} content about the given topic. Target tone: ${tone || 'neutral'}. Target length: ${length || 'medium'}. If keywords are provided, naturally incorporate them. Return JSON: {"content": "<generated HTML content with <h2>, <p>, <ul> tags>", "outline": ["section 1", "section 2"]}`;

    const maxTokens =
      length === 'long' ? 3000 : length === 'short' ? 800 : 1500;

    const userPrompt = `Topic: ${topic}\nKeywords: ${(keywords || []).join(', ') || 'none'}\nContent type: ${contentType || 'paragraph'}\nLength: ${length || 'medium'}`;

    const result = await this.callOpenAI(systemPrompt, userPrompt, maxTokens);
    await this.setCache(cacheKey, result);
    return result as { content: string; outline?: string[] };
  }

  // ─── ASK AI ────────────────────────────────────────────

  async askAi(
    question: string,
    topic?: string,
    currentContent?: string,
  ): Promise<{ answer: string }> {
    this.ensureOpenAI();

    const systemPrompt =
      'You are a knowledgeable SEO content assistant. Answer the user\'s question about the given topic. If document content is provided, base your answer on that context. Give concise, actionable answers. Return JSON: {"answer": "<your answer>"}';

    const parts = [`Question: ${question}`];
    if (topic) parts.push(`Topic: ${topic}`);
    if (currentContent)
      parts.push(
        `Document context (first 2000 chars): ${currentContent.slice(0, 2000)}`,
      );

    return (await this.callOpenAI(
      systemPrompt,
      parts.join('\n'),
      1500,
    )) as { answer: string };
  }

  // ─── CHECK ORIGINALITY ─────────────────────────────────

  async checkOriginality(
    text: string,
  ): Promise<{
    score: number;
    flags: { sentence: string; concern: string }[];
  }> {
    this.ensureOpenAI();

    const systemPrompt = `You are a content originality analyst. Analyze the following text and assess how original and unique it appears. Score from 0-100 where 100 is completely original and 0 is likely copied. Look for: generic/templated phrases, overly common sentence structures, lack of unique voice, potential paraphrasing of well-known sources, and cliche-heavy writing. Flag specific sentences that appear particularly generic or potentially unoriginal. Return JSON: {"score": <number>, "flags": [{"sentence": "<flagged text>", "concern": "<brief explanation>"}]}. Limit flags to the 5 most concerning passages. Be fair — most human-written content scores 60-85.`;

    return (await this.callOpenAI(
      systemPrompt,
      `Text to analyze:\n${text.slice(0, 5000)}`,
      1500,
    )) as { score: number; flags: { sentence: string; concern: string }[] };
  }

  // ─── CHECK TONE ────────────────────────────────────────

  async checkTone(
    text: string,
    targetTone: string,
  ): Promise<{
    score: number;
    detectedTone: string;
    segments: { text: string; tone: string; consistent: boolean }[];
  }> {
    this.ensureOpenAI();

    const systemPrompt = `You are a tone of voice analyst. The user wants their content to sound "${targetTone}". Analyze the text and score how consistently it matches the target tone from 0-100. Identify the detected overall tone and flag segments that deviate from the target. Return JSON: {"score": <number>, "detectedTone": "<formal|casual|neutral|mixed>", "segments": [{"text": "<segment text>", "tone": "<detected tone>", "consistent": <boolean>}]}. Limit segments to the 5 most notable (prioritize inconsistent ones).`;

    return (await this.callOpenAI(
      systemPrompt,
      `Text to analyze:\n${text.slice(0, 5000)}`,
      1500,
    )) as {
      score: number;
      detectedTone: string;
      segments: { text: string; tone: string; consistent: boolean }[];
    };
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
          temperature: 0.5,
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
          timeout: 30000,
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

    const cached = await this.prisma.writingAiCache.findUnique({
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
    await this.prisma.writingAiCache.upsert({
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
