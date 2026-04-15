import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { SeoContentTemplateService } from './seo-content-template.service';
import { SeoContentTemplateExportService } from './seo-content-template-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class SeoContentTemplateController {
  constructor(
    private readonly templateService: SeoContentTemplateService,
    private readonly exportService: SeoContentTemplateExportService,
  ) {}

  // ─── GENERATE ──────────────────────────────────────────

  @Post('seo-content-template/generate')
  async generate(
    @Req() req: any,
    @Body()
    body: {
      targetKeywords: string[];
      country?: string;
      projectId?: string;
    },
  ) {
    const brief = await this.templateService.generateBrief(req.user.id, body);
    return { success: true, data: brief };
  }

  // ─── LIST ──────────────────────────────────────────────

  @Get('seo-content-template')
  async list(
    @Req() req: any,
    @Query('projectId') projectId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    const data = await this.templateService.listBriefs(
      req.user.id,
      projectId,
      page,
      limit,
    );
    return { success: true, data };
  }

  // ─── GET ONE ───────────────────────────────────────────

  @Get('seo-content-template/:id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    const brief = await this.templateService.getBrief(req.user.id, id);
    return { success: true, data: brief };
  }

  // ─── DELETE ────────────────────────────────────────────

  @Delete('seo-content-template/:id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const result = await this.templateService.deleteBrief(req.user.id, id);
    return { success: true, data: result };
  }

  // ─── EXPORT .DOC ───────────────────────────────────────

  @Get('seo-content-template/:id/export')
  async exportDoc(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const brief = await this.templateService.getBrief(req.user.id, id);
    const html = this.exportService.buildDocHtml(brief);
    const filename = this.exportService.buildFileName(brief);

    res.setHeader('Content-Type', 'application/msword');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(html);
  }

  // ─── SEND TO WRITING ASSISTANT ─────────────────────────

  @Post('seo-content-template/:id/send-to-writer')
  async sendToWriter(@Req() req: any, @Param('id') id: string) {
    const result = await this.templateService.sendToWritingAssistant(
      req.user.id,
      id,
    );
    return { success: true, data: result };
  }
}
