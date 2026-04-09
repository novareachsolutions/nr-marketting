import { Module } from '@nestjs/common';
import { GitHubController } from './github.controller';
import { GitHubService } from './github.service';
import { AuthModule } from '../auth/auth.module';
import { SiteAuditModule } from '../site-audit/site-audit.module';

@Module({
  imports: [AuthModule, SiteAuditModule],
  controllers: [GitHubController],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}
