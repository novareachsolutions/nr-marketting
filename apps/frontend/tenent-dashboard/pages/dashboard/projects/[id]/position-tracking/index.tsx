import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/GuideModal';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import {
  usePositionTrackingOverview,
  usePositionTrackingTrend,
  useTriggerRankCheck,
  useUpdateRankSchedule,
} from '@/hooks/usePositionTracking';
import { showSuccessToast } from '@repo/shared-frontend';
import type { PositionTrackingOverview, PositionTrendPoint } from '@/types/positionTracking';
import styles from './index.module.css';

function getChangeArrow(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return '';
  if (current > previous) return ' ↑';
  if (current < previous) return ' ↓';
  return '';
}

function getChangeColor(current: number | null, previous: number | null, invert = false): string {
  if (current === null || previous === null) return 'var(--text-tertiary)';
  if (current > previous) return invert ? '#ef4444' : '#22c55e';
  if (current < previous) return invert ? '#22c55e' : '#ef4444';
  return 'var(--text-tertiary)';
}

const DIST_COLORS: Record<string, string> = {
  top3: '#22c55e',
  top10: '#84cc16',
  top20: '#eab308',
  top50: '#f97316',
  top100: '#ef4444',
  notRanking: '#94a3b8',
};

const DIST_LABELS: Record<string, string> = {
  top3: 'Top 3',
  top10: '4-10',
  top20: '11-20',
  top50: '21-50',
  top100: '51-100',
  notRanking: 'Not Ranking',
};

function PositionTrackingContent() {
  const router = useRouter();
  const { id: projectId } = router.query as { id: string };
  const queryClient = useQueryClient();

  const [checkingNow, setCheckingNow] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [trendDays, setTrendDays] = useState(30);

  const { data: overview, isLoading: overviewLoading } = usePositionTrackingOverview(projectId);
  const { data: trend } = usePositionTrackingTrend(projectId, trendDays);
  const triggerCheck = useTriggerRankCheck();
  const updateSchedule = useUpdateRankSchedule();

  const handleCheckNow = async () => {
    if (!projectId || checkingNow) return;
    setCheckingNow(true);
    try {
      await triggerCheck.mutateAsync({
        url: `/projects/${projectId}/position-tracking/check-now`,
        body: {},
      });
      showSuccessToast('Check Started', 'Position check is running in the background');
      queryClient.invalidateQueries({ queryKey: ['pt-overview'] });
      queryClient.invalidateQueries({ queryKey: ['pt-keywords'] });
    } catch {
      // handled by global error
    } finally {
      setCheckingNow(false);
    }
  };

  const handleScheduleChange = async (schedule: string) => {
    try {
      await updateSchedule.mutateAsync({
        url: `/projects/${projectId}/position-tracking/schedule`,
        body: { schedule },
      });
      showSuccessToast('Schedule Updated', `Rank checks set to ${schedule.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ['pt-overview'] });
    } catch {
      // handled
    }
  };

  const ov = overview as PositionTrackingOverview | undefined;
  const trendData = (trend || []) as PositionTrendPoint[];

  const distTotal = ov
    ? ov.distribution.top3 +
      ov.distribution.top10 +
      ov.distribution.top20 +
      ov.distribution.top50 +
      ov.distribution.top100 +
      ov.distribution.notRanking
    : 0;

  return (
    <>
      <Sidebar projectId={projectId} />
      <Head>
        <title>Position Tracking | NR SEO</title>
      </Head>

      <main className={`${sidebarStyles.contentWithSidebar} ${styles.main}`}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 className={styles.title}>Position Tracking</h1>
              <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="How to use this tool">?</button>
            </div>

            <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Position Tracking — Guide">
              <h4>What is Position Tracking?</h4>
              <p>Monitor your keyword rankings in Google over time. Add keywords you want to track and see daily position changes, visibility score, estimated traffic, and ranking distribution.</p>

              <h4>How to use it</h4>
              <ul>
                <li><strong>Add keywords</strong> — Go to the Rankings Table to add keywords manually or import from your project.</li>
                <li><strong>Check rankings</strong> — Click "Check Now" to trigger a manual rank check, or set a schedule (Daily/Weekly/Monthly).</li>
                <li><strong>Monitor trends</strong> — The visibility trend chart shows your overall ranking strength over time.</li>
                <li><strong>View distribution</strong> — See how many keywords are in Top 3, Top 10, Top 20, etc.</li>
              </ul>

              <h4>Key metrics explained</h4>
              <ul>
                <li><strong>Visibility Score</strong> — Weighted score based on positions and search volumes. Higher = better overall rankings.</li>
                <li><strong>Estimated Traffic</strong> — Projected organic visits based on your positions and CTR model.</li>
                <li><strong>Average Position</strong> — Mean ranking across all tracked keywords.</li>
                <li><strong>Distribution</strong> — Breakdown of keywords by position range (Top 3, 4-10, 11-20, etc.).</li>
                <li><strong>Changes</strong> — How many keywords improved, declined, were newly found, or lost since last check.</li>
              </ul>

              <h4>Pro tips</h4>
              <ul>
                <li>Set up Daily schedule for important keywords so you catch ranking drops early.</li>
                <li>Use tags to group keywords by topic or priority.</li>
                <li>A rising visibility score means your SEO efforts are working.</li>
              </ul>
            </GuideModal>

            <p className={styles.subtitle}>
              Monitor your keyword rankings over time
              {ov?.lastCheckedAt && (
                <span className={styles.lastChecked}>
                  {' '}
                  — Last checked: {new Date(ov.lastCheckedAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
          <div className={styles.headerActions}>
            <select
              className={styles.scheduleSelect}
              value={ov?.rankCheckSchedule || 'NONE'}
              onChange={(e) => handleScheduleChange(e.target.value)}
            >
              <option value="NONE">No Schedule</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            <button
              className={styles.checkNowBtn}
              onClick={handleCheckNow}
              disabled={checkingNow}
            >
              {checkingNow ? 'Checking...' : 'Check Now'}
            </button>
          </div>
        </div>

        {overviewLoading ? (
          <div className={styles.loadingState}>Loading position data...</div>
        ) : !ov || ov.totalKeywords === 0 ? (
          <div className={styles.emptyState}>
            <h2>No keywords tracked yet</h2>
            <p>Add keywords to start tracking their positions on Google.</p>
            <Link
              href={`/dashboard/projects/${projectId}/position-tracking/keywords`}
              className={styles.addKeywordsLink}
            >
              Go to Rankings Table →
            </Link>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className={styles.summaryRow}>
              <div className={styles.summaryCard}>
                <span className={styles.cardLabel}>Visibility Score</span>
                <span className={styles.cardValue}>
                  {ov.visibilityScore.toFixed(1)}%
                </span>
                {ov.previousVisibilityScore !== null && (
                  <span
                    className={styles.cardChange}
                    style={{
                      color: getChangeColor(ov.visibilityScore, ov.previousVisibilityScore),
                    }}
                  >
                    {(ov.visibilityScore - ov.previousVisibilityScore).toFixed(1)}%
                    {getChangeArrow(ov.visibilityScore, ov.previousVisibilityScore)}
                  </span>
                )}
              </div>

              <div className={styles.summaryCard}>
                <span className={styles.cardLabel}>Est. Traffic</span>
                <span className={styles.cardValue}>
                  {ov.estimatedTraffic.toLocaleString()}
                </span>
                {ov.previousEstimatedTraffic !== null && (
                  <span
                    className={styles.cardChange}
                    style={{
                      color: getChangeColor(ov.estimatedTraffic, ov.previousEstimatedTraffic),
                    }}
                  >
                    {ov.estimatedTraffic - ov.previousEstimatedTraffic > 0 ? '+' : ''}
                    {(ov.estimatedTraffic - ov.previousEstimatedTraffic).toLocaleString()}
                    {getChangeArrow(ov.estimatedTraffic, ov.previousEstimatedTraffic)}
                  </span>
                )}
              </div>

              <div className={styles.summaryCard}>
                <span className={styles.cardLabel}>Avg. Position</span>
                <span className={styles.cardValue}>
                  {ov.averagePosition !== null ? ov.averagePosition.toFixed(1) : '--'}
                </span>
                {ov.previousAveragePosition !== null && ov.averagePosition !== null && (
                  <span
                    className={styles.cardChange}
                    style={{
                      color: getChangeColor(
                        ov.previousAveragePosition,
                        ov.averagePosition,
                      ),
                    }}
                  >
                    {(ov.previousAveragePosition - ov.averagePosition).toFixed(1)}
                    {getChangeArrow(ov.previousAveragePosition, ov.averagePosition)}
                  </span>
                )}
              </div>

              <div className={styles.summaryCard}>
                <span className={styles.cardLabel}>Total Keywords</span>
                <span className={styles.cardValue}>{ov.totalKeywords}</span>
              </div>
            </div>

            {/* Position Changes */}
            <div className={styles.changesRow}>
              <div className={`${styles.changeCard} ${styles.changeImproved}`}>
                <span className={styles.changeCount}>{ov.changes.improved}</span>
                <span className={styles.changeLabel}>Improved</span>
              </div>
              <div className={`${styles.changeCard} ${styles.changeDeclined}`}>
                <span className={styles.changeCount}>{ov.changes.declined}</span>
                <span className={styles.changeLabel}>Declined</span>
              </div>
              <div className={`${styles.changeCard} ${styles.changeNew}`}>
                <span className={styles.changeCount}>{ov.changes.new}</span>
                <span className={styles.changeLabel}>New</span>
              </div>
              <div className={`${styles.changeCard} ${styles.changeLost}`}>
                <span className={styles.changeCount}>{ov.changes.lost}</span>
                <span className={styles.changeLabel}>Lost</span>
              </div>
            </div>

            {/* Rankings Distribution */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Rankings Distribution</h2>
              {distTotal > 0 && (
                <>
                  <div className={styles.distBar}>
                    {Object.entries(ov.distribution).map(([key, count]) =>
                      count > 0 ? (
                        <div
                          key={key}
                          className={styles.distSegment}
                          style={{
                            width: `${(count / distTotal) * 100}%`,
                            backgroundColor: DIST_COLORS[key],
                          }}
                          title={`${DIST_LABELS[key]}: ${count} keywords`}
                        />
                      ) : null,
                    )}
                  </div>
                  <div className={styles.distLegend}>
                    {Object.entries(ov.distribution).map(([key, count]) => (
                      <div key={key} className={styles.legendItem}>
                        <span
                          className={styles.legendDot}
                          style={{ backgroundColor: DIST_COLORS[key] }}
                        />
                        <span className={styles.legendLabel}>
                          {DIST_LABELS[key]}: {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Trend Chart */}
            {trendData.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Visibility Trend</h2>
                  <div className={styles.trendDays}>
                    {[7, 14, 30, 60].map((d) => (
                      <button
                        key={d}
                        className={`${styles.dayBtn} ${trendDays === d ? styles.dayBtnActive : ''}`}
                        onClick={() => setTrendDays(d)}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.trendBars}>
                  {trendData.map((point, i) => {
                    const maxVis = Math.max(...trendData.map((p) => p.visibilityScore), 1);
                    const height = (point.visibilityScore / maxVis) * 100;
                    return (
                      <div
                        key={i}
                        className={styles.trendBar}
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${point.date}: ${point.visibilityScore.toFixed(1)}%`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Link to Rankings Table */}
            <div className={styles.viewAllRow}>
              <Link
                href={`/dashboard/projects/${projectId}/position-tracking/keywords`}
                className={styles.viewAllBtn}
              >
                View All Keywords →
              </Link>
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default function PositionTrackingPage() {
  return (
    <AuthGuard>
      <PositionTrackingContent />
    </AuthGuard>
  );
}
