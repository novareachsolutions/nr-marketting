import { useState, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/Dialog';
import { AiInsights } from '@/components/ui/AiInsights';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject } from '@/hooks/useProjects';
import { useTopPages } from '@/hooks/useTopPages';
import type { TopPage } from '@/types/top-pages';
import styles from '../../../top-pages/index.module.css';

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then((m) => m.Area), { ssr: false });

function formatVolume(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}
function getPositionColor(pos: number | null): string {
  if (pos === null) return 'var(--text-tertiary)';
  if (pos <= 3) return '#22c55e'; if (pos <= 10) return '#34d399'; if (pos <= 20) return '#eab308'; if (pos <= 50) return '#f97316'; return '#ef4444';
}

type SortCol = keyof TopPage;

function ProjectTopPagesContent() {
  const router = useRouter();
  const id = router.query.id as string;
  const { data: project } = useProject(id);
  const [showGuide, setShowGuide] = useState(false);
  const [urlFilter, setUrlFilter] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('traffic');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const domain = project?.domain || '';
  const { data, isLoading, error } = useTopPages(domain, 'AU');

  const filtered = useMemo(() => {
    if (!data?.pages) return [];
    let result = [...data.pages];
    if (urlFilter) { const q = urlFilter.toLowerCase(); result = result.filter((p) => p.url.toLowerCase().includes(q)); }
    result.sort((a, b) => { const av = a[sortCol] ?? 0; const bv = b[sortCol] ?? 0; if (av < bv) return sortOrder === 'asc' ? -1 : 1; if (av > bv) return sortOrder === 'asc' ? 1 : -1; return 0; });
    return result;
  }, [data?.pages, urlFilter, sortCol, sortOrder]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleSort = (col: SortCol) => { if (sortCol === col) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); else { setSortCol(col); setSortOrder('desc'); } setPage(1); };
  const renderSortArrow = (col: SortCol) => sortCol !== col ? null : <span className={styles.sortArrow}>{sortOrder === 'asc' ? '▲' : '▼'}</span>;

  if (!project) return <div className={styles.layout}><Sidebar projectId={id} /><div className={sidebarStyles.contentWithSidebar}><main className={styles.main}><div className={styles.loadingState}>Loading project...</div></main></div></div>;

  return (
    <div className={styles.layout}>
      <Head><title>Top Pages — {project.name}</title></Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>Top Pages</h1>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>{project.domain}</span>
            <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Guide">?</button>
          </div>
          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Top Pages — Guide">
            <h4>What is this?</h4>
            <p>Shows the top-performing pages on {project.domain} ranked by organic traffic, with keywords, backlinks, and trend sparklines.</p>
          </GuideModal>

          {isLoading && <div className={styles.loadingState}>Analyzing {project.domain}...</div>}
          {error && !isLoading && <div className={styles.errorState}>{(error as any)?.response?.data?.message || 'Failed to analyze.'}</div>}

          {data && !isLoading && (
            <>
              <AiInsights module="top-pages" context={{ domain: data.domain, totalPages: data.summary.totalPages, totalTraffic: data.summary.totalOrganicTraffic, avgKeywords: data.summary.avgKeywordsPerPage }} />

              <div className={styles.summaryBar}>
                <div className={styles.summaryCard}><div className={styles.summaryLabel}>Total Pages</div><div className={styles.summaryValue}>{formatVolume(data.summary.totalPages)}</div></div>
                <div className={styles.summaryCard}><div className={styles.summaryLabel}>Organic Traffic</div><div className={styles.summaryValue}>{formatVolume(data.summary.totalOrganicTraffic)}</div></div>
                <div className={styles.summaryCard}><div className={styles.summaryLabel}>Avg Keywords / Page</div><div className={styles.summaryValue}>{formatVolume(data.summary.avgKeywordsPerPage)}</div></div>
              </div>

              <div className={styles.filtersRow}>
                <input className={styles.filterInput} type="text" placeholder="Filter by URL..." value={urlFilter} onChange={(e) => { setUrlFilter(e.target.value); setPage(1); }} style={{ minWidth: 200 }} />
              </div>

              <div className={styles.tableSection}><div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>#</th><th onClick={() => handleSort('url')}>URL{renderSortArrow('url')}</th><th onClick={() => handleSort('traffic')}>Traffic{renderSortArrow('traffic')}</th><th onClick={() => handleSort('trafficPercent')}>Traffic %{renderSortArrow('trafficPercent')}</th><th onClick={() => handleSort('keywords')}>Keywords{renderSortArrow('keywords')}</th><th>Top Keyword</th><th onClick={() => handleSort('backlinks')}>Backlinks{renderSortArrow('backlinks')}</th><th>Trend</th></tr></thead>
                  <tbody>{paginated.map((p, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{(page - 1) * PER_PAGE + i + 1}</td>
                      <td className={styles.urlCell} title={p.url}>{p.url}</td>
                      <td>{formatVolume(p.traffic)}</td>
                      <td><div className={styles.trafficBarWrap}><div className={styles.trafficBar}><div className={styles.trafficBarFill} style={{ width: `${Math.min(100, p.trafficPercent * 4)}%` }} /></div><span className={styles.trafficBarLabel}>{p.trafficPercent}%</span></div></td>
                      <td>{formatVolume(p.keywords)}</td>
                      <td><span className={styles.kwCell}>{p.topKeyword}</span><span className={styles.positionBadge} style={{ backgroundColor: getPositionColor(p.topKeywordPosition) }}>{p.topKeywordPosition}</span></td>
                      <td>{formatVolume(p.backlinks)}</td>
                      <td className={styles.sparklineCell}>{p.trafficTrend && p.trafficTrend.length > 0 && (<ResponsiveContainer width={60} height={24}><AreaChart data={p.trafficTrend.map((v, j) => ({ v, i: j }))}><Area type="monotone" dataKey="v" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={1.5} dot={false} /></AreaChart></ResponsiveContainer>)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {totalPages > 1 && (<div className={styles.pagination}><button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span className={styles.pageInfo}>Page {page} of {totalPages}</span><button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button></div>)}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ProjectTopPagesPage() {
  return <AuthGuard><ProjectTopPagesContent /></AuthGuard>;
}
