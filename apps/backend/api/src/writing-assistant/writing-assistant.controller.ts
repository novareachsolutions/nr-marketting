import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { WritingAssistantService } from './writing-assistant.service';
import { WritingAssistantAiService } from './writing-assistant-ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class WritingAssistantController {
  constructor(
    private readonly writingService: WritingAssistantService,
    private readonly aiService: WritingAssistantAiService,
  ) {}

  // ─── DOCUMENT CRUD ─────────────────────────────────────

  @Post('writing/documents')
  async createDocument(@Req() req: any, @Body() body: any) {
    const doc = await this.writingService.createDocument(req.user.id, body);
    return { success: true, data: doc };
  }

  @Get('writing/documents')
  async listDocuments(
    @Req() req: any,
    @Query('projectId') projectId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    const data = await this.writingService.listDocuments(
      req.user.id,
      projectId,
      page,
      limit,
    );
    return { success: true, data };
  }

  @Get('writing/documents/:id')
  async getDocument(@Req() req: any, @Param('id') id: string) {
    const doc = await this.writingService.getDocument(req.user.id, id);
    return { success: true, data: doc };
  }

  @Patch('writing/documents/:id')
  async updateDocument(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const doc = await this.writingService.updateDocument(
      req.user.id,
      id,
      body,
    );
    return { success: true, data: doc };
  }

  @Delete('writing/documents/:id')
  async deleteDocument(@Req() req: any, @Param('id') id: string) {
    const result = await this.writingService.deleteDocument(req.user.id, id);
    return { success: true, data: result };
  }

  // ─── AI ENDPOINTS ──────────────────────────────────────

  @Post('writing/rephrase')
  async rephrase(@Body() body: { text: string; mode: string; context?: string }) {
    const result = await this.aiService.rephrase(
      body.text,
      body.mode as any,
      body.context,
    );
    return { success: true, data: result };
  }

  @Post('writing/compose')
  async compose(
    @Body()
    body: {
      topic: string;
      keywords?: string[];
      tone?: string;
      contentType?: string;
      length?: string;
    },
  ) {
    const result = await this.aiService.compose(
      body.topic,
      body.keywords,
      body.tone,
      body.contentType,
      body.length,
    );
    return { success: true, data: result };
  }

  @Post('writing/ask-ai')
  async askAi(
    @Body()
    body: { question: string; topic?: string; currentContent?: string },
  ) {
    const result = await this.aiService.askAi(
      body.question,
      body.topic,
      body.currentContent,
    );
    return { success: true, data: result };
  }

  @Post('writing/check-originality')
  async checkOriginality(@Body() body: { text: string }) {
    const result = await this.aiService.checkOriginality(body.text);
    return { success: true, data: result };
  }

  @Post('writing/check-tone')
  async checkTone(@Body() body: { text: string; targetTone: string }) {
    const result = await this.aiService.checkTone(body.text, body.targetTone);
    return { success: true, data: result };
  }

  // ─── SEO ANALYSIS ──────────────────────────────────────

  @Post('writing/seo-analysis')
  async seoAnalysis(@Body() body: { keywords: string[]; country?: string }) {
    const result = await this.writingService.getSeoKeywordData(
      body.keywords,
      body.country,
    );
    return { success: true, data: result };
  }
}
