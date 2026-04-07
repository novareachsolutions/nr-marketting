import { Module } from '@nestjs/common';
import { TopPagesController } from './top-pages.controller';
import { TopPagesService } from './top-pages.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TopPagesController],
  providers: [TopPagesService],
  exports: [TopPagesService],
})
export class TopPagesModule {}
