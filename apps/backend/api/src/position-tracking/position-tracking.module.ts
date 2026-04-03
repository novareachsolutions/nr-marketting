import { Module } from '@nestjs/common';
import { PositionTrackingController } from './position-tracking.controller';
import { PositionTrackingService } from './position-tracking.service';
import { RankCheckerService } from './rank-checker.service';
import { RankCheckSchedulerService } from './rank-check-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PositionTrackingController],
  providers: [
    PositionTrackingService,
    RankCheckerService,
    RankCheckSchedulerService,
  ],
  exports: [PositionTrackingService, RankCheckerService],
})
export class PositionTrackingModule {}
