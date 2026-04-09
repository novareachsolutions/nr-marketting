import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SiteAuditService } from './site-audit.service';

// Phase C: Project-level audit analytics (score history, issue trends)
@Controller('projects/:id/audit-analytics')
@UseGuards(JwtAuthGuard, ProjectOwnerGuard)
export class AuditAnalyticsController {
  constructor(private readonly siteAuditService: SiteAuditService) {}

  @Get('score-history')
  async getScoreHistory(
    @Param('id') projectId: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.siteAuditService.getScoreHistory(
      projectId,
      limit ? parseInt(limit, 10) : 10,
    );
    return { success: true, data: result };
  }

  @Get('issue-trends')
  async getIssueTrends(
    @Param('id') projectId: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.siteAuditService.getIssueTrends(
      projectId,
      limit ? parseInt(limit, 10) : 10,
    );
    return { success: true, data: result };
  }
}

@Controller('projects/:id/crawls')
@UseGuards(JwtAuthGuard, ProjectOwnerGuard)
export class SiteAuditController {
  constructor(private readonly siteAuditService: SiteAuditService) {}

  @Post()
  async startCrawl(
    @Param('id') projectId: string,
    @CurrentUser() user: any,
  ) {
    const result = await this.siteAuditService.startCrawl(
      projectId,
      user.id,
      user.plan || 'FREE',
    );
    return { success: true, data: result };
  }

  @Get()
  async getCrawlJobs(
    @Param('id') projectId: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    const result = await this.siteAuditService.getCrawlJobs(
      projectId,
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 10,
    );
    return { success: true, ...result };
  }

  @Get(':crawlId')
  async getCrawlJob(
    @Param('crawlId') crawlId: string,
  ) {
    const result = await this.siteAuditService.getCrawlJob(crawlId);
    return { success: true, data: result };
  }

  @Get(':crawlId/issues')
  async getCrawlIssues(
    @Param('crawlId') crawlId: string,
    @Query('severity') severity?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    const result = await this.siteAuditService.getCrawlIssues(
      crawlId,
      severity || undefined,
      type || undefined,
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 20,
    );
    return { success: true, ...result };
  }

  @Get(':crawlId/pages')
  async getCrawlPages(
    @Param('crawlId') crawlId: string,
    @Query('statusCode') statusCode?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    const result = await this.siteAuditService.getCrawlPages(
      crawlId,
      statusCode ? parseInt(statusCode, 10) : undefined,
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 20,
    );
    return { success: true, ...result };
  }

  // Export all issues (no pagination, for PDF download)
  @Get(':crawlId/export')
  async exportCrawlData(@Param('crawlId') crawlId: string) {
    const result = await this.siteAuditService.getExportData(crawlId);
    return { success: true, data: result };
  }

  // Phase A: Crawl Comparison
  @Get(':crawlId/compare')
  async compareCrawls(
    @Param('crawlId') crawlId: string,
    @Query('previousCrawlId') previousCrawlId?: string,
  ) {
    const result = await this.siteAuditService.compareCrawls(
      crawlId,
      previousCrawlId || undefined,
    );
    return { success: true, data: result };
  }

  // Phase B: Thematic Reports
  @Get(':crawlId/themes')
  async getThematicReports(@Param('crawlId') crawlId: string) {
    const result = await this.siteAuditService.getThematicReports(crawlId);
    return { success: true, data: result };
  }

  @Patch(':crawlId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelCrawl(@Param('crawlId') crawlId: string) {
    const result = await this.siteAuditService.cancelCrawl(crawlId);
    return { success: true, data: result };
  }

  @Delete(':crawlId')
  @HttpCode(HttpStatus.OK)
  async deleteCrawl(@Param('crawlId') crawlId: string) {
    const result = await this.siteAuditService.deleteCrawl(crawlId);
    return { success: true, data: result };
  }
}
