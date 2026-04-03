import {
  Controller,
  Get,
  Post,
  Patch,
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
import { PositionTrackingService } from './position-tracking.service';
import { RankCheckerService } from './rank-checker.service';
import {
  AddKeywordsDto,
  UpdateKeywordDto,
  BulkTagDto,
  CreateTagDto,
  BulkDeleteDto,
  ImportFromProjectDto,
  UpdateScheduleDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class PositionTrackingController {
  constructor(
    private readonly positionTrackingService: PositionTrackingService,
    private readonly rankCheckerService: RankCheckerService,
  ) {}

  // ─── KEYWORD MANAGEMENT ─────────────────────────────────

  @Get('projects/:id/position-tracking/keywords')
  @UseGuards(ProjectOwnerGuard)
  async getTrackedKeywords(
    @Param('id') projectId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(50), ParseIntPipe) perPage: number,
    @Query('tagId') tagId?: string,
    @Query('positionMin') positionMin?: string,
    @Query('positionMax') positionMax?: string,
    @Query('changeType') changeType?: string,
    @Query('device') device?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    const filters: any = {};
    if (tagId) filters.tagId = tagId;
    if (positionMin) filters.positionMin = parseFloat(positionMin);
    if (positionMax) filters.positionMax = parseFloat(positionMax);
    if (changeType) filters.changeType = changeType;
    if (device) filters.device = device;
    if (search) filters.search = search;
    if (sort) filters.sort = sort;
    if (order) filters.order = order;

    const data = await this.positionTrackingService.getTrackedKeywords(
      projectId,
      page,
      perPage,
      Object.keys(filters).length > 0 ? filters : undefined,
    );
    return { success: true, data };
  }

  @Post('projects/:id/position-tracking/keywords')
  @UseGuards(ProjectOwnerGuard)
  async addKeywords(
    @Param('id') projectId: string,
    @Body() dto: AddKeywordsDto,
    @CurrentUser('plan') plan: string,
  ) {
    const data = await this.positionTrackingService.addKeywords(
      projectId,
      dto.keywords,
      plan,
      dto.device,
      dto.country,
      dto.targetUrl,
    );
    return { success: true, data };
  }

  @Post('projects/:id/position-tracking/keywords/import-from-project')
  @UseGuards(ProjectOwnerGuard)
  async importFromProject(
    @Param('id') projectId: string,
    @Body() dto: ImportFromProjectDto,
    @CurrentUser('plan') plan: string,
  ) {
    const data = await this.positionTrackingService.importFromProject(
      projectId,
      plan,
      dto.keywordIds,
      dto.all,
      dto.device as any,
      dto.country,
    );
    return { success: true, data };
  }

  @Patch('projects/:id/position-tracking/keywords/:keywordId')
  @UseGuards(ProjectOwnerGuard)
  async updateKeyword(
    @Param('id') projectId: string,
    @Param('keywordId') keywordId: string,
    @Body() dto: UpdateKeywordDto,
  ) {
    const data = await this.positionTrackingService.updateKeyword(
      projectId,
      keywordId,
      dto.targetUrl,
    );
    return { success: true, data };
  }

  @Delete('projects/:id/position-tracking/keywords/:keywordId')
  @UseGuards(ProjectOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async deleteKeyword(
    @Param('id') projectId: string,
    @Param('keywordId') keywordId: string,
  ) {
    const data = await this.positionTrackingService.deleteKeyword(projectId, keywordId);
    return { success: true, data };
  }

  @Post('projects/:id/position-tracking/keywords/bulk-delete')
  @UseGuards(ProjectOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async bulkDelete(
    @Param('id') projectId: string,
    @Body() dto: BulkDeleteDto,
  ) {
    const data = await this.positionTrackingService.bulkDelete(projectId, dto.keywordIds);
    return { success: true, data };
  }

  // ─── TAGS ───────────────────────────────────────────────

  @Get('projects/:id/position-tracking/tags')
  @UseGuards(ProjectOwnerGuard)
  async getTags(@Param('id') projectId: string) {
    const data = await this.positionTrackingService.getTags(projectId);
    return { success: true, data };
  }

  @Post('projects/:id/position-tracking/tags')
  @UseGuards(ProjectOwnerGuard)
  async createTag(
    @Param('id') projectId: string,
    @Body() dto: CreateTagDto,
  ) {
    const data = await this.positionTrackingService.createTag(
      projectId,
      dto.name,
      dto.color,
    );
    return { success: true, data };
  }

  @Delete('projects/:id/position-tracking/tags/:tagId')
  @UseGuards(ProjectOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async deleteTag(
    @Param('id') projectId: string,
    @Param('tagId') tagId: string,
  ) {
    const data = await this.positionTrackingService.deleteTag(projectId, tagId);
    return { success: true, data };
  }

  @Post('projects/:id/position-tracking/keywords/bulk-tag')
  @UseGuards(ProjectOwnerGuard)
  async bulkTag(
    @Param('id') projectId: string,
    @Body() dto: BulkTagDto,
  ) {
    const data = await this.positionTrackingService.bulkTag(
      projectId,
      dto.keywordIds,
      dto.tagId,
    );
    return { success: true, data };
  }

  @Post('projects/:id/position-tracking/keywords/bulk-untag')
  @UseGuards(ProjectOwnerGuard)
  async bulkUntag(
    @Param('id') projectId: string,
    @Body() dto: BulkTagDto,
  ) {
    const data = await this.positionTrackingService.bulkUntag(
      projectId,
      dto.keywordIds,
      dto.tagId,
    );
    return { success: true, data };
  }

  // ─── OVERVIEW & ANALYTICS ──────────────────────────────

  @Get('projects/:id/position-tracking/overview')
  @UseGuards(ProjectOwnerGuard)
  async getOverview(
    @Param('id') projectId: string,
    @Query('device') device?: string,
  ) {
    const data = await this.positionTrackingService.getOverview(projectId, device);
    return { success: true, data };
  }

  @Get('projects/:id/position-tracking/overview/trend')
  @UseGuards(ProjectOwnerGuard)
  async getOverviewTrend(
    @Param('id') projectId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('device') device?: string,
  ) {
    const data = await this.positionTrackingService.getOverviewTrend(
      projectId,
      days,
      device,
    );
    return { success: true, data };
  }

  @Get('projects/:id/position-tracking/keywords/:keywordId/history')
  @UseGuards(ProjectOwnerGuard)
  async getKeywordHistory(
    @Param('id') projectId: string,
    @Param('keywordId') keywordId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    const data = await this.positionTrackingService.getKeywordHistory(
      projectId,
      keywordId,
      days,
    );
    return { success: true, data };
  }

  // ─── ACTIONS ────────────────────────────────────────────

  @Post('projects/:id/position-tracking/check-now')
  @UseGuards(ProjectOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async checkNow(@Param('id') projectId: string) {
    const data = await this.rankCheckerService.checkPositions(projectId);
    return { success: true, data };
  }

  @Patch('projects/:id/position-tracking/schedule')
  @UseGuards(ProjectOwnerGuard)
  async updateSchedule(
    @Param('id') projectId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    const data = await this.positionTrackingService.updateSchedule(
      projectId,
      dto.schedule,
    );
    return { success: true, data };
  }
}
