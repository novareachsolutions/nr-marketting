import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GbpApiService } from './gbp-api.service';
import { GbpAiService } from './gbp-ai.service';

@Injectable()
export class GbpReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gbpApi: GbpApiService,
    private readonly aiService: GbpAiService,
  ) {}

  async listReviews(
    userId: string,
    locationId: string,
    page = 1,
    limit = 20,
  ) {
    const location = await this.prisma.gbpLocation.findUnique({
      where: { id: locationId },
    });
    if (!location) throw new NotFoundException('Location not found');
    if (location.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Sync fresh reviews from Google (lightweight mock in mock mode)
    await this.syncReviews(userId, location.id, location.googleLocationId);

    const [reviews, total, aggregate] = await Promise.all([
      this.prisma.gbpReview.findMany({
        where: { locationId: location.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.gbpReview.count({ where: { locationId: location.id } }),
      this.prisma.gbpReview.aggregate({
        where: { locationId: location.id },
        _avg: { rating: true },
      }),
    ]);

    const unreplied = await this.prisma.gbpReview.count({
      where: { locationId: location.id, replyText: null },
    });

    return {
      reviews,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      avgRating: Number((aggregate._avg.rating || 0).toFixed(2)),
      unrepliedCount: unreplied,
    };
  }

  async replyToReview(userId: string, reviewId: string, reply: string) {
    if (!reply || reply.trim().length === 0) {
      throw new BadRequestException('Reply text is required');
    }

    const review = await this.prisma.gbpReview.findUnique({
      where: { id: reviewId },
      include: { location: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.location.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.gbpApi.replyToReview(userId, review.googleReviewId, reply);

    return this.prisma.gbpReview.update({
      where: { id: reviewId },
      data: {
        replyText: reply,
        repliedAt: new Date(),
        repliedBy: 'user',
      },
    });
  }

  async generateAiReply(userId: string, reviewId: string) {
    const review = await this.prisma.gbpReview.findUnique({
      where: { id: reviewId },
      include: { location: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.location.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const suggestion = await this.aiService.draftReviewReply({
      businessName: review.location.name,
      rating: review.rating,
      comment: review.comment || '',
      reviewerName: review.reviewerName || undefined,
    });

    return { suggestion };
  }

  private async syncReviews(
    userId: string,
    locationId: string,
    googleLocationId: string,
  ) {
    const remote = await this.gbpApi.listReviews(userId, googleLocationId);

    await Promise.all(
      remote.map((r) =>
        this.prisma.gbpReview.upsert({
          where: {
            locationId_googleReviewId: {
              locationId,
              googleReviewId: r.googleReviewId,
            },
          },
          create: {
            locationId,
            googleReviewId: r.googleReviewId,
            reviewerName: r.reviewerName,
            reviewerPhoto: r.reviewerPhoto,
            rating: r.rating,
            comment: r.comment,
            language: r.language,
            replyText: r.replyText,
            repliedAt: r.repliedAt || null,
            repliedBy: r.replyText ? 'user' : null,
            sentiment: this.classifySentiment(r.rating),
            createdAt: r.createdAt,
          },
          update: {
            rating: r.rating,
            comment: r.comment,
            replyText: r.replyText,
            repliedAt: r.repliedAt || null,
            sentiment: this.classifySentiment(r.rating),
          },
        }),
      ),
    );
  }

  private classifySentiment(rating: number): string {
    if (rating >= 4) return 'positive';
    if (rating === 3) return 'neutral';
    return 'negative';
  }
}
