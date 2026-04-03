import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectOwnerGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
