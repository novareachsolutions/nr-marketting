import { Module } from '@nestjs/common';
import { TopicResearchController } from './topic-research.controller';
import { TopicResearchService } from './topic-research.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TopicResearchController],
  providers: [TopicResearchService],
  exports: [TopicResearchService],
})
export class TopicResearchModule {}
