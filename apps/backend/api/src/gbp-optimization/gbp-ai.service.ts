import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { GbpPostType } from '@prisma/client';

@Injectable()
export class GbpAiService {
  private readonly logger = new Logger(GbpAiService.name);
  private readonly openaiKey: string;
  private readonly hasOpenAI: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.hasOpenAI = this.openaiKey.length > 0;
  }

  // ─── POST DRAFT ────────────────────────────────────────

  async draftPost(
    userId: string,
    locationId: string,
    opts: { type?: GbpPostType; topic?: string; tone?: string },
  ) {
    const location = await this.prisma.gbpLocation.findUnique({
      where: { id: locationId },
    });
    if (!location) throw new NotFoundException('Location not found');
    if (location.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    this.ensureOpenAI();

    const type = opts.type || 'UPDATE';
    const tone = opts.tone || 'friendly and professional';
    const topic = opts.topic || 'general business update';

    const system = `You are a GBP (Google Business Profile) post writer. Write engaging, compliant posts that drive customer action.

Rules:
- Max 1500 characters, but target 250-500 for best engagement.
- Do NOT use phone numbers or URLs in the body (Google strips them).
- No clickbait, no misleading claims, no emojis unless the tone is casual.
- End with a clear call to action phrase appropriate for the type.
- Return a JSON object: { "content": string, "ctaType": "LEARN_MORE"|"BOOK"|"ORDER"|"SHOP"|"CALL"|"SIGN_UP" }`;

    const user = `Business: ${location.name}
Category: ${location.primaryCategory || 'local business'}
City: ${location.city || 'local area'}
Description: ${location.description || 'n/a'}

Post type: ${type}
Tone: ${tone}
Topic: ${topic}

Write the post now.`;

    const raw = await this.callOpenAI(system, user, 800);
    return {
      content: String(raw.content || '').slice(0, 1500),
      ctaType: raw.ctaType || 'LEARN_MORE',
    };
  }

  // ─── REVIEW REPLY DRAFT ────────────────────────────────

  async draftReviewReply(input: {
    businessName: string;
    rating: number;
    comment: string;
    reviewerName?: string;
  }): Promise<string> {
    this.ensureOpenAI();

    const system = `You are a customer success manager drafting replies to Google reviews.

Rules:
- Keep replies under 500 characters.
- Address the reviewer by first name if provided.
- For 4-5 star reviews: thank them warmly, reinforce one positive they mentioned, invite them back.
- For 3 star reviews: thank them, acknowledge the mixed feedback, offer a direct way to improve the next visit.
- For 1-2 star reviews: apologize sincerely, take responsibility (without admitting legal fault), invite them to contact you to make it right. Never argue.
- Never include phone numbers, URLs, or full email addresses.
- Be genuine, non-templated, and avoid corporate jargon.
- Return JSON: { "reply": string }`;

    const user = `Business: ${input.businessName}
Reviewer: ${input.reviewerName || 'Customer'}
Rating: ${input.rating}/5
Review: "${input.comment}"

Draft the reply now.`;

    const raw = await this.callOpenAI(system, user, 400);
    return String(raw.reply || '').slice(0, 500);
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
          temperature: 0.7,
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
}
