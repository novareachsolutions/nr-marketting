import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { KeywordsService } from './keywords.service';
import { SaveKeywordDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class KeywordsController {
  constructor(private readonly keywordsService: KeywordsService) {}

  // ─── SEARCH KEYWORD ─────────────────────────────────────

  @Get('keywords/search')
  async search(
    @Query('q') q: string,
    @Query('country') country?: string,
  ): Promise<any> {
    const data = await this.keywordsService.searchKeyword(
      q,
      country || 'US',
    );
    return { success: true, data };
  }

  // ─── GET SUGGESTIONS ────────────────────────────────────

  @Get('keywords/suggestions')
  async suggestions(
    @Query('q') q: string,
    @Query('country') country?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('minVolume') minVolume?: string,
    @Query('maxVolume') maxVolume?: string,
    @Query('minKd') minKd?: string,
    @Query('maxKd') maxKd?: string,
    @Query('intent') intent?: string,
    @Query('questionsOnly') questionsOnly?: string,
    @Query('minWords') minWords?: string,
    @Query('maxWords') maxWords?: string,
    @Query('matchType') matchType?: string,
    @Query('includeWords') includeWords?: string,
    @Query('excludeWords') excludeWords?: string,
  ): Promise<any> {
    const filters: any = {};
    if (minVolume) filters.minVolume = parseInt(minVolume, 10);
    if (maxVolume) filters.maxVolume = parseInt(maxVolume, 10);
    if (minKd) filters.minKd = parseInt(minKd, 10);
    if (maxKd) filters.maxKd = parseInt(maxKd, 10);
    if (intent) filters.intent = intent;
    if (questionsOnly === 'true') filters.questionsOnly = true;
    if (minWords) filters.minWords = parseInt(minWords, 10);
    if (maxWords) filters.maxWords = parseInt(maxWords, 10);
    if (matchType) filters.matchType = matchType;
    if (includeWords) filters.includeWords = includeWords;
    if (excludeWords) filters.excludeWords = excludeWords;

    const data = await this.keywordsService.getSuggestions(
      q,
      country || 'US',
      limit,
      page,
      Object.keys(filters).length > 0 ? filters : undefined,
    );
    return { success: true, data };
  }

  // ─── KEYWORD GAP ANALYSIS ────────────────────────────────

  @Get('projects/:id/keyword-gap')
  @UseGuards(ProjectOwnerGuard)
  async keywordGap(
    @Param('id') projectId: string,
    @Query('competitors') competitors: string, // comma-separated domains
  ): Promise<any> {
    const domains = competitors ? competitors.split(',').map((d) => d.trim()).filter(Boolean) : [];
    const data = await this.keywordsService.getKeywordGap(projectId, domains);
    return { success: true, data };
  }

  // ─── EXPORT PROJECT KEYWORDS (CSV) ──────────────────────

  @Get('projects/:id/keywords/export')
  @UseGuards(ProjectOwnerGuard)
  async exportKeywords(@Param('id') projectId: string): Promise<any> {
    const data = await this.keywordsService.exportProjectKeywords(projectId);
    return { success: true, data };
  }

  // ─── LIST PROJECT KEYWORDS ──────────────────────────────

  @Get('projects/:id/keywords')
  @UseGuards(ProjectOwnerGuard)
  async listProjectKeywords(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('perPage', new DefaultValuePipe(50), ParseIntPipe) perPage?: number,
  ) {
    const data = await this.keywordsService.getProjectKeywords(
      id,
      page,
      perPage,
    );
    return { success: true, data };
  }

  // ─── SAVE KEYWORD TO PROJECT ────────────────────────────

  @Post('projects/:id/keywords')
  @UseGuards(ProjectOwnerGuard)
  async saveKeyword(
    @Param('id') id: string,
    @Body() dto: SaveKeywordDto,
  ) {
    const data = await this.keywordsService.saveKeyword(
      id,
      dto.keyword,
      dto.targetUrl,
      dto.notes,
    );
    return { success: true, data };
  }

  // ─── REMOVE KEYWORD FROM PROJECT ────────────────────────

  @Delete('projects/:id/keywords/:keywordId')
  @UseGuards(ProjectOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async removeKeyword(
    @Param('id') id: string,
    @Param('keywordId') keywordId: string,
  ) {
    const data = await this.keywordsService.removeKeyword(id, keywordId);
    return { success: true, data };
  }
}
