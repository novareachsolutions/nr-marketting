import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';

export const PLAN_LIMIT_KEY = 'planLimit';

export interface PlanLimitCheck {
  field: string;
  countFn?: (prisma: any, userId: string, projectId?: string) => Promise<number>;
}

@Injectable()
export class PlanLimitGuard implements CanActivate {
  async canActivate(_context: ExecutionContext): Promise<boolean> {
    // Plan limits disabled — always allow
    return true;
  }
}
