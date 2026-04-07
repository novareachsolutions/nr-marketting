import { Module } from '@nestjs/common';
import { CompareDomainsController } from './compare-domains.controller';
import { CompareDomainsService } from './compare-domains.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CompareDomainsController],
  providers: [CompareDomainsService],
  exports: [CompareDomainsService],
})
export class CompareDomainsModule {}
