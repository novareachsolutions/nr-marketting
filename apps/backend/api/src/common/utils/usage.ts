import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_LIMITS } from '../constants/plan-limits';

type UsageMetricType =
  | 'DOMAIN_OVERVIEWS'
  | 'ORGANIC_RANKINGS'
  | 'TOP_PAGES'
  | 'COMPARE_DOMAINS'
  | 'KEYWORD_GAP'
  | 'BACKLINK_GAP'
  | 'AI_SUGGESTIONS';

type PlanLimitKey =
  | 'maxDomainOverviewsPerDay'
  | 'maxOrganicRankingsPerDay'
  | 'maxTopPagesPerDay'
  | 'maxCompareDomainsPerDay'
  | 'maxKeywordGapPerDay'
  | 'maxBacklinkGapPerDay';

/**
 * Increment daily usage for a given metric.
 */
export async function incrementDailyUsage(
  prisma: PrismaService,
  userId: string,
  metric: UsageMetricType,
  limitKey?: PlanLimitKey,
): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const period = `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, '0')}-${String(todayStart.getDate()).padStart(2, '0')}`;

  let limit = 999999;
  if (limitKey) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true },
    });
    const plan = subscription?.plan || 'FREE';
    const planLimit = (PLAN_LIMITS[plan] as any)[limitKey];
    limit = planLimit === -1 ? 999999 : planLimit;
  }

  await prisma.usageRecord.upsert({
    where: {
      userId_metric_period: { userId, metric, period },
    },
    create: { userId, metric, count: 1, limit, period },
    update: { count: { increment: 1 } },
  });
}
