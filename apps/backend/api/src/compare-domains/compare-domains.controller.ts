import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { CompareDomainsService } from './compare-domains.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class CompareDomainsController {
  constructor(private readonly compareDomainsService: CompareDomainsService) {}

  @Get('compare-domains')
  async compareDomains(
    @Query('domains') domains: string,
    @Query('country') country?: string,
    @Req() req?: any,
  ): Promise<any> {
    const data = await this.compareDomainsService.compareDomains(
      domains,
      country || 'US',
      req.user.id,
    );
    return { success: true, data };
  }
}
