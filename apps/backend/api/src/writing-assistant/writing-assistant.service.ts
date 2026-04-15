import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WritingAssistantService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE DOCUMENT ───────────────────────────────────

  async createDocument(
    userId: string,
    data: {
      title?: string;
      content?: string;
      projectId?: string;
      targetKeywords?: string[];
      targetTone?: string;
    },
  ) {
    const doc = await this.prisma.writingDocument.create({
      data: {
        userId,
        projectId: data.projectId || null,
        title: data.title || 'Untitled',
        content: data.content || '',
        plainText: this.stripHtml(data.content || ''),
        targetKeywords: data.targetKeywords || [],
        targetTone: data.targetTone || 'neutral',
        wordCount: this.countWords(this.stripHtml(data.content || '')),
      },
    });

    return doc;
  }

  // ─── LIST DOCUMENTS ────────────────────────────────────

  async listDocuments(
    userId: string,
    projectId?: string,
    page = 1,
    limit = 20,
  ) {
    const where: any = { userId };
    if (projectId) where.projectId = projectId;

    const [documents, total] = await Promise.all([
      this.prisma.writingDocument.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          wordCount: true,
          overallScore: true,
          readabilityScore: true,
          seoScore: true,
          originalityScore: true,
          toneScore: true,
          targetTone: true,
          projectId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.writingDocument.count({ where }),
    ]);

    return { documents, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── GET DOCUMENT ──────────────────────────────────────

  async getDocument(userId: string, documentId: string) {
    const doc = await this.prisma.writingDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) throw new NotFoundException('Document not found');
    if (doc.userId !== userId)
      throw new ForbiddenException('Access denied');

    return doc;
  }

  // ─── UPDATE DOCUMENT ───────────────────────────────────

  async updateDocument(
    userId: string,
    documentId: string,
    data: {
      title?: string;
      content?: string;
      plainText?: string;
      targetKeywords?: string[];
      metaDescription?: string;
      readabilityScore?: number;
      seoScore?: number;
      originalityScore?: number;
      toneScore?: number;
      overallScore?: number;
      targetTone?: string;
      wordCount?: number;
    },
  ) {
    const doc = await this.prisma.writingDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) throw new NotFoundException('Document not found');
    if (doc.userId !== userId)
      throw new ForbiddenException('Access denied');

    const updateData: any = { ...data };

    // Recompute plainText and wordCount if content changed
    if (data.content !== undefined) {
      updateData.plainText = data.plainText || this.stripHtml(data.content);
      updateData.wordCount =
        data.wordCount ?? this.countWords(updateData.plainText);
    }

    return this.prisma.writingDocument.update({
      where: { id: documentId },
      data: updateData,
    });
  }

  // ─── DELETE DOCUMENT ───────────────────────────────────

  async deleteDocument(userId: string, documentId: string) {
    const doc = await this.prisma.writingDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) throw new NotFoundException('Document not found');
    if (doc.userId !== userId)
      throw new ForbiddenException('Access denied');

    await this.prisma.writingDocument.delete({
      where: { id: documentId },
    });

    return { deleted: true };
  }

  // ─── SEO KEYWORD DATA ─────────────────────────────────

  async getSeoKeywordData(keywords: string[], country = 'AU') {
    const results = await Promise.all(
      keywords.map(async (keyword) => {
        const cached = await this.prisma.keywordCache.findUnique({
          where: {
            keyword_country: { keyword: keyword.toLowerCase(), country },
          },
        });

        return {
          keyword,
          searchVolume: cached?.searchVolume ?? null,
          difficulty: cached?.difficulty ?? null,
          cpc: cached?.cpc ?? null,
        };
      }),
    );

    return { keywords: results };
  }

  // ─── HELPERS ───────────────────────────────────────────

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
  }
}
