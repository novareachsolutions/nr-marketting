import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject } from '@/hooks/useProjects';
import { useAudit, useCrawlIssues, useThematicReports, useCrawlComparison } from '@/hooks/useAudits';
import { apiClient, showSuccessToast } from '@repo/shared-frontend';
import type { IssueSeverity, CrawlIssue, ThemeReport } from '@/types/audit';
import { generateAuditPdf } from '@/utils/generateAuditPdf';
import styles from './[crawlId].module.css';

const FIXABLE_TYPES = [
  'MISSING_TITLE', 'MISSING_META_DESCRIPTION', 'MISSING_H1',
  'TITLE_TOO_LONG', 'TITLE_TOO_SHORT',
  'META_DESCRIPTION_TOO_LONG', 'META_DESCRIPTION_TOO_SHORT',
  'IMAGE_MISSING_ALT', 'LOW_WORD_COUNT',
  'MISSING_CANONICAL', 'MISSING_STRUCTURED_DATA', 'MISSING_OG_IMAGE',
  'NO_DIRECT_ANSWERS', 'WEAK_EEAT_SIGNALS',
];

type SeverityTab = 'ALL' | IssueSeverity;

function getScoreColor(score: number | null): string {
  if (score === null) return 'var(--text-tertiary)';
  if (score >= 90) return '#22c55e';
  if (score >= 70) return '#84cc16';
  if (score >= 50) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

function getScoreRingClass(score: number | null): string {
  if (score === null) return styles.ringGray;
  if (score >= 90) return styles.ringGreen;
  if (score >= 70) return styles.ringLightGreen;
  if (score >= 50) return styles.ringYellow;
  if (score >= 30) return styles.ringOrange;
  return styles.ringRed;
}

function getDimensionColor(score: number | null): string {
  if (score === null) return 'var(--text-tertiary)';
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#84cc16';
  if (score >= 4) return '#eab308';
  return '#ef4444';
}

function getSeverityClass(severity: IssueSeverity): string {
  if (severity === 'ERROR') return styles.severityError;
  if (severity === 'WARNING') return styles.severityWarning;
  return styles.severityNotice;
}

function formatIssueType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function CrawlDetailContent() {
  const router = useRouter();
  const { id, crawlId } = router.query as { id: string; crawlId: string };
  const queryClient = useQueryClient();

  const { data: project } = useProject(id);
  const { data: crawlJob, isLoading } = useAudit(id, crawlId);
  const [activeTab, setActiveTab] = useState<SeverityTab>('ALL');
  const [issuePage, setIssuePage] = useState(1);
  const [fixingIssue, setFixingIssue] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<Record<string, { method: string; details: string; prUrl?: string }>>({});
  const [viewSection, setViewSection] = useState<'issues' | 'themes' | 'comparison'>('issues');
  const [downloading, setDownloading] = useState(false);

  const { data: thematicReports } = useThematicReports(id, crawlId);
  const { data: comparison } = useCrawlComparison(id, crawlId, viewSection === 'comparison');

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const { data } = await apiClient.get(`/projects/${id}/crawls/${crawlId}/export`);
      if (data.success) {
        generateAuditPdf(data.data);
        showSuccessToast('PDF Downloaded', 'Audit report has been saved.');
      }
    } catch (err: any) {
      console.error('PDF export failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleFix = async (issueId: string) => {
    setFixingIssue(issueId);
    try {
      const { data } = await apiClient.post(`/projects/${id}/fix-issue/${issueId}`);
      if (data.success) {
        const result = data.data;
        setFixResult(prev => ({ ...prev, [issueId]: result }));
        if (result.fixed) {
          showSuccessToast(
            result.method === 'github' ? 'PR Created' : 'Fixed',
            result.details,
          );
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Fix failed';
      setFixResult(prev => ({ ...prev, [issueId]: { method: 'error', details: msg } }));
    } finally {
      setFixingIssue(null);
    }
  };

  const severityFilter = activeTab === 'ALL' ? undefined : activeTab;
  const { data: issuesResponse, isLoading: issuesLoading } = useCrawlIssues(
    id,
    crawlId,
    severityFilter,
    undefined,
    issuePage,
    50,
  );

  const issues = issuesResponse?.data ?? (issuesResponse as unknown as CrawlIssue[]) ?? [];
  const issuesMeta = issuesResponse?.meta;

  const handleCancel = async () => {
    if (!confirm('Cancel this crawl?')) return;
    try {
      await apiClient.patch(`/projects/${id}/crawls/${crawlId}/cancel`);
      showSuccessToast('Cancelled', 'Crawl has been cancelled.');
      queryClient.invalidateQueries({ queryKey: ['audit', crawlId] });
      queryClient.invalidateQueries({ queryKey: ['audits', id] });
    } catch {
      // handled by global toast
    }
  };

  if (isLoading || !crawlJob) {
    return <div className={styles.loading}>Loading audit details...</div>;
  }

  const score = crawlJob.score;
  const isActive = crawlJob.status === 'QUEUED' || crawlJob.status === 'RUNNING';

  const tabs: { key: SeverityTab; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: crawlJob.errorCount + crawlJob.warningCount + crawlJob.noticeCount },
    { key: 'ERROR', label: 'Errors', count: crawlJob.errorCount },
    { key: 'WARNING', label: 'Warnings', count: crawlJob.warningCount },
    { key: 'NOTICE', label: 'Notices', count: crawlJob.noticeCount },
  ];

  return (
    <>
      <Head>
        <title>Audit Details - {project?.name ?? 'Project'} -- NR SEO Platform</title>
      </Head>
      <Sidebar projectId={id as string} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            {crawlJob.status === 'COMPLETED' && (
              <button
                className={styles.downloadBtn}
                onClick={handleDownloadPdf}
                disabled={downloading}
              >
                {downloading ? 'Generating...' : 'Download PDF Report'}
              </button>
            )}
            {isActive && (
              <button className={styles.cancelBtn} onClick={handleCancel}>
                Cancel Crawl
              </button>
            )}
          </div>
          {/* Score + Stats */}
          <div className={styles.summaryRow}>
            <div className={`${styles.scoreCircle} ${getScoreRingClass(score)}`}>
              <span className={styles.scoreNumber} style={{ color: getScoreColor(score) }}>
                {score !== null ? score : '--'}
              </span>
              <span className={styles.scoreText}>Health</span>
            </div>

            {/* 3-Dimension Scores */}
            <div className={styles.dimensionScores}>
              <div className={styles.dimensionCard}>
                <span className={styles.dimensionLabel}>SEO</span>
                <span className={styles.dimensionValue} style={{ color: getDimensionColor(crawlJob.seoScore) }}>
                  {crawlJob.seoScore ?? '--'}<span className={styles.dimensionMax}>/10</span>
                </span>
              </div>
              <div className={styles.dimensionCard}>
                <span className={styles.dimensionLabel}>GEO</span>
                <span className={styles.dimensionValue} style={{ color: getDimensionColor(crawlJob.geoScore) }}>
                  {crawlJob.geoScore ?? '--'}<span className={styles.dimensionMax}>/10</span>
                </span>
              </div>
              <div className={styles.dimensionCard}>
                <span className={styles.dimensionLabel}>AEO</span>
                <span className={styles.dimensionValue} style={{ color: getDimensionColor(crawlJob.aeoScore) }}>
                  {crawlJob.aeoScore ?? '--'}<span className={styles.dimensionMax}>/10</span>
                </span>
              </div>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{crawlJob.pagesCrawled}</div>
                <div className={styles.statLabel}>Pages Crawled</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statValue} ${styles.errorColor}`}>{crawlJob.errorCount}</div>
                <div className={styles.statLabel}>Errors</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statValue} ${styles.warningColor}`}>{crawlJob.warningCount}</div>
                <div className={styles.statLabel}>Warnings</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statValue} ${styles.noticeColor}`}>{crawlJob.noticeCount}</div>
                <div className={styles.statLabel}>Notices</div>
              </div>
            </div>
          </div>

          {/* Status info */}
          {isActive && (
            <div className={styles.progressBanner}>
              Crawl is {crawlJob.status.toLowerCase()}... {crawlJob.pagesCrawled} of {crawlJob.pagesTotal || '?'} pages crawled.
              Refresh to see updated progress.
            </div>
          )}

          {/* Section navigation */}
          <div className={styles.sectionNav}>
            <button
              className={`${styles.sectionNavBtn} ${viewSection === 'issues' ? styles.sectionNavActive : ''}`}
              onClick={() => setViewSection('issues')}
            >
              Issues
            </button>
            <button
              className={`${styles.sectionNavBtn} ${viewSection === 'themes' ? styles.sectionNavActive : ''}`}
              onClick={() => setViewSection('themes')}
            >
              Thematic Reports
            </button>
            <button
              className={`${styles.sectionNavBtn} ${viewSection === 'comparison' ? styles.sectionNavActive : ''}`}
              onClick={() => setViewSection('comparison')}
            >
              Compare with Previous
            </button>
          </div>

          {/* Thematic Reports Section */}
          {viewSection === 'themes' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Thematic Reports</span>
              </div>
              {thematicReports ? (
                <div>
                  {/* Dimension score summary */}
                  <div className={styles.dimensionSummaryBar}>
                    <div className={styles.dimensionSummaryItem}>
                      <span>SEO</span>
                      <strong style={{ color: getDimensionColor(thematicReports.seoScore) }}>{thematicReports.seoScore ?? '--'}/10</strong>
                    </div>
                    <div className={styles.dimensionSummaryItem}>
                      <span>GEO</span>
                      <strong style={{ color: getDimensionColor(thematicReports.geoScore) }}>{thematicReports.geoScore ?? '--'}/10</strong>
                    </div>
                    <div className={styles.dimensionSummaryItem}>
                      <span>AEO</span>
                      <strong style={{ color: getDimensionColor(thematicReports.aeoScore) }}>{thematicReports.aeoScore ?? '--'}/10</strong>
                    </div>
                  </div>

                  {/* Themes grouped by dimension */}
                  {(['SEO', 'GEO', 'AEO'] as const).map(dim => {
                    const dimThemes = thematicReports.themes.filter((t: ThemeReport) => t.dimension === dim);
                    if (dimThemes.length === 0) return null;
                    return (
                      <div key={dim} style={{ marginBottom: 20 }}>
                        <h4 className={styles.dimensionGroupTitle}>{dim} {dim === 'GEO' ? '(AI Search)' : dim === 'AEO' ? '(Answer Engines)' : '(Search Engines)'}</h4>
                        <div className={styles.themesGrid}>
                          {dimThemes.map((theme: ThemeReport) => (
                    <div key={theme.theme} className={styles.themeCard}>
                      <div className={styles.themeHeader}>
                        <span className={styles.themeName}>{theme.theme.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                        <span
                          className={styles.themeScore}
                          style={{ color: getScoreColor(theme.themeScore) }}
                        >
                          {theme.themeScore}
                        </span>
                      </div>
                      <div className={styles.themeCounts}>
                        <span className={styles.errorColor}>{theme.errorCount} errors</span>
                        <span className={styles.warningColor}>{theme.warningCount} warnings</span>
                        <span className={styles.noticeColor}>{theme.noticeCount} notices</span>
                      </div>
                      {theme.topIssues.length > 0 && (
                        <div className={styles.themeIssues}>
                          {theme.topIssues.map((issue, i) => (
                            <div key={i} className={styles.themeIssueRow}>
                              <span className={`${styles.severityBadge} ${getSeverityClass(issue.severity)}`}>
                                {issue.severity}
                              </span>
                              <span className={styles.themeIssueType}>{formatIssueType(issue.type)}</span>
                              <span className={styles.themeIssueCount}>{issue.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyIssues}>Loading thematic reports...</div>
              )}
            </div>
          )}

          {/* Comparison Section */}
          {viewSection === 'comparison' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Crawl Comparison</span>
              </div>
              {comparison && comparison.previousCrawlId ? (
                <div className={styles.comparisonContent}>
                  <div className={styles.comparisonSummary}>
                    <div className={styles.comparisonStat}>
                      <span className={styles.comparisonDelta} style={{ color: comparison.scoreDelta >= 0 ? '#22c55e' : '#ef4444' }}>
                        {comparison.scoreDelta > 0 ? '+' : ''}{comparison.scoreDelta}
                      </span>
                      <span className={styles.comparisonLabel}>Score Change</span>
                    </div>
                    <div className={styles.comparisonStat}>
                      <span className={styles.comparisonDelta} style={{ color: '#22c55e' }}>
                        {comparison.summary.fixedIssues}
                      </span>
                      <span className={styles.comparisonLabel}>Fixed</span>
                    </div>
                    <div className={styles.comparisonStat}>
                      <span className={styles.comparisonDelta} style={{ color: '#ef4444' }}>
                        +{comparison.summary.newIssues}
                      </span>
                      <span className={styles.comparisonLabel}>New Issues</span>
                    </div>
                    <div className={styles.comparisonStat}>
                      <span className={styles.comparisonDelta} style={{ color: 'var(--text-tertiary)' }}>
                        {comparison.summary.persistentIssues}
                      </span>
                      <span className={styles.comparisonLabel}>Persistent</span>
                    </div>
                  </div>

                  {comparison.fixedIssues.length > 0 && (
                    <div className={styles.comparisonGroup}>
                      <h4 className={styles.comparisonGroupTitle} style={{ color: '#22c55e' }}>Fixed Issues ({comparison.fixedIssues.length})</h4>
                      {comparison.fixedIssues.slice(0, 20).map((issue, i) => (
                        <div key={i} className={styles.comparisonRow}>
                          <span className={`${styles.severityBadge} ${getSeverityClass(issue.severity)}`}>{issue.severity}</span>
                          <span className={styles.comparisonType}>{formatIssueType(issue.type)}</span>
                          <span className={styles.comparisonUrl} title={issue.url}>{issue.url.replace(/^https?:\/\//, '').slice(0, 50)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {comparison.newIssues.length > 0 && (
                    <div className={styles.comparisonGroup}>
                      <h4 className={styles.comparisonGroupTitle} style={{ color: '#ef4444' }}>New Issues ({comparison.newIssues.length})</h4>
                      {comparison.newIssues.slice(0, 20).map((issue, i) => (
                        <div key={i} className={styles.comparisonRow}>
                          <span className={`${styles.severityBadge} ${getSeverityClass(issue.severity)}`}>{issue.severity}</span>
                          <span className={styles.comparisonType}>{formatIssueType(issue.type)}</span>
                          <span className={styles.comparisonUrl} title={issue.url}>{issue.url.replace(/^https?:\/\//, '').slice(0, 50)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.emptyIssues}>
                  Run at least 2 crawls to compare results. The comparison will show new, fixed, and persistent issues between crawls.
                </div>
              )}
            </div>
          )}

          {/* Issues section */}
          {viewSection === 'issues' && <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Issues</span>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                  onClick={() => { setActiveTab(tab.key); setIssuePage(1); }}
                >
                  {tab.label}
                  <span className={styles.tabCount}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Issues table */}
            {issuesLoading ? (
              <div className={styles.tableLoading}>Loading issues...</div>
            ) : issues.length === 0 ? (
              <div className={styles.emptyIssues}>
                {crawlJob.status === 'COMPLETED'
                  ? 'No issues found for this filter.'
                  : 'Issues will appear here once the crawl completes.'}
              </div>
            ) : (
              <>
                <div className={styles.issuesTable}>
                  <div className={styles.tableHeader}>
                    <span className={styles.colUrl}>Page URL</span>
                    <span className={styles.colType}>Issue</span>
                    <span className={styles.colSeverity}>Severity</span>
                  </div>
                  {issues.map((issue: CrawlIssue) => (
                    <div key={issue.id} className={styles.issueRow}>
                      {/* Row top: URL, Issue Type, Severity */}
                      <div className={styles.issueRowTop}>
                        <span className={styles.colUrl} title={issue.crawlPage.url}>
                          {issue.crawlPage.url.replace(/^https?:\/\//, '').slice(0, 60)}
                        </span>
                        <span className={styles.colType}>
                          {formatIssueType(issue.type)}
                        </span>
                        <span className={styles.colSeverity}>
                          <span className={`${styles.severityBadge} ${getSeverityClass(issue.severity)}`}>
                            {issue.severity}
                          </span>
                        </span>
                      </div>

                      {/* Row middle: Issue description */}
                      <div className={styles.issueRowMessage}>
                        {issue.message}
                      </div>

                      {/* Row bottom: How to fix + Action */}
                      {issue.suggestion && (
                        <div className={styles.issueRowFix}>
                          <span className={styles.fixLabel}>How to fix:</span>
                          <span className={styles.fixText}>{issue.suggestion}</span>
                          {FIXABLE_TYPES.includes(issue.type) && !fixResult[issue.id] && (
                            <button
                              className={styles.autoFixBtn}
                              onClick={() => handleFix(issue.id)}
                              disabled={fixingIssue === issue.id}
                            >
                              {fixingIssue === issue.id ? 'Fixing...' : 'Auto-Fix'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Fix result */}
                      {fixResult[issue.id] && (
                        <div className={styles.issueRowFixResult} style={{
                          color: fixResult[issue.id].method === 'error' ? 'var(--accent-danger)' : 'var(--accent-success)',
                        }}>
                          {fixResult[issue.id].details}
                          {fixResult[issue.id].prUrl && (
                            <a href={fixResult[issue.id].prUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6 }}>
                              View PR
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {issuesMeta && issuesMeta.totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button
                      className={styles.pageBtn}
                      disabled={issuePage <= 1}
                      onClick={() => setIssuePage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span className={styles.pageInfo}>
                      Page {issuesMeta.page} of {issuesMeta.totalPages}
                    </span>
                    <button
                      className={styles.pageBtn}
                      disabled={issuePage >= issuesMeta.totalPages}
                      onClick={() => setIssuePage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>}
        </main>
      </div>
    </>
  );
}

export default function CrawlDetailPage() {
  return (
    <AuthGuard>
      <CrawlDetailContent />
    </AuthGuard>
  );
}
