import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { BacklinkGapService } from './backlink-gap.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class BacklinkGapController {
  constructor(private readonly backlinkGapService: BacklinkGapService) {}

  @Get('backlink-gap')
  async getBacklinkGap(
    @Query('domains') domains: string,
    @Query('country') country?: string,
    @Req() req?: any,
  ): Promise<any> {
    const data = await this.backlinkGapService.getBacklinkGap(
      domains,
      country || 'US',
      req.user.id,
    );
    return { success: true, data };
  }
}
