import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { AutoFixService } from './auto-fix.service';

@Controller('projects/:id/fix-issue')
@UseGuards(JwtAuthGuard, ProjectOwnerGuard)
export class AutoFixController {
  constructor(private readonly autoFixService: AutoFixService) {}

  @Post(':issueId')
  async fixIssue(
    @Param('id') projectId: string,
    @Param('issueId') issueId: string,
  ): Promise<any> {
    const data = await this.autoFixService.fixIssue(projectId, issueId);
    return { success: true, data };
  }

  @Get(':issueId/preview')
  async previewFix(
    @Param('id') projectId: string,
    @Param('issueId') issueId: string,
  ): Promise<any> {
    const data = await this.autoFixService.previewFix(projectId, issueId);
    return { success: true, data };
  }
}
