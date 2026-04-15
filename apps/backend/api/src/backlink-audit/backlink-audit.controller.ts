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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { BacklinkAuditService } from './backlink-audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('backlink-audit')
@UseGuards(JwtAuthGuard)
export class BacklinkAuditController {
  constructor(private readonly service: BacklinkAuditService) {}

  // ─── Run new audit ─────────────────────────────────────
  @Post()
  async runAudit(
    @Req() req: any,
    @Body() body: { domain: string; country?: string },
  ) {
    const job = await this.service.runAudit(
      req.user.id,
      body.domain,
      body.country || 'US',
    );
    return { success: true, data: job };
  }

  // ─── List user's audits ────────────────────────────────
  @Get()
  async list(@Req() req: any, @Query('domain') domain?: string, @Query('country') country?: string) {
    if (domain) {
      const job = await this.service.getLatestByDomain(req.user.id, domain, country || 'US');
      return { success: true, data: job };
    }
    const audits = await this.service.listAudits(req.user.id);
    return { success: true, data: audits };
  }

  // ─── Get one audit with all links ──────────────────────
  @Get(':id')
  async getById(@Req() req: any, @Param('id') id: string) {
    const job = await this.service.getById(req.user.id, id);
    return { success: true, data: job };
  }

  // ─── Update a single link's status ─────────────────────
  @Patch(':id/links/:linkId')
  async updateLink(
    @Req() req: any,
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @Body() body: { status: 'pending' | 'keep' | 'flag' | 'disavow'; userNote?: string },
  ) {
    const link = await this.service.updateLinkStatus(
      req.user.id,
      id,
      linkId,
      body.status,
      body.userNote,
    );
    return { success: true, data: link };
  }

  // ─── Bulk update link statuses ─────────────────────────
  @Patch(':id/links')
  async bulkUpdate(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { linkIds: string[]; status: 'pending' | 'keep' | 'flag' | 'disavow' },
  ) {
    const result = await this.service.bulkUpdateStatus(
      req.user.id,
      id,
      body.linkIds,
      body.status,
    );
    return { success: true, data: result };
  }

  // ─── Delete audit ──────────────────────────────────────
  @Delete(':id')
  async deleteAudit(@Req() req: any, @Param('id') id: string) {
    const result = await this.service.deleteAudit(req.user.id, id);
    return { success: true, data: result };
  }

  // ─── Download disavow.txt ──────────────────────────────
  @Get(':id/disavow.txt')
  async downloadDisavow(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const text = await this.service.buildDisavowFile(req.user.id, id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="disavow-${id}.txt"`,
    );
    res.send(text);
  }
}
