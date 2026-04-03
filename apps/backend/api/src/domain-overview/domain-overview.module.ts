import { Module } from '@nestjs/common';
import { DomainOverviewController } from './domain-overview.controller';
import { DomainOverviewService } from './domain-overview.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DomainOverviewController],
  providers: [DomainOverviewService],
  exports: [DomainOverviewService],
})
export class DomainOverviewModule {}
