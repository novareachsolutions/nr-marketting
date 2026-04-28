import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GbpApiService } from './gbp-api.service';
import { GbpPostType } from '@prisma/client';

@Injectable()
export class GbpPostsService {
  private readonly logger = new Logger(GbpPostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gbpApi: GbpApiService,
  ) {}

  async listPosts(
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

    const [posts, total] = await Promise.all([
      this.prisma.gbpPost.findMany({
        where: { locationId },
        orderBy: [
          { scheduledAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.gbpPost.count({ where: { locationId } }),
    ]);

    return { posts, total, page, totalPages: Math.ceil(total / limit) };
  }

  async createPost(
    userId: string,
    locationId: string,
    body: {
      type: GbpPostType;
      content: string;
      mediaUrl?: string;
      ctaType?: string;
      ctaUrl?: string;
      couponCode?: string;
      offerTerms?: string;
      eventTitle?: string;
      eventStart?: string;
      eventEnd?: string;
      scheduledAt?: string;
    },
  ) {
    const location = await this.prisma.gbpLocation.findUnique({
      where: { id: locationId },
    });
    if (!location) throw new NotFoundException('Location not found');
    if (location.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const content = (body.content || '').trim();
    if (!content) throw new BadRequestException('Post content is required');
    if (content.length > 1500) {
      throw new BadRequestException(
        'Post content must be 1500 characters or fewer',
      );
    }

    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    const now = new Date();
    const shouldPublishNow = !scheduledAt || scheduledAt <= now;

    const created = await this.prisma.gbpPost.create({
      data: {
        userId,
        locationId,
        type: body.type || 'UPDATE',
        status: shouldPublishNow ? 'DRAFT' : 'SCHEDULED',
        content,
        mediaUrl: body.mediaUrl,
        ctaType: body.ctaType,
        ctaUrl: body.ctaUrl,
        couponCode: body.couponCode,
        offerTerms: body.offerTerms,
        eventTitle: body.eventTitle,
        eventStart: body.eventStart ? new Date(body.eventStart) : null,
        eventEnd: body.eventEnd ? new Date(body.eventEnd) : null,
        scheduledAt,
      },
    });

    if (shouldPublishNow) {
      return this.publishPost(created.id);
    }
    return created;
  }

  async deletePost(userId: string, postId: string) {
    const post = await this.prisma.gbpPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    await this.prisma.gbpPost.delete({ where: { id: postId } });
    return { deleted: true };
  }

  private async publishPost(postId: string) {
    const post = await this.prisma.gbpPost.findUnique({
      where: { id: postId },
      include: { location: true },
    });
    if (!post) throw new NotFoundException('Post not found');

    try {
      const googlePostId = await this.gbpApi.publishPost(
        post.userId,
        post.location.googleLocationId,
        {
          type: post.type,
          content: post.content,
          mediaUrl: post.mediaUrl || undefined,
          ctaType: post.ctaType || undefined,
          ctaUrl: post.ctaUrl || undefined,
        },
      );
      return this.prisma.gbpPost.update({
        where: { id: postId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          googlePostId,
          failureReason: null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to publish GBP post ${postId}: ${err.message}`);
      return this.prisma.gbpPost.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          failureReason: err?.message || 'Unknown error',
        },
      });
    }
  }

  // ─── SCHEDULER ─────────────────────────────────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processScheduledPosts() {
    const now = new Date();
    const due = await this.prisma.gbpPost.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
      take: 25,
    });

    if (due.length === 0) return;
    this.logger.log(`Publishing ${due.length} scheduled GBP post(s)`);

    for (const post of due) {
      try {
        await this.publishPost(post.id);
      } catch (err: any) {
        this.logger.error(
          `Scheduled publish failed for ${post.id}: ${err.message}`,
        );
      }
    }
  }
}
