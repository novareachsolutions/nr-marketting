import { Module } from '@nestjs/common';
import { WritingAssistantController } from './writing-assistant.controller';
import { WritingAssistantService } from './writing-assistant.service';
import { WritingAssistantAiService } from './writing-assistant-ai.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WritingAssistantController],
  providers: [WritingAssistantService, WritingAssistantAiService],
  exports: [WritingAssistantService],
})
export class WritingAssistantModule {}
