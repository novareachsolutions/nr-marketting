import { Module } from '@nestjs/common';
import { OrganicRankingsController } from './organic-rankings.controller';
import { OrganicRankingsService } from './organic-rankings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleOAuthModule } from '../google-oauth/google-oauth.module';

@Module({
  imports: [PrismaModule, GoogleOAuthModule],
  controllers: [OrganicRankingsController],
  providers: [OrganicRankingsService],
  exports: [OrganicRankingsService],
})
export class OrganicRankingsModule {}
