import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/Dialog';
import { NextStepBar } from '@/components/ui/NextStepBar';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject } from '@/hooks/useProjects';
import { useAudits, useStartAudit, useCancelAudit, useDeleteAudit, useScoreHistory } from '@/hooks/useAudits';
import { apiClient, showSuccessToast } from '@repo/shared-frontend';
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
  const [showGuide, setShowGuide] = useState(false);

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

  const handleCancelAudit = async (e: React.MouseEvent, crawlId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Cancel this running audit?')) return;
    try {
      await apiClient.patch(`/projects/${id}/crawls/${crawlId}/cancel`);
      showSuccessToast('Cancelled', 'Audit has been cancelled.');
      queryClient.invalidateQueries({ queryKey: ['audits', id] });
    } catch (err: any) {
      setStartError(err?.response?.data?.message || 'Failed to cancel audit');
    }
  };

  const handleDeleteAudit = async (e: React.MouseEvent, crawlId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this audit? All crawl data, pages, and issues will be permanently removed.')) return;
    try {
      await apiClient.delete(`/projects/${id}/crawls/${crawlId}`);
      showSuccessToast('Deleted', 'Audit has been deleted.');
      queryClient.invalidateQueries({ queryKey: ['audits', id] });
      queryClient.invalidateQueries({ queryKey: ['scoreHistory', id] });
    } catch (err: any) {
      setStartError(err?.response?.data?.message || 'Failed to delete audit');
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h1 className={styles.pageTitle}>Site Audits</h1>
                <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="How to use this tool">?</button>
              </div>
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

          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Site Audits — Guide">
            <h4>What are Site Audits?</h4>
            <p>Site Audit crawls your website and identifies SEO, GEO (Generative Engine Optimization), and AEO (Answer Engine Optimization) issues. Each audit produces a health score and actionable recommendations.</p>

            <h4>How to use it</h4>
            <ul>
              <li><strong>Start an audit</strong> — Click "Start New Audit" to crawl your site.</li>
              <li><strong>View results</strong> — Click any completed audit to see detailed issues, scores, and page-level data.</li>
              <li><strong>Track health</strong> — The score history chart shows how your site health changes over time.</li>
              <li><strong>Fix issues</strong> — Each issue includes a description, severity, and suggested fix.</li>
            </ul>

            <h4>Scores explained</h4>
            <ul>
              <li><strong>Overall Score (0-100)</strong> — Your site's total health. Higher is better.</li>
              <li><strong>SEO Score (1-10)</strong> — Technical SEO health (titles, meta, links, speed).</li>
              <li><strong>GEO Score (1-10)</strong> — Generative engine readiness (E-E-A-T, author info, trust signals).</li>
              <li><strong>AEO Score (1-10)</strong> — Answer engine readiness (FAQ schema, direct answers, structured data).</li>
            </ul>

            <h4>Issue severities</h4>
            <ul>
              <li><strong>Error</strong> — Critical issues that need immediate attention.</li>
              <li><strong>Warning</strong> — Important issues that should be fixed soon.</li>
              <li><strong>Notice</strong> — Minor improvements that would be nice to have.</li>
            </ul>
          </GuideModal>

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
                    <div className={styles.crawlCardActions}>
                      <span className={styles.crawlDate}>
                        {new Date(job.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {(job.status === 'RUNNING' || job.status === 'QUEUED') && (
                        <button
                          className={styles.cancelBtn}
                          onClick={(e) => handleCancelAudit(e, job.id)}
                          title="Cancel this audit"
                        >
                          Cancel
                        </button>
                      )}
                      {(job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') && (
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => handleDeleteAudit(e, job.id)}
                          title="Delete this audit"
                        >
                          Delete
                        </button>
                      )}
                    </div>
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
          <NextStepBar projectId={id} currentStep={2} />
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
