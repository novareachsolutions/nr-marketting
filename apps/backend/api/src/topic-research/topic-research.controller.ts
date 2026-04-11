import {
  Controller,
  Get,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { TopicResearchService } from './topic-research.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class TopicResearchController {
  constructor(private readonly topicResearchService: TopicResearchService) {}

  // ─── TOPIC RESEARCH ─────────────────────────────────────

  @Get('topics/research')
  async research(
    @Query('topic') topic: string,
    @Query('country') country?: string,
    @Query('domain') domain?: string,
    @Query('minVolume') minVolume?: string,
    @Query('maxVolume') maxVolume?: string,
    @Query('maxKd') maxKd?: string,
    @Query('minEfficiency') minEfficiency?: string,
    @Query('intent') intent?: string,
    @Query('questionsOnly') questionsOnly?: string,
  ): Promise<any> {
    const filters: any = {};
    if (minVolume) filters.minVolume = parseInt(minVolume, 10);
    if (maxVolume) filters.maxVolume = parseInt(maxVolume, 10);
    if (maxKd) filters.maxKd = parseInt(maxKd, 10);
    if (minEfficiency) filters.minEfficiency = parseInt(minEfficiency, 10);
    if (intent) filters.intent = intent;
    if (questionsOnly === 'true') filters.questionsOnly = true;

    const data = await this.topicResearchService.researchTopic(
      topic,
      country || 'AU',
      domain,
      Object.keys(filters).length > 0 ? filters : undefined,
    );
    return { success: true, data };
  }

  // ─── SUBTOPICS ──────────────────────────────────────────

  @Get('topics/subtopics')
  async subtopics(
    @Query('topic') topic: string,
    @Query('parentTopic') parentTopic: string,
    @Query('country') country?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
  ): Promise<any> {
    const data = await this.topicResearchService.getSubtopics(
      topic,
      parentTopic,
      country || 'AU',
      page,
    );
    return { success: true, data };
  }
}
