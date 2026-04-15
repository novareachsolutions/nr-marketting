import { Module } from '@nestjs/common';
import { SeoContentTemplateController } from './seo-content-template.controller';
import { SeoContentTemplateService } from './seo-content-template.service';
import { SeoContentTemplateAiService } from './seo-content-template-ai.service';
import { SeoContentTemplateExportService } from './seo-content-template-export.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SeoContentTemplateController],
  providers: [
    SeoContentTemplateService,
    SeoContentTemplateAiService,
    SeoContentTemplateExportService,
  ],
  exports: [SeoContentTemplateService],
})
export class SeoContentTemplateModule {}
