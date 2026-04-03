import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS, PlanType } from '../common/constants/plan-limits';
import { CreateProjectDto, UpdateProjectDto, AddCompetitorDto } from './dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── DOMAIN NORMALIZATION ──────────────────────────────

  private normalizeDomain(raw: string): string {
    let domain = raw.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, '');
    domain = domain.replace(/^www\./, '');
    domain = domain.replace(/\/+$/, '');
    return domain;
  }

  // ─── CREATE PROJECT ────────────────────────────────────

  async create(userId: string, plan: string, dto: CreateProjectDto) {
    const planLimits = PLAN_LIMITS[plan as PlanType] || PLAN_LIMITS.FREE;

    // Check project count limit
    const projectCount = await this.prisma.project.count({
      where: { userId },
    });

    if (projectCount >= planLimits.maxProjects) {
      throw new ForbiddenException(
        `Your ${plan} plan allows up to ${planLimits.maxProjects} project(s). Please upgrade.`,
      );
    }

    const domain = this.normalizeDomain(dto.domain);

    // Check uniqueness
    const existing = await this.prisma.project.findUnique({
      where: { userId_domain: { userId, domain } },
    });

    if (existing) {
      throw new ConflictException(
        `You already have a project for "${domain}"`,
      );
    }

    return this.prisma.project.create({
      data: {
        userId,
        domain,
        name: dto.name,
        timezone: dto.timezone || 'UTC',
        sourceType: dto.sourceType || 'MANUAL',
      },
    });
  }

  // ─── LIST USER PROJECTS ────────────────────────────────

  async findAllByUser(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            competitors: true,
            trackedKeywords: true,
            crawlJobs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── GET PROJECT BY ID ─────────────────────────────────

  async findById(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        competitors: { orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            trackedKeywords: true,
            crawlJobs: true,
            projectKeywords: true,
            conversations: true,
            reports: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  // ─── UPDATE PROJECT ────────────────────────────────────

  async update(projectId: string, dto: UpdateProjectDto) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ─── DELETE PROJECT (CASCADE) ──────────────────────────

  async delete(projectId: string) {
    await this.prisma.project.delete({
      where: { id: projectId },
    });
    return { message: 'Project and all related data deleted' };
  }

  // ─── LIST COMPETITORS ──────────────────────────────────

  async getCompetitors(projectId: string) {
    return this.prisma.competitor.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── ADD COMPETITOR ────────────────────────────────────

  async addCompetitor(
    projectId: string,
    plan: string,
    dto: AddCompetitorDto,
  ) {
    const planLimits = PLAN_LIMITS[plan as PlanType] || PLAN_LIMITS.FREE;

    const competitorCount = await this.prisma.competitor.count({
      where: { projectId },
    });

    if (competitorCount >= planLimits.maxCompetitorsPerProject) {
      throw new ForbiddenException(
        `Your ${plan} plan allows up to ${planLimits.maxCompetitorsPerProject} competitor(s) per project. Please upgrade.`,
      );
    }

    const domain = this.normalizeDomain(dto.domain);

    const existing = await this.prisma.competitor.findUnique({
      where: { projectId_domain: { projectId, domain } },
    });

    if (existing) {
      throw new ConflictException(
        `Competitor "${domain}" is already added to this project`,
      );
    }

    return this.prisma.competitor.create({
      data: {
        projectId,
        domain,
        name: dto.name || null,
      },
    });
  }

  // ─── REMOVE COMPETITOR ─────────────────────────────────

  async removeCompetitor(projectId: string, competitorId: string) {
    const competitor = await this.prisma.competitor.findFirst({
      where: { id: competitorId, projectId },
    });

    if (!competitor) {
      throw new NotFoundException('Competitor not found');
    }

    await this.prisma.competitor.delete({
      where: { id: competitorId },
    });

    return { message: 'Competitor removed' };
  }

  // ─── HELPER: Count projects for PlanLimitGuard ─────────

  static async countProjects(
    prisma: PrismaService,
    userId: string,
  ): Promise<number> {
    return prisma.project.count({ where: { userId } });
  }
}
