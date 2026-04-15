import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { BacklinksService } from './backlinks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class BacklinksController {
  constructor(private readonly backlinksService: BacklinksService) {}

  @Get('backlinks')
  async getBacklinks(
    @Query('domain') domain: string,
    @Query('country') country?: string,
    @Req() req?: any,
  ): Promise<any> {
    const data = await this.backlinksService.getBacklinks(
      domain,
      country || 'US',
      req.user.id,
    );
    return { success: true, data };
  }
}
