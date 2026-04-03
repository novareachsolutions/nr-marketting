import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DomainOverviewService } from './domain-overview.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class DomainOverviewController {
  constructor(private readonly domainOverviewService: DomainOverviewService) {}

  @Get('domain-overview')
  async getDomainOverview(
    @Query('domain') domain: string,
    @Query('country') country?: string,
    @Req() req?: any,
  ): Promise<any> {
    const data = await this.domainOverviewService.getDomainOverview(
      domain,
      country || 'US',
      req.user.id,
    );
    return { success: true, data };
  }
}
