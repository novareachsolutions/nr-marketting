import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RankCheckerService } from './rank-checker.service';

@Injectable()
export class RankCheckSchedulerService {
  private readonly logger = new Logger(RankCheckSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rankCheckerService: RankCheckerService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledRankChecks() {
    const now = new Date();

    const projects = await this.prisma.project.findMany({
      where: {
        isActive: true,
        rankCheckSchedule: { not: 'NONE' },
      },
      select: {
        id: true,
        domain: true,
        rankCheckSchedule: true,
        lastRankCheckAt: true,
      },
    });

    for (const project of projects) {
      if (!this.isCrawlDue(project.rankCheckSchedule, project.lastRankCheckAt, now)) {
        continue;
      }

      // Check if there are tracked keywords
      const keywordCount = await this.prisma.trackedKeyword.count({
        where: { projectId: project.id, isActive: true },
      });

      if (keywordCount === 0) continue;

      this.logger.log(
        `Scheduled rank check for ${project.domain} (${keywordCount} keywords)`,
      );

      // Update timestamp first to prevent double-runs
      await this.prisma.project.update({
        where: { id: project.id },
        data: { lastRankCheckAt: now },
      });

      // Execute in background (bypass rate limit for scheduled checks)
      const trackedKeywords = await this.prisma.trackedKeyword.findMany({
        where: { projectId: project.id, isActive: true },
      });

      setTimeout(() => {
        (this.rankCheckerService as any)
          .executeCheck(project.id, project.domain, trackedKeywords)
          .catch((err: any) => {
            this.logger.error(
              `Scheduled rank check failed for ${project.domain}: ${err}`,
            );
          });
      }, 0);
    }
  }

  private isCrawlDue(
    schedule: string,
    lastCheck: Date | null,
    now: Date,
  ): boolean {
    if (!lastCheck) return true; // Never checked, do it now

    const hoursSince =
      (now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60);

    switch (schedule) {
      case 'DAILY':
        return hoursSince >= 24;
      case 'WEEKLY':
        return hoursSince >= 168; // 7 * 24
      case 'MONTHLY':
        return hoursSince >= 720; // 30 * 24
      default:
        return false;
    }
  }
}
