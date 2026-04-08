import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlerService } from './crawler.service';

@Injectable()
export class CrawlSchedulerService {
  private readonly logger = new Logger(CrawlSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawlerService: CrawlerService,
  ) {}

  // Run every hour to check for projects due for scheduled crawls
  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledCrawls() {
    this.logger.log('Checking for scheduled crawls...');

    const now = new Date();

    // Find projects with active crawl schedules
    const projects = await this.prisma.project.findMany({
      where: {
        isActive: true,
        crawlSchedule: { not: 'NONE' },
      },
      include: {
        user: {
          include: { subscription: true },
        },
      },
    });

    for (const project of projects) {
      try {
        const isDue = this.isCrawlDue(project.crawlSchedule, project.lastScheduledCrawlAt, now);
        if (!isDue) continue;

        // Check if there's already a running crawl
        const runningCrawl = await this.prisma.crawlJob.findFirst({
          where: {
            projectId: project.id,
            status: { in: ['QUEUED', 'RUNNING'] },
          },
        });

        if (runningCrawl) {
          this.logger.log(`Skipping scheduled crawl for project ${project.id} — crawl already in progress`);
          continue;
        }

        // Create and execute crawl
        const crawlJob = await this.prisma.crawlJob.create({
          data: {
            projectId: project.id,
            status: 'QUEUED',
            pagesLimit: 100_000,
          },
        });

        // Update last scheduled crawl timestamp
        await this.prisma.project.update({
          where: { id: project.id },
          data: { lastScheduledCrawlAt: now },
        });

        // Execute crawl in background
        setTimeout(() => {
          this.crawlerService.executeCrawl(crawlJob.id).catch((err) => {
            this.logger.error(`Scheduled crawl failed for project ${project.id}: ${err}`);
          });
        }, 0);

        this.logger.log(`Started scheduled crawl ${crawlJob.id} for project ${project.id}`);
      } catch (err) {
        this.logger.error(`Error processing scheduled crawl for project ${project.id}: ${err}`);
      }
    }
  }

  private isCrawlDue(schedule: string, lastCrawl: Date | null, now: Date): boolean {
    if (!lastCrawl) return true; // Never crawled before

    const hoursSinceLastCrawl = (now.getTime() - lastCrawl.getTime()) / (1000 * 60 * 60);

    switch (schedule) {
      case 'DAILY':
        return hoursSinceLastCrawl >= 24;
      case 'WEEKLY':
        return hoursSinceLastCrawl >= 168; // 7 * 24
      case 'MONTHLY':
        return hoursSinceLastCrawl >= 720; // 30 * 24
      default:
        return false;
    }
  }
}
