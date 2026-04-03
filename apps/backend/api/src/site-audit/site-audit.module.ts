import { Module } from '@nestjs/common';
import { SiteAuditController, AuditAnalyticsController } from './site-audit.controller';
import { SiteAuditService } from './site-audit.service';
import { CrawlerService } from './crawler.service';
import { CrawlSchedulerService } from './crawl-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SiteAuditController, AuditAnalyticsController],
  providers: [SiteAuditService, CrawlerService, CrawlSchedulerService],
  exports: [SiteAuditService],
})
export class SiteAuditModule {}
