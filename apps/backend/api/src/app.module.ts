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
