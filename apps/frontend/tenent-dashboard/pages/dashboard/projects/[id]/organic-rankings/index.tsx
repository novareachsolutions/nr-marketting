import { useState, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/GuideModal';
import { AiInsights } from '@/components/ui/AiInsights';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject } from '@/hooks/useProjects';
import { useOrganicRankings } from '@/hooks/useOrganicRankings';
import type { OrganicRankingPosition } from '@/types/organic-rankings';
import styles from '../../../organic-rankings/index.module.css';

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });
const ScatterChart = dynamic(() => import('recharts').then((m) => m.ScatterChart), { ssr: false });
const Scatter = dynamic(() => import('recharts').then((m) => m.Scatter), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const ZAxis = dynamic(() => import('recharts').then((m) => m.ZAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });

function formatVolume(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}
function formatCurrency(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
function getPositionColor(pos: number | null): string {
  if (pos === null) return 'var(--text-tertiary)';
  if (pos <= 3) return '#22c55e'; if (pos <= 10) return '#34d399'; if (pos <= 20) return '#eab308'; if (pos <= 50) return '#f97316'; return '#ef4444';
}
function getDifficultyColor(d: number | null): string {
  if (d === null) return 'var(--text-tertiary)';
  if (d < 25) return '#22c55e'; if (d < 50) return '#eab308'; if (d < 75) return '#f97316'; return '#ef4444';
}
const INTENT_COLORS: Record<string, string> = { informational: '#3b82f6', navigational: '#8b5cf6', commercial: '#f59e0b', transactional: '#22c55e' };
const INTENT_LABELS: Record<string, string> = { informational: 'I', navigational: 'N', commercial: 'C', transactional: 'T' };
const SERP_ABBREV: Record<string, string> = { featured_snippet: 'FS', sitelinks: 'SL', people_also_ask: 'PAA', image_pack: 'IMG', video: 'VID', knowledge_panel: 'KP', local_pack: 'LP', reviews: 'REV', top_stories: 'TS', shopping: 'SHOP' };

type TabType = 'positions' | 'changes' | 'competitors' | 'pages';

function ProjectOrganicRankingsContent() {
  const router = useRouter();
  const id = router.query.id as string;
  const { data: project } = useProject(id);
  const [showGuide, setShowGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('positions');
  const [posSearch, setPosSearch] = useState('');
  const [posIntent, setPosIntent] = useState('');
  const [posSort, setPosSort] = useState<keyof OrganicRankingPosition>('trafficPercent');
  const [posSortOrder, setPosSortOrder] = useState<'asc' | 'desc'>('desc');
  const [posPage, setPosPage] = useState(1);
  const [changeTypeFilter, setChangeTypeFilter] = useState('');

  const domain = project?.domain || '';
  const { data, isLoading, error } = useOrganicRankings(domain, 'AU');

  const PER_PAGE = 25;
  const filteredPositions = useMemo(() => {
    if (!data?.positions) return [];
    let result = [...data.positions];
    if (posSearch) { const q = posSearch.toLowerCase(); result = result.filter((p) => p.keyword.toLowerCase().includes(q)); }
    if (posIntent) result = result.filter((p) => p.intent === posIntent);
    result.sort((a, b) => { const av = a[posSort] ?? 0; const bv = b[posSort] ?? 0; if (av < bv) return posSortOrder === 'asc' ? -1 : 1; if (av > bv) return posSortOrder === 'asc' ? 1 : -1; return 0; });
    return result;
  }, [data?.positions, posSearch, posIntent, posSort, posSortOrder]);
  const totalPosPages = Math.ceil(filteredPositions.length / PER_PAGE);
  const paginatedPositions = filteredPositions.slice((posPage - 1) * PER_PAGE, posPage * PER_PAGE);
  const filteredChanges = useMemo(() => {
    if (!data?.positionChanges) return [];
    if (!changeTypeFilter) return data.positionChanges;
    return data.positionChanges.filter((c) => c.changeType === changeTypeFilter);
  }, [data?.positionChanges, changeTypeFilter]);

  const handleSort = (col: keyof OrganicRankingPosition) => {
    if (posSort === col) setPosSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setPosSort(col); setPosSortOrder('desc'); }
    setPosPage(1);
  };
  const renderSortArrow = (col: keyof OrganicRankingPosition) => posSort !== col ? null : <span className={styles.sortArrow}>{posSortOrder === 'asc' ? '▲' : '▼'}</span>;

  if (!project) return <div className={styles.layout}><Sidebar projectId={id} /><div className={sidebarStyles.contentWithSidebar}><main className={styles.main}><div className={styles.loadingState}>Loading project...</div></main></div></div>;

  return (
    <div className={styles.layout}>
      <Head><title>Organic Rankings — {project.name}</title></Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>Organic Rankings</h1>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>{project.domain}</span>
            <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Guide">?</button>
          </div>
          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Organic Rankings — Guide">
            <h4>What is this?</h4>
            <p>Shows all keywords your project domain ({project.domain}) ranks for — positions, changes, competitors, and top pages.</p>
          </GuideModal>

          {isLoading && <div className={styles.loadingState}>Analyzing {project.domain}...</div>}
          {error && !isLoading && <div className={styles.errorState}>{(error as any)?.response?.data?.message || 'Failed to analyze.'}</div>}

          {data && !isLoading && (
            <>
              <AiInsights module="organic-rankings" context={{ domain: data.domain, totalKeywords: data.summary.totalOrganicKeywords, traffic: data.summary.organicMonthlyTraffic, positionsCount: data.positions.length, changesCount: data.positionChanges.length }} />

              <div className={styles.summaryBar}>
                <div className={styles.summaryCard}><div className={styles.summaryLabel}>Organic Keywords</div><div className={styles.summaryValue}>{formatVolume(data.summary.totalOrganicKeywords)}</div></div>
                <div className={styles.summaryCard}><div className={styles.summaryLabel}>Monthly Traffic</div><div className={styles.summaryValue}>{formatVolume(data.summary.organicMonthlyTraffic)}</div></div>
                <div className={styles.summaryCard}><div className={styles.summaryLabel}>Traffic Cost</div><div className={styles.summaryValue}>{formatCurrency(data.summary.organicTrafficCost)}</div></div>
                <div className={styles.summaryCard}><div className={styles.summaryLabel}>Non-Branded</div><div className={styles.summaryValue}>{data.summary.nonBrandedTrafficPercent}%</div></div>
              </div>

              <div className={styles.tabsRow}>
                {(['positions', 'changes', 'competitors', 'pages'] as TabType[]).map((tab) => (
                  <button key={tab} className={activeTab === tab ? styles.tabActive : styles.tab} onClick={() => setActiveTab(tab)}>
                    {tab === 'positions' ? `Positions (${data.positions.length})` : tab === 'changes' ? `Changes (${data.positionChanges.length})` : tab === 'competitors' ? `Competitors (${data.competitors.length})` : `Pages (${data.pages.length})`}
                  </button>
                ))}
              </div>

              {activeTab === 'positions' && (
                <>
                  <div className={styles.filtersRow}>
                    <input className={styles.filterInput} type="text" placeholder="Filter keywords..." value={posSearch} onChange={(e) => { setPosSearch(e.target.value); setPosPage(1); }} style={{ minWidth: 180 }} />
                    <select className={styles.filterSelect} value={posIntent} onChange={(e) => { setPosIntent(e.target.value); setPosPage(1); }}>
                      <option value="">All Intents</option><option value="informational">Informational</option><option value="navigational">Navigational</option><option value="commercial">Commercial</option><option value="transactional">Transactional</option>
                    </select>
                  </div>
                  <div className={styles.tableSection}><div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>#</th><th onClick={() => handleSort('keyword')}>Keyword{renderSortArrow('keyword')}</th><th onClick={() => handleSort('position')}>Pos{renderSortArrow('position')}</th><th onClick={() => handleSort('volume')}>Volume{renderSortArrow('volume')}</th><th onClick={() => handleSort('trafficPercent')}>Traffic %{renderSortArrow('trafficPercent')}</th><th>URL</th><th>Intent</th><th onClick={() => handleSort('kd')}>KD{renderSortArrow('kd')}</th></tr></thead>
                      <tbody>{paginatedPositions.map((p, i) => (
                        <tr key={i}><td style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{(posPage - 1) * PER_PAGE + i + 1}</td><td className={styles.kwCell}>{p.keyword}</td><td><span className={styles.positionBadge} style={{ backgroundColor: getPositionColor(p.position) }}>{p.position}</span></td><td>{formatVolume(p.volume)}</td><td>{p.trafficPercent}%</td><td className={styles.urlCell}>{p.url}</td><td><span className={styles.intentBadge} style={{ backgroundColor: INTENT_COLORS[p.intent] || '#6b7280' }}>{INTENT_LABELS[p.intent] || '?'}</span></td><td><span className={styles.kdBadge} style={{ backgroundColor: getDifficultyColor(p.kd) }}>{p.kd}</span></td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                  {totalPosPages > 1 && (<div className={styles.pagination}><button className={styles.pageBtn} disabled={posPage <= 1} onClick={() => setPosPage((p) => p - 1)}>Previous</button><span className={styles.pageInfo}>Page {posPage} of {totalPosPages}</span><button className={styles.pageBtn} disabled={posPage >= totalPosPages} onClick={() => setPosPage((p) => p + 1)}>Next</button></div>)}
                  </div>
                </>
              )}

              {activeTab === 'changes' && (
                <>
                  <div className={styles.filtersRow}><select className={styles.filterSelect} value={changeTypeFilter} onChange={(e) => setChangeTypeFilter(e.target.value)}><option value="">All Changes</option><option value="improved">Improved</option><option value="declined">Declined</option><option value="new">New</option><option value="lost">Lost</option></select></div>
                  <div className={styles.tableSection}><div className={styles.tableWrap}><table className={styles.table}>
                    <thead><tr><th>Keyword</th><th>Type</th><th>Position</th><th>Change</th><th>Volume</th><th>Traffic Impact</th></tr></thead>
                    <tbody>{filteredChanges.map((c, i) => (
                      <tr key={i}><td className={styles.kwCell}>{c.keyword}</td><td><span className={`${styles.changeBadge} ${c.changeType === 'improved' ? styles.changeImproved : c.changeType === 'declined' ? styles.changeDeclined : c.changeType === 'new' ? styles.changeNew : styles.changeLost}`}>{c.changeType.toUpperCase()}</span></td><td><span className={styles.posArrow}>{c.oldPosition ?? '--'} <span>→</span> {c.newPosition ?? '--'}</span></td><td>{c.change !== 0 ? <span className={`${styles.changeValue} ${c.change > 0 ? styles.changePositive : styles.changeNegative}`}>{c.change > 0 ? `+${c.change}` : c.change}</span> : '--'}</td><td>{formatVolume(c.volume)}</td><td><span className={`${styles.changeValue} ${c.trafficImpact >= 0 ? styles.changePositive : styles.changeNegative}`}>{c.trafficImpact >= 0 ? '+' : ''}{formatVolume(c.trafficImpact)}</span></td></tr>
                    ))}</tbody>
                  </table></div></div>
                </>
              )}

              {activeTab === 'competitors' && (
                <div className={styles.tableSection}><div className={styles.tableWrap}><table className={styles.table}>
                  <thead><tr><th>Domain</th><th>Common Keywords</th><th>SE Keywords</th><th>SE Traffic</th><th>Traffic Cost</th></tr></thead>
                  <tbody>{data.competitors.map((comp, i) => (
                    <tr key={i}><td className={styles.kwCell}>{comp.domain}</td><td>{formatVolume(comp.commonKeywords)}</td><td>{formatVolume(comp.seKeywords)}</td><td>{formatVolume(comp.seTraffic)}</td><td>{formatCurrency(comp.trafficCost)}</td></tr>
                  ))}</tbody>
                </table></div></div>
              )}

              {activeTab === 'pages' && (
                <div className={styles.tableSection}><div className={styles.tableWrap}><table className={styles.table}>
                  <thead><tr><th>URL</th><th>Traffic %</th><th>Keywords</th><th>Traffic</th></tr></thead>
                  <tbody>{data.pages.map((page, i) => (
                    <tr key={i}><td className={styles.urlCell}>{page.url}</td><td>{page.trafficPercent}%</td><td>{formatVolume(page.keywords)}</td><td>{formatVolume(page.traffic)}</td></tr>
                  ))}</tbody>
                </table></div></div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ProjectOrganicRankingsPage() {
  return <AuthGuard><ProjectOrganicRankingsContent /></AuthGuard>;
}
