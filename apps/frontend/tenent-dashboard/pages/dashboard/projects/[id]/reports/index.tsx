import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject } from '@/hooks/useProjects';
import { apiClient, showSuccessToast } from '@repo/shared-frontend';
import styles from './index.module.css';

const MODULE_LABELS: Record<string, string> = {
  siteAudit: 'Site Audit',
  domainOverview: 'Domain Overview',
  organicRankings: 'Organic Rankings',
  positionTracking: 'Position Tracking',
  topPages: 'Top Pages',
  keywords: 'Keywords',
};

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: styles.statusCompleted,
    PENDING: styles.statusPending,
    GENERATING: styles.statusGenerating,
    FAILED: styles.statusFailed,
  };
  return map[status] || '';
}

interface ReportItem {
  id: string;
  title: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  modulesAnalyzed: string[];
  createdAt: string;
}

function ReportsContent() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { data: project, isLoading: projectLoading } = useProject(id);

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const loadReports = async () => {
    if (!id) return;
    try {
      const { data } = await apiClient.get(`/projects/${id}/reports`);
      if (data.success) setReports(data.data);
    } catch {
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [id]);

  const handleGenerate = async () => {
    setError('');
    setGenerating(true);
    try {
      await apiClient.post(`/projects/${id}/reports/generate`, {});
      showSuccessToast('Started', 'Report generation started. Refresh in a moment to see it.');
      // Reload after a short delay
      setTimeout(() => loadReports(), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, reportId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this report?')) return;
    try {
      await apiClient.delete(`/projects/${id}/reports/${reportId}`);
      showSuccessToast('Deleted', 'Report deleted');
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch {}
  };

  if (projectLoading || !project) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>Reports - {project.name} -- NR SEO Platform</title>
      </Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.pageTitle}>SEO Reports</h1>
              <p className={styles.pageSubtitle}>
                View automated and manual SEO comparison reports.
              </p>
            </div>
            <div className={styles.headerActions}>
              <Link
                href={`/dashboard/projects/${id}/settings`}
                className={styles.settingsBtn}
              >
                ⚙️ Schedule
              </Link>
              <button
                className={styles.generateBtn}
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? 'Generating...' : 'Generate Now'}
              </button>
            </div>
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}

          {reportsLoading ? (
            <div className={styles.loading}>Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📋</div>
              <h3 className={styles.emptyTitle}>No reports yet</h3>
              <p className={styles.emptyText}>
                Generate your first SEO report to see week-over-week comparisons, or set up automated reports in Settings.
              </p>
            </div>
          ) : (
            <div className={styles.reportList}>
              {reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/dashboard/projects/${id}/reports/${report.id}`}
                  className={styles.reportCard}
                >
                  <div className={styles.reportCardTop}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className={styles.reportTitle}>{report.title}</span>
                      <span className={`${styles.statusBadge} ${getStatusClass(report.status)}`}>
                        {report.status}
                      </span>
                    </div>
                    <span className={styles.reportDate}>
                      {new Date(report.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className={styles.reportCardBody}>
                    <span className={styles.reportMeta}>
                      {new Date(report.dateFrom).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      {' — '}
                      {new Date(report.dateTo).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {report.modulesAnalyzed.length > 0 && (
                      <div className={styles.moduleTags}>
                        {report.modulesAnalyzed.map((mod) => (
                          <span key={mod} className={styles.moduleTag}>
                            {MODULE_LABELS[mod] || mod}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => handleDelete(e, report.id)}
                    >
                      Delete
                    </button>
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

export default function ReportsPage() {
  return (
    <AuthGuard>
      <ReportsContent />
    </AuthGuard>
  );
}
