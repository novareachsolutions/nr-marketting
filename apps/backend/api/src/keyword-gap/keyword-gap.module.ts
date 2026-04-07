import { Module } from '@nestjs/common';
import { KeywordGapController } from './keyword-gap.controller';
import { KeywordGapService } from './keyword-gap.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [KeywordGapController],
  providers: [KeywordGapService],
  exports: [KeywordGapService],
})
export class KeywordGapModule {}
