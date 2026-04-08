import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DomainOverviewModule } from '../domain-overview/domain-overview.module';
import { OrganicRankingsModule } from '../organic-rankings/organic-rankings.module';
import { TopPagesModule } from '../top-pages/top-pages.module';
import { SiteAuditModule } from '../site-audit/site-audit.module';
import { PositionTrackingModule } from '../position-tracking/position-tracking.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportSchedulerService } from './report-scheduler.service';

@Module({
  imports: [
    PrismaModule,
    DomainOverviewModule,
    OrganicRankingsModule,
    TopPagesModule,
    SiteAuditModule,
    PositionTrackingModule,
    KeywordsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportSchedulerService],
  exports: [ReportsService],
})
export class ReportsModule {}
