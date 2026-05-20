import { Module } from '@nestjs/common';
import { TopPagesController } from './top-pages.controller';
import { TopPagesService } from './top-pages.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleOAuthModule } from '../google-oauth/google-oauth.module';

@Module({
  imports: [PrismaModule, GoogleOAuthModule],
  controllers: [TopPagesController],
  providers: [TopPagesService],
  exports: [TopPagesService],
})
export class TopPagesModule {}
