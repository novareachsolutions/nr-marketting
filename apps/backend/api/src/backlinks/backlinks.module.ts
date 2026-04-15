import { Module } from '@nestjs/common';
import { BacklinksController } from './backlinks.controller';
import { BacklinksService } from './backlinks.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BacklinksController],
  providers: [BacklinksService],
  exports: [BacklinksService],
})
export class BacklinksModule {}
