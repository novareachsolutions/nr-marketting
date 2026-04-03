import { SetMetadata } from '@nestjs/common';
import { PLAN_LIMIT_KEY, PlanLimitCheck } from '../guards/plan-limit.guard';

export const CheckPlanLimit = (check: PlanLimitCheck) =>
  SetMetadata(PLAN_LIMIT_KEY, check);
