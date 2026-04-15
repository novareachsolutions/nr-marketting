import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SeoContentTemplateAiService, GeneratedBrief } from './seo-content-template-ai.service';

@Injectable()
export class SeoContentTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: SeoContentTemplateAiService,
  ) {}

  // ─── GENERATE BRIEF ────────────────────────────────────

  async generateBrief(
    userId: string,
    data: {
      targetKeywords: string[];
      country?: string;
      projectId?: string;
    },
  ) {
    const keywords = (data.targetKeywords || [])
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywords.length === 0) {
      throw new NotFoundException('At least one target keyword is required');
    }

    const country = (data.country || 'US').toUpperCase();
    const brief: GeneratedBrief = await this.aiService.generateBrief(
      keywords,
      country,
    );

    const saved = await this.prisma.seoContentBrief.create({
      data: {
        userId,
        projectId: data.projectId || null,
        targetKeywords: keywords as any,
        country,
        topRivals: brief.topRivals as any,
        backlinkTargets: brief.backlinkTargets as any,
        semanticKeywords: brief.semanticKeywords as any,
        avgReadability: brief.avgReadability,
        recommendedWordCount: brief.recommendedWordCount,
        titleSuggestion: brief.titleSuggestion,
        metaSuggestion: brief.metaSuggestion,
        h1Suggestion: brief.h1Suggestion,
        status: 'ready',
      },
    });

    return saved;
  }

  // ─── LIST BRIEFS ───────────────────────────────────────

  async listBriefs(
    userId: string,
    projectId?: string,
    page = 1,
    limit = 20,
  ) {
    const where: any = { userId };
    if (projectId) where.projectId = projectId;

    const [briefs, total] = await Promise.all([
      this.prisma.seoContentBrief.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          targetKeywords: true,
          country: true,
          avgReadability: true,
          recommendedWordCount: true,
          status: true,
          projectId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.seoContentBrief.count({ where }),
    ]);

    return { briefs, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── GET BRIEF ─────────────────────────────────────────

  async getBrief(userId: string, briefId: string) {
    const brief = await this.prisma.seoContentBrief.findUnique({
      where: { id: briefId },
    });

    if (!brief) throw new NotFoundException('Brief not found');
    if (brief.userId !== userId)
      throw new ForbiddenException('Access denied');

    return brief;
  }

  // ─── DELETE BRIEF ──────────────────────────────────────

  async deleteBrief(userId: string, briefId: string) {
    const brief = await this.prisma.seoContentBrief.findUnique({
      where: { id: briefId },
    });

    if (!brief) throw new NotFoundException('Brief not found');
    if (brief.userId !== userId)
      throw new ForbiddenException('Access denied');

    await this.prisma.seoContentBrief.delete({ where: { id: briefId } });
    return { deleted: true };
  }

  // ─── SEND TO WRITING ASSISTANT ─────────────────────────

  async sendToWritingAssistant(userId: string, briefId: string) {
    const brief = await this.getBrief(userId, briefId);

    const keywords = (brief.targetKeywords as string[]) || [];
    const semantic = (brief.semanticKeywords as string[]) || [];

    const initialHtml = this.buildInitialDocument(brief, keywords, semantic);

    const doc = await this.prisma.writingDocument.create({
      data: {
        userId,
        projectId: brief.projectId || null,
        title: brief.titleSuggestion || `Content for ${keywords.join(', ')}`,
        content: initialHtml,
        plainText: initialHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        targetKeywords: keywords as any,
        metaDescription: brief.metaSuggestion,
        targetTone: 'neutral',
        wordCount: 0,
      },
    });

    return { documentId: doc.id };
  }

  private buildInitialDocument(
    brief: any,
    keywords: string[],
    semantic: string[],
  ): string {
    const semanticItems = semantic
      .map((s) => `<li>${this.escapeHtml(s)}</li>`)
      .join('');

    return [
      `<h1>${this.escapeHtml(brief.h1Suggestion || keywords[0] || 'New article')}</h1>`,
      `<p><em>Target keywords:</em> ${keywords.map((k) => this.escapeHtml(k)).join(', ')}</p>`,
      `<p><em>Target length:</em> ~${brief.recommendedWordCount} words · <em>Target readability:</em> ${brief.avgReadability}/100</p>`,
      `<h2>Semantic keywords to include</h2>`,
      `<ul>${semanticItems}</ul>`,
      `<h2>Introduction</h2>`,
      `<p>Start writing here…</p>`,
    ].join('\n');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
