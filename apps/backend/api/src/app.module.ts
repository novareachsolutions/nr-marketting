import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { BillingModule } from './billing/billing.module';
import { GoogleOAuthModule } from './google-oauth/google-oauth.module';
import { KeywordsModule } from './keywords/keywords.module';
import { SiteAuditModule } from './site-audit/site-audit.module';
import { GitHubModule } from './github/github.module';
import { WordPressModule } from './wordpress/wordpress.module';
import { AutoFixModule } from './auto-fix/auto-fix.module';
import { PositionTrackingModule } from './position-tracking/position-tracking.module';
import { DomainOverviewModule } from './domain-overview/domain-overview.module';
import { OrganicRankingsModule } from './organic-rankings/organic-rankings.module';
import { TopPagesModule } from './top-pages/top-pages.module';
import { CompareDomainsModule } from './compare-domains/compare-domains.module';
import { KeywordGapModule } from './keyword-gap/keyword-gap.module';
import { BacklinkGapModule } from './backlink-gap/backlink-gap.module';
import { BacklinksModule } from './backlinks/backlinks.module';
import { BacklinkAuditModule } from './backlink-audit/backlink-audit.module';
import { AiSuggestionsModule } from './ai-suggestions/ai-suggestions.module';
import { ReportsModule } from './reports/reports.module';
import { TopicResearchModule } from './topic-research/topic-research.module';
import { WritingAssistantModule } from './writing-assistant/writing-assistant.module';
import { SeoContentTemplateModule } from './seo-content-template/seo-content-template.module';
import { GbpOptimizationModule } from './gbp-optimization/gbp-optimization.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    BillingModule,
    GoogleOAuthModule,
    KeywordsModule,
    SiteAuditModule,
    GitHubModule,
    WordPressModule,
    AutoFixModule,
    PositionTrackingModule,
    DomainOverviewModule,
    OrganicRankingsModule,
    TopPagesModule,
    CompareDomainsModule,
    KeywordGapModule,
    BacklinkGapModule,
    BacklinksModule,
    BacklinkAuditModule,
    AiSuggestionsModule,
    ReportsModule,
    TopicResearchModule,
    WritingAssistantModule,
    SeoContentTemplateModule,
    GbpOptimizationModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
