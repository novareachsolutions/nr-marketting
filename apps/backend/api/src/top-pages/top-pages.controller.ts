import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { TopPagesService } from './top-pages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class TopPagesController {
  constructor(private readonly topPagesService: TopPagesService) {}

  @Get('top-pages')
  async getTopPages(
    @Query('domain') domain: string,
    @Query('country') country?: string,
    @Req() req?: any,
  ): Promise<any> {
    const data = await this.topPagesService.getTopPages(
      domain,
      country || 'US',
      req.user.id,
    );
    return { success: true, data };
  }
}
