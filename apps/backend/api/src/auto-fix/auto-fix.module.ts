import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WordPressModule } from '../wordpress/wordpress.module';
import { GitHubModule } from '../github/github.module';
import { AutoFixService } from './auto-fix.service';
import { AutoFixController } from './auto-fix.controller';

@Module({
  imports: [PrismaModule, WordPressModule, forwardRef(() => GitHubModule)],
  controllers: [AutoFixController],
  providers: [AutoFixService],
  exports: [AutoFixService],
})
export class AutoFixModule {}
