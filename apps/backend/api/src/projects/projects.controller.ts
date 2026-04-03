import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, AddCompetitorDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ─── LIST USER PROJECTS ────────────────────────────────

  @Get()
  async list(@CurrentUser() user: any) {
    const data = await this.projectsService.findAllByUser(user.id);
    return { success: true, data };
  }

  // ─── CREATE PROJECT ────────────────────────────────────

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateProjectDto,
  ) {
    const data = await this.projectsService.create(user.id, user.plan, dto);
    return { success: true, data };
  }

  // ─── GET PROJECT ───────────────────────────────────────

  @Get(':id')
  @UseGuards(ProjectOwnerGuard)
  async findOne(@Param('id') id: string) {
    const data = await this.projectsService.findById(id);
    return { success: true, data };
  }

  // ─── UPDATE PROJECT ────────────────────────────────────

  @Put(':id')
  @UseGuards(ProjectOwnerGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const data = await this.projectsService.update(id, dto);
    return { success: true, data };
  }

  // ─── DELETE PROJECT ────────────────────────────────────

  @Delete(':id')
  @UseGuards(ProjectOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    const data = await this.projectsService.delete(id);
    return { success: true, data };
  }

  // ─── LIST COMPETITORS ──────────────────────────────────

  @Get(':id/competitors')
  @UseGuards(ProjectOwnerGuard)
  async getCompetitors(@Param('id') id: string) {
    const data = await this.projectsService.getCompetitors(id);
    return { success: true, data };
  }

  // ─── ADD COMPETITOR ────────────────────────────────────

  @Post(':id/competitors')
  @UseGuards(ProjectOwnerGuard)
  async addCompetitor(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: AddCompetitorDto,
  ) {
    const data = await this.projectsService.addCompetitor(id, user.plan, dto);
    return { success: true, data };
  }

  // ─── REMOVE COMPETITOR ─────────────────────────────────

  @Delete(':id/competitors/:competitorId')
  @UseGuards(ProjectOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async removeCompetitor(
    @Param('id') id: string,
    @Param('competitorId') competitorId: string,
  ) {
    const data = await this.projectsService.removeCompetitor(id, competitorId);
    return { success: true, data };
  }
}
