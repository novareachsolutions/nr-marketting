import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject } from '@/hooks/useProjects';
import { useAudits, useStartAudit, useScoreHistory } from '@/hooks/useAudits';
import { showSuccessToast } from '@repo/shared-frontend';
import type { CrawlJob, CrawlStatus, ScoreHistoryEntry } from '@/types/audit';
import styles from './index.module.css';

function getStatusLabel(status: CrawlStatus): string {
  const labels: Record<CrawlStatus, string> = {
    QUEUED: 'Queued',
    RUNNING: 'Running',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
  };
  return labels[status] || status;
}

function getStatusClass(status: CrawlStatus): string {
  const classes: Record<CrawlStatus, string> = {
    QUEUED: styles.statusQueued,
    RUNNING: styles.statusRunning,
    COMPLETED: styles.statusCompleted,
    FAILED: styles.statusFailed,
    CANCELLED: styles.statusCancelled,
  };
  return classes[status] || '';
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'var(--text-tertiary)';
  if (score >= 90) return '#22c55e';
  if (score >= 70) return '#84cc16';
  if (score >= 50) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

function AuditsContent() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useProject(id);
  const [page] = useState(1);
  const { data: auditsResponse, isLoading: auditsLoading } = useAudits(id, page, 20);
  const { data: scoreHistory } = useScoreHistory(id, 10);
  const startAudit = useStartAudit();
  const [startError, setStartError] = useState('');

  const crawlJobs = auditsResponse?.data ?? (auditsResponse as unknown as CrawlJob[]) ?? [];

  const handleStartAudit = async () => {
    setStartError('');
    try {
      await startAudit.mutateAsync({
        url: `/projects/${id}/crawls`,
        body: {},
      });
      showSuccessToast('Audit Started', 'Site crawl has been queued and will begin shortly.');
      queryClient.invalidateQueries({ queryKey: ['audits', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    } catch (err: any) {
      setStartError(err?.message || 'Failed to start audit');
    }
  };

  if (projectLoading || !project) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>Site Audits - {project.name} -- NR SEO Platform</title>
      </Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.pageTitle}>Site Audits</h1>
              <p className={styles.pageSubtitle}>
                Crawl your site to find SEO issues and track health over time.
              </p>
            </div>
            <button
              className={styles.startBtn}
              onClick={handleStartAudit}
              disabled={startAudit.isPending}
            >
              {startAudit.isPending ? 'Starting...' : 'Start New Audit'}
            </button>
          </div>

          {startError && (
            <div className={styles.errorBanner}>{startError}</div>
          )}

          {/* Score Trend Chart */}
          {scoreHistory && scoreHistory.length >= 2 && (
            <div className={styles.trendSection}>
              <h3 className={styles.trendTitle}>Health Score Trend</h3>
              <div className={styles.trendChart}>
                <div className={styles.trendYAxis}>
                  <span>100</span>
                  <span>50</span>
                  <span>0</span>
                </div>
                <div className={styles.trendBars}>
                  {scoreHistory.map((entry: ScoreHistoryEntry) => (
                    <div key={entry.id} className={styles.trendBarWrap}>
                      <div
                        className={styles.trendBar}
                        style={{
                          height: `${entry.score ?? 0}%`,
                          background: getScoreColor(entry.score),
                        }}
                        title={`Score: ${entry.score ?? '--'} | ${new Date(entry.completedAt).toLocaleDateString()}`}
                      />
                      <span className={styles.trendBarLabel}>
                        {new Date(entry.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.trendSummary}>
                <span>
                  Latest: <strong style={{ color: getScoreColor(scoreHistory[scoreHistory.length - 1].score) }}>
                    {scoreHistory[scoreHistory.length - 1].score ?? '--'}
                  </strong>
                </span>
                {scoreHistory.length >= 2 && (() => {
                  const delta = (scoreHistory[scoreHistory.length - 1].score ?? 0) - (scoreHistory[scoreHistory.length - 2].score ?? 0);
                  return (
                    <span style={{ color: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : 'var(--text-tertiary)' }}>
                      {delta > 0 ? '+' : ''}{delta} from previous
                    </span>
                  );
                })()}
              </div>
            </div>
          )}

          {auditsLoading ? (
            <div className={styles.loading}>Loading audits...</div>
          ) : crawlJobs.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔍</div>
              <h3 className={styles.emptyTitle}>No audits yet</h3>
              <p className={styles.emptyText}>
                Start your first site audit to discover SEO issues and get a health score.
              </p>
            </div>
          ) : (
            <div className={styles.crawlList}>
              {crawlJobs.map((job: CrawlJob) => (
                <Link
                  key={job.id}
                  href={`/dashboard/projects/${id}/audits/${job.id}`}
                  className={styles.crawlCard}
                >
                  <div className={styles.crawlCardTop}>
                    <span className={`${styles.statusBadge} ${getStatusClass(job.status)}`}>
                      {getStatusLabel(job.status)}
                    </span>
                    <span className={styles.crawlDate}>
                      {new Date(job.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className={styles.crawlCardBody}>
                    <div className={styles.scoreBlock}>
                      <span
                        className={styles.scoreValue}
                        style={{ color: getScoreColor(job.score) }}
                      >
                        {job.score !== null ? job.score : '--'}
                      </span>
                      <span className={styles.scoreLabel}>Score</span>
                    </div>

                    {/* Dimension scores */}
                    <div className={styles.crawlDimensions}>
                      <div className={styles.crawlDim}>
                        <span className={styles.crawlDimLabel}>SEO</span>
                        <span className={styles.crawlDimValue} style={{ color: job.seoScore !== null ? getScoreColor(job.seoScore * 10) : 'var(--text-tertiary)' }}>
                          {job.seoScore ?? '-'}
                        </span>
                      </div>
                      <div className={styles.crawlDim}>
                        <span className={styles.crawlDimLabel}>GEO</span>
                        <span className={styles.crawlDimValue} style={{ color: job.geoScore !== null ? getScoreColor(job.geoScore * 10) : 'var(--text-tertiary)' }}>
                          {job.geoScore ?? '-'}
                        </span>
                      </div>
                      <div className={styles.crawlDim}>
                        <span className={styles.crawlDimLabel}>AEO</span>
                        <span className={styles.crawlDimValue} style={{ color: job.aeoScore !== null ? getScoreColor(job.aeoScore * 10) : 'var(--text-tertiary)' }}>
                          {job.aeoScore ?? '-'}
                        </span>
                      </div>
                    </div>

                    <div className={styles.crawlStats}>
                      <div className={styles.crawlStat}>
                        <span className={styles.crawlStatValue}>{job.pagesCrawled}</span>
                        <span className={styles.crawlStatLabel}>Pages</span>
                      </div>
                      <div className={styles.crawlStat}>
                        <span className={`${styles.crawlStatValue} ${styles.errorColor}`}>
                          {job.errorCount}
                        </span>
                        <span className={styles.crawlStatLabel}>Errors</span>
                      </div>
                      <div className={styles.crawlStat}>
                        <span className={`${styles.crawlStatValue} ${styles.warningColor}`}>
                          {job.warningCount}
                        </span>
                        <span className={styles.crawlStatLabel}>Warnings</span>
                      </div>
                      <div className={styles.crawlStat}>
                        <span className={`${styles.crawlStatValue} ${styles.noticeColor}`}>
                          {job.noticeCount}
                        </span>
                        <span className={styles.crawlStatLabel}>Notices</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default function AuditsPage() {
  return (
    <AuthGuard>
      <AuditsContent />
    </AuthGuard>
  );
}
