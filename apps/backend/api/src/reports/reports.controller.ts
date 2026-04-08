import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { ReportsService } from './reports.service';

@Controller('projects/:id/reports')
@UseGuards(JwtAuthGuard, ProjectOwnerGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ─── REPORT SCHEDULE SETTINGS ─────────────────────────

  @Get('settings')
  async getReportSettings(@Param('id') projectId: string) {
    const data = await this.reportsService.getReportSettings(projectId);
    return { success: true, data };
  }

  @Put('settings')
  async updateReportSettings(
    @Param('id') projectId: string,
    @Body()
    body: {
      reportSchedule: string;
      reportDay?: number | null;
      reportHour?: number;
      reportModules?: string[];
    },
  ) {
    const data = await this.reportsService.updateReportSettings(
      projectId,
      body,
    );
    return { success: true, data };
  }

  // ─── REPORTS CRUD ─────────────────────────────────────

  @Get()
  async listReports(@Param('id') projectId: string) {
    const data = await this.reportsService.listReports(projectId);
    return { success: true, data };
  }

  @Get(':reportId')
  async getReport(
    @Param('id') projectId: string,
    @Param('reportId') reportId: string,
  ) {
    const data = await this.reportsService.getReport(projectId, reportId);
    return { success: true, data };
  }

  @Post('generate')
  @HttpCode(202)
  async generateReport(
    @Param('id') projectId: string,
    @Body() body?: { modules?: string[] },
  ) {
    const data = await this.reportsService.generateReport(
      projectId,
      body?.modules,
    );
    return { success: true, data };
  }

  @Delete(':reportId')
  async deleteReport(
    @Param('id') projectId: string,
    @Param('reportId') reportId: string,
  ) {
    const data = await this.reportsService.deleteReport(projectId, reportId);
    return { success: true, ...data };
  }
}
