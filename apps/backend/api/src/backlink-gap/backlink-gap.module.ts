import { Module } from '@nestjs/common';
import { BacklinkGapController } from './backlink-gap.controller';
import { BacklinkGapService } from './backlink-gap.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BacklinkGapController],
  providers: [BacklinkGapService],
  exports: [BacklinkGapService],
})
export class BacklinkGapModule {}
