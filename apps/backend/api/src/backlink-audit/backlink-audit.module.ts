import { Module } from '@nestjs/common';
import { BacklinkAuditController } from './backlink-audit.controller';
import { BacklinkAuditService } from './backlink-audit.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BacklinkAuditController],
  providers: [BacklinkAuditService],
  exports: [BacklinkAuditService],
})
export class BacklinkAuditModule {}
