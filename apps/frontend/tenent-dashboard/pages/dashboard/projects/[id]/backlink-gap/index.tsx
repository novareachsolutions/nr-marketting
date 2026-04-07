import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/GuideModal';
import { AiInsights } from '@/components/ui/AiInsights';
import { SuggestCompetitors } from '@/components/ui/SuggestCompetitors';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject, useCompetitors } from '@/hooks/useProjects';
import { useBacklinkGap } from '@/hooks/useBacklinkGap';
import type { BacklinkGapType } from '@/types/backlink-gap';
import styles from '../../../backlink-gap/index.module.css';

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });

const DOMAIN_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6'];
function formatVolume(v: number | null | undefined): string { if (v === null || v === undefined) return '--'; if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`; if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`; return String(v); }
function getAuthorityColor(s: number): string { if (s >= 70) return '#22c55e'; if (s >= 50) return '#eab308'; if (s >= 30) return '#f97316'; return '#ef4444'; }
const GAP_TYPES: { key: BacklinkGapType | 'all'; label: string }[] = [{ key: 'all', label: 'All' }, { key: 'best', label: 'Best' }, { key: 'weak', label: 'Weak' }, { key: 'strong', label: 'Strong' }, { key: 'shared', label: 'Shared' }, { key: 'unique', label: 'Unique' }];
const GAP_STYLES: Record<string, string> = { best: styles.gapBest, weak: styles.gapWeak, strong: styles.gapStrong, shared: styles.gapShared, unique: styles.gapUnique };

function ProjectBacklinkGapContent() {
  const router = useRouter();
  const id = router.query.id as string;
  const { data: project } = useProject(id);
  const { data: competitors } = useCompetitors(id);
  const [showGuide, setShowGuide] = useState(false);
  const [activeQuery, setActiveQuery] = useState('');
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [activeGapType, setActiveGapType] = useState<BacklinkGapType | 'all'>('all');
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const { data, isLoading, error } = useBacklinkGap(activeQuery, 'AU');

  useEffect(() => {
    if (project && competitors && competitors.length > 0 && !autoTriggered) {
      const domains = [project.domain, ...competitors.map((c) => c.domain)].slice(0, 5);
      setActiveQuery(domains.join(','));
      setAutoTriggered(true);
    }
  }, [project, competitors, autoTriggered]);

  const filtered = useMemo(() => {
    if (!data?.referringDomains) return [];
    if (activeGapType === 'all') return data.referringDomains;
    return data.referringDomains.filter((r) => r.gapType === activeGapType);
  }, [data?.referringDomains, activeGapType]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (!project) return <div className={styles.layout}><Sidebar projectId={id} /><div className={sidebarStyles.contentWithSidebar}><main className={styles.main}><div className={styles.loadingState}>Loading project...</div></main></div></div>;

  return (
    <div className={styles.layout}>
      <Head><title>Backlink Gap — {project.name}</title></Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>Backlink Gap</h1>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>{project.domain} vs {competitors?.length || 0} competitors</span>
            <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Guide">?</button>
          </div>
          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Backlink Gap — Guide">
            <h4>What is this?</h4>
            <p>Finds websites that link to your competitors but not to {project.domain}. These are your top link-building targets. Uses project competitors automatically.</p>
            <h4>Gap types</h4>
            <ul>
              <li><strong>Best</strong> — Links to all competitors, not you. Top outreach targets!</li>
              <li><strong>Weak</strong> — Links to you less than competitors.</li>
              <li><strong>Strong</strong> — Links to you, not competitors.</li>
              <li><strong>Shared</strong> — Links to you and competitors.</li>
              <li><strong>Unique</strong> — Links to only one domain.</li>
            </ul>
          </GuideModal>

          {(!competitors || competitors.length === 0) && !isLoading && (
            <div style={{ maxWidth: 500, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--text-tertiary)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', marginBottom: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No competitors to analyze</div>
                <div style={{ fontSize: 13 }}>Add competitors to find link-building opportunities they have that you don't.</div>
              </div>
              <SuggestCompetitors projectId={id} domain={project.domain} />
            </div>
          )}

          {isLoading && <div className={styles.loadingState}>Analyzing backlink gap...</div>}
          {error && !isLoading && <div className={styles.errorState}>{(error as any)?.response?.data?.message || 'Failed to analyze.'}</div>}

          {data && !isLoading && (
            <>
              <AiInsights module="backlink-gap" context={{ domains: data.domains, summary: data.summary, topProspects: data.referringDomains.filter((r) => r.gapType === 'best').slice(0, 3).map((r) => ({ domain: r.domain, authority: r.authorityScore })) }} />

              <div className={styles.summaryGrid}>
                {GAP_TYPES.map((gt) => {
                  const count = gt.key === 'all' ? data.summary.totalReferringDomains : (data.summary as any)[gt.key];
                  return (<div key={gt.key} className={activeGapType === gt.key ? styles.summaryCardActive : styles.summaryCard} onClick={() => { setActiveGapType(gt.key as any); setPage(1); }}><div className={styles.summaryCardLabel}>{gt.label}</div><div className={styles.summaryCardValue}>{formatVolume(count)}</div></div>);
                })}
              </div>

              {data.backlinkTrend && data.backlinkTrend.length > 0 && (
                <div className={styles.chartSection}><div className={styles.chartTitle}>Backlink Growth Trend</div>
                  <ResponsiveContainer width="100%" height={260}><LineChart data={data.backlinkTrend}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={{ stroke: 'var(--border-primary)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatVolume(v)} />
                    <Tooltip formatter={(value: number) => [formatVolume(value), '']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px', fontSize: '12px' }} />
                    {data.domains.map((dm, i) => (<Line key={dm} type="monotone" dataKey={dm} stroke={DOMAIN_COLORS[i]} strokeWidth={2} dot={false} />))}
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </LineChart></ResponsiveContainer>
                </div>
              )}

              <div className={styles.gapTabs}>
                {GAP_TYPES.map((gt) => {
                  const count = gt.key === 'all' ? data.referringDomains.length : data.referringDomains.filter((r) => r.gapType === gt.key).length;
                  return (<button key={gt.key} className={activeGapType === gt.key ? styles.gapTabActive : styles.gapTab} onClick={() => { setActiveGapType(gt.key as any); setPage(1); }}>{gt.label} <span className={styles.gapTabCount}>{count}</span></button>);
                })}
              </div>

              <div className={styles.tableSection}><div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Referring Domain</th><th>Authority</th><th>Monthly Visits</th><th>Matches</th>{data.domains.map((dm, i) => (<th key={dm} style={{ color: DOMAIN_COLORS[i] }}>{dm.length > 15 ? dm.slice(0, 15) + '...' : dm}</th>))}<th>Gap</th></tr></thead>
                  <tbody>{paginated.map((rd, i) => {
                    const maxBl = Math.max(...Object.values(rd.backlinksPerDomain || {}));
                    return (<tr key={i}>
                      <td className={styles.domainCell}>{rd.domain}</td>
                      <td><span className={styles.authorityBadge} style={{ backgroundColor: getAuthorityColor(rd.authorityScore) }}>{rd.authorityScore}</span></td>
                      <td>{formatVolume(rd.monthlyVisits)}</td>
                      <td>{rd.matches}/{data.domains.length}</td>
                      {data.domains.map((dm) => { const bl = rd.backlinksPerDomain?.[dm] || 0; return (<td key={dm}>{bl > 0 ? <span className={bl === maxBl ? styles.blCountBest : undefined}>{formatVolume(bl)}</span> : '--'}</td>); })}
                      <td><span className={`${styles.gapBadge} ${GAP_STYLES[rd.gapType] || ''}`}>{rd.gapType}</span></td>
                    </tr>);
                  })}</tbody>
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

export default function ProjectBacklinkGapPage() {
  return <AuthGuard><ProjectBacklinkGapContent /></AuthGuard>;
}
