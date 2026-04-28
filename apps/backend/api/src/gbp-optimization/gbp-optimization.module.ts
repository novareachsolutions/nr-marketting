import { Module } from '@nestjs/common';
import { GbpOptimizationController } from './gbp-optimization.controller';
import { GbpOptimizationService } from './gbp-optimization.service';
import { GbpApiService } from './gbp-api.service';
import { GbpInsightsService } from './gbp-insights.service';
import { GbpReviewsService } from './gbp-reviews.service';
import { GbpPostsService } from './gbp-posts.service';
import { GbpAiService } from './gbp-ai.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleOAuthModule } from '../google-oauth/google-oauth.module';

@Module({
  imports: [PrismaModule, GoogleOAuthModule],
  controllers: [GbpOptimizationController],
  providers: [
    GbpOptimizationService,
    GbpApiService,
    GbpInsightsService,
    GbpReviewsService,
    GbpPostsService,
    GbpAiService,
  ],
  exports: [GbpOptimizationService],
})
export class GbpOptimizationModule {}
