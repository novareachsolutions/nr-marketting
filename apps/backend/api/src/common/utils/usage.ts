import { PrismaService } from '../../prisma/prisma.service';

type UsageMetricType =
  | 'DOMAIN_OVERVIEWS'
  | 'ORGANIC_RANKINGS'
  | 'TOP_PAGES'
  | 'COMPARE_DOMAINS'
  | 'KEYWORD_GAP'
  | 'BACKLINK_GAP'
  | 'AI_SUGGESTIONS';

/**
 * Increment daily usage for a given metric.
 */
export async function incrementDailyUsage(
  prisma: PrismaService,
  userId: string,
  metric: UsageMetricType,
): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const period = `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, '0')}-${String(todayStart.getDate()).padStart(2, '0')}`;

  await prisma.usageRecord.upsert({
    where: {
      userId_metric_period: { userId, metric, period },
    },
    create: { userId, metric, count: 1, limit: 999999, period },
    update: { count: { increment: 1 } },
  });
}
