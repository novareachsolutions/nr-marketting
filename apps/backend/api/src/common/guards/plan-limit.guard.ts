import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_LIMITS, PlanType } from '../constants/plan-limits';

export const PLAN_LIMIT_KEY = 'planLimit';

export interface PlanLimitCheck {
  field: keyof (typeof PLAN_LIMITS)['FREE'];
  countFn?: (prisma: PrismaService, userId: string, projectId?: string) => Promise<number>;
}

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const check = this.reflector.get<PlanLimitCheck>(
      PLAN_LIMIT_KEY,
      context.getHandler(),
    );

    if (!check) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const plan = (user.plan || 'FREE') as PlanType;
    const limits = PLAN_LIMITS[plan];
    const limit = limits[check.field] as number;

    // -1 means unlimited
    if (limit === -1) return true;

    if (check.countFn) {
      const projectId = request.params.id || request.params.projectId;
      const currentCount = await check.countFn(this.prisma, user.id, projectId);

      if (currentCount >= limit) {
        throw new ForbiddenException(
          `Plan limit reached. Your ${plan} plan allows ${limit} for this feature. Please upgrade.`,
        );
      }
    }

    return true;
  }
}
