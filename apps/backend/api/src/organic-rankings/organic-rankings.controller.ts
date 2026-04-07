import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrganicRankingsService } from './organic-rankings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class OrganicRankingsController {
  constructor(private readonly organicRankingsService: OrganicRankingsService) {}

  @Get('organic-rankings')
  async getOrganicRankings(
    @Query('domain') domain: string,
    @Query('country') country?: string,
    @Req() req?: any,
  ): Promise<any> {
    const data = await this.organicRankingsService.getOrganicRankings(
      domain,
      country || 'US',
      req.user.id,
    );
    return { success: true, data };
  }
}
