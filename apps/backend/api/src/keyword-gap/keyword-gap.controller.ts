import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { KeywordGapService } from './keyword-gap.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class KeywordGapController {
  constructor(private readonly keywordGapService: KeywordGapService) {}

  @Get('keyword-gap')
  async getKeywordGap(
    @Query('domains') domains: string,
    @Query('country') country?: string,
    @Req() req?: any,
  ): Promise<any> {
    const data = await this.keywordGapService.getKeywordGap(
      domains,
      country || 'US',
      req.user.id,
    );
    return { success: true, data };
  }
}
