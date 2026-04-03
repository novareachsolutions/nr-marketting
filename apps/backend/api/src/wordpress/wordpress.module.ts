import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WordPressService } from './wordpress.service';
import { WordPressController } from './wordpress.controller';

@Module({
  imports: [PrismaModule],
  controllers: [WordPressController],
  providers: [WordPressService],
  exports: [WordPressService],
})
export class WordPressModule {}
