import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useTrackedKeywordHistory } from '@/hooks/usePositionTracking';
import type { RankingHistoryEntry } from '@/types/positionTracking';
import styles from './[keywordId].module.css';

function getPositionColor(pos: number | null): string {
  if (pos === null) return '#94a3b8';
  if (pos <= 3) return '#22c55e';
  if (pos <= 10) return '#84cc16';
  if (pos <= 20) return '#eab308';
  if (pos <= 50) return '#f97316';
  return '#ef4444';
}

function formatVolume(v: number | null): string {
  if (v === null) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toString();
}

function KeywordDetailContent() {
  const router = useRouter();
  const { id: projectId, keywordId } = router.query as {
    id: string;
    keywordId: string;
  };

  const { data, isLoading } = useTrackedKeywordHistory(projectId, keywordId, 90);

  const history = data?.history || [];
  const currentPos = history.length > 0 ? history[0].position : null;

  // Compute change from most recent vs second most recent
  const prevPos = history.length > 1 ? history[1].position : null;
  let change: number | null = null;
  if (currentPos !== null && prevPos !== null) {
    change = prevPos - currentPos;
  }

  // Best/worst positions
  const rankedHistory = history.filter((h: RankingHistoryEntry) => h.position !== null);
  const bestPos = rankedHistory.length > 0
    ? Math.min(...rankedHistory.map((h: RankingHistoryEntry) => h.position!))
    : null;
  const worstPos = rankedHistory.length > 0
    ? Math.max(...rankedHistory.map((h: RankingHistoryEntry) => h.position!))
    : null;

  // Trend chart data (reversed so oldest is first)
  const trendData = [...history].reverse();

  return (
    <>
      <Sidebar projectId={projectId} />
      <Head>
        <title>{data?.keyword || 'Keyword'} — Position History | NR SEO</title>
      </Head>

      <main className={`${sidebarStyles.contentWithSidebar} ${styles.main}`}>
        {isLoading ? (
          <div className={styles.loadingState}>Loading keyword data...</div>
        ) : !data ? (
          <div className={styles.emptyState}>Keyword not found</div>
        ) : (
          <>
            {/* Header */}
            <div className={styles.header}>
              <div>
                <p className={styles.breadcrumb}>
                  <Link
                    href={`/dashboard/projects/${projectId}/position-tracking/keywords`}
                    className={styles.backLink}
                  >
                    ← Rankings Table
                  </Link>
                </p>
                <h1 className={styles.title}>{data.keyword}</h1>
                <p className={styles.subtitle}>
                  {data.device} · {data.country}
                  {data.targetUrl && (
                    <span> · Target: {data.targetUrl}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className={styles.summaryRow}>
              <div className={styles.summaryCard}>
                <span className={styles.cardLabel}>Current Position</span>
                <span
                  className={styles.cardValue}
                  style={{ color: getPositionColor(currentPos) }}
                >
                  {currentPos !== null ? Math.round(currentPos) : '--'}
                </span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.cardLabel}>Change</span>
                <span
                  className={styles.cardValue}
                  style={{
                    color:
                      change === null
                        ? 'var(--text-tertiary)'
                        : change > 0
                        ? '#22c55e'
                        : change < 0
                        ? '#ef4444'
                        : 'var(--text-tertiary)',
                  }}
                >
                  {change === null
                    ? '--'
                    : change > 0
                    ? `+${change.toFixed(1)}`
                    : change.toFixed(1)}
                </span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.cardLabel}>Search Volume</span>
                <span className={styles.cardValue}>{formatVolume(data.searchVolume)}</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.cardLabel}>Best / Worst</span>
                <span className={styles.cardValue}>
                  {bestPos !== null ? Math.round(bestPos) : '--'}
                  {' / '}
                  {worstPos !== null ? Math.round(worstPos) : '--'}
                </span>
              </div>
            </div>

            {/* Position Trend Chart */}
            {trendData.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Position Trend (90 days)</h2>
                <div className={styles.trendChart}>
                  {trendData.map((point: RankingHistoryEntry, i: number) => {
                    // Invert: position 1 = tallest bar, position 100 = shortest
                    const pos = point.position;
                    const height =
                      pos !== null ? Math.max(100 - pos, 5) : 0;
                    return (
                      <div
                        key={i}
                        className={styles.trendBar}
                        style={{
                          height: `${height}%`,
                          backgroundColor: getPositionColor(pos),
                          opacity: pos === null ? 0.15 : 0.8,
                        }}
                        title={`${point.date.split('T')[0]}: ${pos !== null ? `#${Math.round(pos)}` : 'Not ranking'}`}
                      />
                    );
                  })}
                </div>
                <div className={styles.trendLabels}>
                  <span>Position 100</span>
                  <span>Position 1</span>
                </div>
              </div>
            )}

            {/* History Table */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Ranking History</h2>
              {history.length > 0 ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Position</th>
                        <th>Change</th>
                        <th>Ranking URL</th>
                        <th>SERP Features</th>
                        <th>Clicks</th>
                        <th>Impressions</th>
                        <th>CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h: RankingHistoryEntry, idx: number) => {
                        const prev = history[idx + 1];
                        let rowChange: number | null = null;
                        if (h.position !== null && prev?.position !== null) {
                          rowChange = (prev?.position ?? 0) - h.position;
                        }
                        return (
                          <tr key={h.id}>
                            <td>{new Date(h.date).toLocaleDateString()}</td>
                            <td>
                              <span
                                className={styles.posBadge}
                                style={{ backgroundColor: getPositionColor(h.position) }}
                              >
                                {h.position !== null ? Math.round(h.position) : '--'}
                              </span>
                            </td>
                            <td>
                              {rowChange === null ? (
                                <span className={styles.muted}>--</span>
                              ) : (
                                <span
                                  style={{
                                    color: rowChange > 0 ? '#22c55e' : rowChange < 0 ? '#ef4444' : 'var(--text-tertiary)',
                                    fontWeight: 600,
                                  }}
                                >
                                  {rowChange > 0 ? `+${rowChange.toFixed(1)}` : rowChange.toFixed(1)}
                                </span>
                              )}
                            </td>
                            <td className={styles.urlCell}>
                              {h.rankingUrl || <span className={styles.muted}>--</span>}
                            </td>
                            <td>
                              {h.serpFeatures ? (
                                <div className={styles.featureList}>
                                  {h.serpFeatures.split(',').filter(Boolean).map((f, fi) => (
                                    <span key={fi} className={styles.featureBadge}>
                                      {f.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className={styles.muted}>--</span>
                              )}
                            </td>
                            <td>{h.clicks}</td>
                            <td>{h.impressions.toLocaleString()}</td>
                            <td>{(h.ctr * 100).toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.muted}>No ranking data yet. Run a position check first.</p>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default function KeywordDetailPage() {
  return (
    <AuthGuard>
      <KeywordDetailContent />
    </AuthGuard>
  );
}
