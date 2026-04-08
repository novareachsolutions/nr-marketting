import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject } from '@/hooks/useProjects';
import { apiClient } from '@repo/shared-frontend';
import styles from './[reportId].module.css';

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '--';
  return n.toLocaleString();
}

function changeClass(val: number | null | undefined, invert = false): string {
  if (val === null || val === undefined || val === 0) return styles.changeNeutral;
  const positive = invert ? val < 0 : val > 0;
  return positive ? styles.changePositive : styles.changeNegative;
}

function changeText(val: number | null | undefined): string {
  if (val === null || val === undefined || val === 0) return '0';
  return val > 0 ? `+${formatNum(val)}` : formatNum(val);
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: styles.statusCompleted,
    PENDING: styles.statusPending,
    GENERATING: styles.statusGenerating,
    FAILED: styles.statusFailed,
  };
  return map[status] || '';
}

function ReportDetailContent() {
  const router = useRouter();
  const { id, reportId } = router.query as { id: string; reportId: string };
  const { data: project, isLoading: projectLoading } = useProject(id);

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !reportId) return;
    apiClient
      .get(`/projects/${id}/reports/${reportId}`)
      .then(({ data }) => {
        if (data.success) setReport(data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, reportId]);

  if (projectLoading || loading || !project) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!report) {
    return (
      <>
        <Sidebar projectId={id} />
        <div className={sidebarStyles.contentWithSidebar}>
          <main className={styles.main}>
            <div className={styles.loading}>Report not found.</div>
          </main>
        </div>
      </>
    );
  }

  const data = report.data;
  const isReady = report.status === 'COMPLETED' && data;

  return (
    <>
      <Head>
        <title>{report.title} -- NR SEO Platform</title>
      </Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <Link href={`/dashboard/projects/${id}/reports`} className={styles.backBtn}>
            ← Back to Reports
          </Link>

          <div className={styles.header}>
            <h1 className={styles.pageTitle}>{report.title}</h1>
            <div className={styles.pageMeta}>
              <span className={`${styles.statusBadge} ${getStatusClass(report.status)}`}>
                {report.status}
              </span>
              <span>
                {new Date(report.dateFrom).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {' — '}
                {new Date(report.dateTo).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span>
                Generated {new Date(report.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {!isReady ? (
            <div className={styles.pendingState}>
              <div className={styles.pendingIcon}>
                {report.status === 'FAILED' ? '❌' : '⏳'}
              </div>
              <h3 className={styles.pendingTitle}>
                {report.status === 'FAILED' ? 'Report Failed' : 'Report Generating...'}
              </h3>
              <p className={styles.pendingText}>
                {report.status === 'FAILED'
                  ? 'Something went wrong generating this report. Try generating a new one.'
                  : 'Your report is being generated. This may take a minute. Refresh to check.'}
              </p>
            </div>
          ) : (
            <>
              {/* AI Summary */}
              {data.aiSummary && (
                <div className={styles.aiSummary}>
                  <h3 className={styles.aiSummaryTitle}>🤖 AI Summary</h3>
                  <p className={styles.aiSummaryText}>{data.aiSummary}</p>
                </div>
              )}

              {/* Domain Overview */}
              {data.domainOverview && (
                <div className={styles.moduleSection}>
                  <div className={styles.moduleSectionHeader}>
                    <span className={styles.moduleSectionTitle}>🌐 Domain Overview</span>
                  </div>
                  <div className={styles.moduleSectionBody}>
                    <table className={styles.comparisonTable}>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Previous</th>
                          <th>Current</th>
                          <th>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        <ComparisonRow label="Authority Score" prev={data.domainOverview.previous?.authorityScore} curr={data.domainOverview.current?.authorityScore} change={data.domainOverview.changes?.authorityScore} />
                        <ComparisonRow label="Organic Traffic" prev={data.domainOverview.previous?.organicTraffic} curr={data.domainOverview.current?.organicTraffic} change={data.domainOverview.changes?.organicTraffic} />
                        <ComparisonRow label="Organic Keywords" prev={data.domainOverview.previous?.organicKeywords} curr={data.domainOverview.current?.organicKeywords} change={data.domainOverview.changes?.organicKeywords} />
                        <ComparisonRow label="Total Backlinks" prev={data.domainOverview.previous?.totalBacklinks} curr={data.domainOverview.current?.totalBacklinks} change={data.domainOverview.changes?.totalBacklinks} />
                        <ComparisonRow label="Referring Domains" prev={data.domainOverview.previous?.referringDomains} curr={data.domainOverview.current?.referringDomains} change={data.domainOverview.changes?.referringDomains} />
                        <ComparisonRow label="Traffic Cost" prev={data.domainOverview.previous?.organicTrafficCost} curr={data.domainOverview.current?.organicTrafficCost} change={data.domainOverview.changes?.organicTrafficCost} prefix="$" />
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Organic Rankings */}
              {data.organicRankings && (
                <div className={styles.moduleSection}>
                  <div className={styles.moduleSectionHeader}>
                    <span className={styles.moduleSectionTitle}>📈 Organic Rankings</span>
                  </div>
                  <div className={styles.moduleSectionBody}>
                    <table className={styles.comparisonTable}>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Previous</th>
                          <th>Current</th>
                          <th>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        <ComparisonRow label="Total Keywords" prev={data.organicRankings.previous?.totalKeywords} curr={data.organicRankings.current?.totalKeywords} change={data.organicRankings.changes?.totalKeywordsChange} />
                        <ComparisonRow label="Monthly Traffic" prev={data.organicRankings.previous?.monthlyTraffic} curr={data.organicRankings.current?.monthlyTraffic} change={data.organicRankings.changes?.monthlyTrafficChange} />
                      </tbody>
                    </table>

                    {data.organicRankings.changes?.improved?.length > 0 && (
                      <>
                        <p className={styles.changeLabel}>Improved Keywords</p>
                        <table className={styles.changeTable}>
                          <thead>
                            <tr><th>Keyword</th><th>From</th><th>To</th></tr>
                          </thead>
                          <tbody>
                            {data.organicRankings.changes.improved.map((kw: any, i: number) => (
                              <tr key={i}>
                                <td>{kw.keyword}</td>
                                <td>#{kw.from}</td>
                                <td style={{ color: '#22c55e', fontWeight: 600 }}>#{kw.to}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {data.organicRankings.changes?.declined?.length > 0 && (
                      <>
                        <p className={styles.changeLabel}>Declined Keywords</p>
                        <table className={styles.changeTable}>
                          <thead>
                            <tr><th>Keyword</th><th>From</th><th>To</th></tr>
                          </thead>
                          <tbody>
                            {data.organicRankings.changes.declined.map((kw: any, i: number) => (
                              <tr key={i}>
                                <td>{kw.keyword}</td>
                                <td>#{kw.from}</td>
                                <td style={{ color: '#ef4444', fontWeight: 600 }}>#{kw.to}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {data.organicRankings.changes?.newKeywords?.length > 0 && (
                      <>
                        <p className={styles.changeLabel}>New Keywords</p>
                        <table className={styles.changeTable}>
                          <thead>
                            <tr><th>Keyword</th><th>Position</th></tr>
                          </thead>
                          <tbody>
                            {data.organicRankings.changes.newKeywords.map((kw: any, i: number) => (
                              <tr key={i}>
                                <td>{kw.keyword}</td>
                                <td>#{kw.position}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {data.organicRankings.changes?.lostKeywords?.length > 0 && (
                      <>
                        <p className={styles.changeLabel}>Lost Keywords</p>
                        <table className={styles.changeTable}>
                          <thead>
                            <tr><th>Keyword</th><th>Previous Position</th></tr>
                          </thead>
                          <tbody>
                            {data.organicRankings.changes.lostKeywords.map((kw: any, i: number) => (
                              <tr key={i}>
                                <td>{kw.keyword}</td>
                                <td>#{kw.previousPosition}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Site Audit */}
              {data.siteAudit && (
                <div className={styles.moduleSection}>
                  <div className={styles.moduleSectionHeader}>
                    <span className={styles.moduleSectionTitle}>🛠 Site Audit</span>
                  </div>
                  <div className={styles.moduleSectionBody}>
                    <table className={styles.comparisonTable}>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Previous</th>
                          <th>Current</th>
                          <th>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        <ComparisonRow label="Health Score" prev={data.siteAudit.previous?.healthScore} curr={data.siteAudit.current?.healthScore} change={data.siteAudit.changes?.healthScoreChange} />
                        <ComparisonRow label="Errors" prev={data.siteAudit.previous?.errors} curr={data.siteAudit.current?.errors} change={data.siteAudit.changes?.errorsDelta} invert />
                        <ComparisonRow label="Warnings" prev={data.siteAudit.previous?.warnings} curr={data.siteAudit.current?.warnings} change={data.siteAudit.changes?.warningsDelta} invert />
                        <ComparisonRow label="Notices" prev={data.siteAudit.previous?.notices} curr={data.siteAudit.current?.notices} change={data.siteAudit.changes?.noticesDelta} invert />
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Position Tracking */}
              {data.positionTracking && (
                <div className={styles.moduleSection}>
                  <div className={styles.moduleSectionHeader}>
                    <span className={styles.moduleSectionTitle}>📍 Position Tracking</span>
                  </div>
                  <div className={styles.moduleSectionBody}>
                    <table className={styles.comparisonTable}>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Previous</th>
                          <th>Current</th>
                          <th>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        <ComparisonRow label="Avg. Position" prev={data.positionTracking.previous?.avgPosition} curr={data.positionTracking.current?.avgPosition} change={data.positionTracking.changes?.avgPositionChange} invert />
                        <ComparisonRow label="Keywords in Top 10" prev={data.positionTracking.previous?.keywordsInTop10} curr={data.positionTracking.current?.keywordsInTop10} change={data.positionTracking.changes?.keywordsInTop10Change} />
                        <ComparisonRow label="Keywords in Top 20" prev={data.positionTracking.previous?.keywordsInTop20} curr={data.positionTracking.current?.keywordsInTop20} change={data.positionTracking.changes?.keywordsInTop20Change} />
                        <ComparisonRow label="Visibility Score" prev={data.positionTracking.previous?.visibilityScore} curr={data.positionTracking.current?.visibilityScore} change={data.positionTracking.changes?.visibilityChange} />
                        <ComparisonRow label="Est. Traffic" prev={data.positionTracking.previous?.estimatedTraffic} curr={data.positionTracking.current?.estimatedTraffic} change={data.positionTracking.changes?.trafficChange} />
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top Pages */}
              {data.topPages && (
                <div className={styles.moduleSection}>
                  <div className={styles.moduleSectionHeader}>
                    <span className={styles.moduleSectionTitle}>📄 Top Pages</span>
                  </div>
                  <div className={styles.moduleSectionBody}>
                    {/* Side-by-side Previous vs Current */}
                    <div className={styles.topPagesCompare}>
                      <div className={styles.topPagesCol}>
                        <h4 className={styles.topPagesColTitle}>Previous Top Pages</h4>
                        {(data.topPages.previous?.pages ?? []).slice(0, 10).map((page: any, i: number) => (
                          <div key={i} className={styles.pageItem}>
                            <span className={styles.pageRank}>#{i + 1}</span>
                            <span className={styles.pageUrl}>{page.url}</span>
                            <span className={styles.pageTraffic}>{formatNum(page.traffic)}</span>
                          </div>
                        ))}
                        {(!data.topPages.previous?.pages?.length) && (
                          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No previous data.</p>
                        )}
                      </div>
                      <div className={styles.topPagesCol}>
                        <h4 className={styles.topPagesColTitle}>Current Top Pages</h4>
                        {(data.topPages.current?.pages ?? []).slice(0, 10).map((page: any, i: number) => (
                          <div key={i} className={styles.pageItem}>
                            <span className={styles.pageRank}>#{i + 1}</span>
                            <span className={styles.pageUrl}>{page.url}</span>
                            <span className={styles.pageTraffic}>{formatNum(page.traffic)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Changes summary */}
                    {data.topPages.changes?.newInTop10?.length > 0 && (
                      <>
                        <p className={styles.changeLabel}>New in Top 10</p>
                        {data.topPages.changes.newInTop10.map((page: any, i: number) => (
                          <div key={i} className={styles.pageItem}>
                            <span className={styles.pageUrl}>{page.url}</span>
                            <span className={styles.pageTraffic} style={{ color: '#22c55e' }}>{formatNum(page.traffic)} traffic</span>
                          </div>
                        ))}
                      </>
                    )}
                    {data.topPages.changes?.droppedFromTop10?.length > 0 && (
                      <>
                        <p className={styles.changeLabel}>Dropped from Top 10</p>
                        {data.topPages.changes.droppedFromTop10.map((page: any, i: number) => (
                          <div key={i} className={styles.pageItem}>
                            <span className={styles.pageUrl}>{page.url}</span>
                            <span className={styles.pageTraffic} style={{ color: '#ef4444' }}>{formatNum(page.previousTraffic)} prev. traffic</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {data.keywords && (
                <div className={styles.moduleSection}>
                  <div className={styles.moduleSectionHeader}>
                    <span className={styles.moduleSectionTitle}>🔑 Keywords</span>
                  </div>
                  <div className={styles.moduleSectionBody}>
                    <table className={styles.comparisonTable}>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Previous</th>
                          <th>Current</th>
                          <th>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        <ComparisonRow
                          label="Total Tracked"
                          prev={(data.keywords.totalTracked ?? 0) - (data.keywords.newKeywordsAdded ?? 0)}
                          curr={data.keywords.totalTracked}
                          change={data.keywords.newKeywordsAdded}
                        />
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}

function ComparisonRow({
  label,
  prev,
  curr,
  change,
  invert = false,
  prefix = '',
}: {
  label: string;
  prev: number | null | undefined;
  curr: number | null | undefined;
  change: number | null | undefined;
  invert?: boolean;
  prefix?: string;
}) {
  return (
    <tr>
      <td className={styles.compMetricLabel}>{label}</td>
      <td className={styles.compPrev}>{prefix}{formatNum(prev)}</td>
      <td className={styles.compCurr}>{prefix}{formatNum(curr)}</td>
      <td>
        {change !== null && change !== undefined ? (
          <span className={`${styles.compChange} ${changeClass(change, invert)}`}>
            {changeText(change)}
          </span>
        ) : (
          <span className={styles.changeNeutral}>--</span>
        )}
      </td>
    </tr>
  );
}

export default function ReportDetailPage() {
  return (
    <AuthGuard>
      <ReportDetailContent />
    </AuthGuard>
  );
}
