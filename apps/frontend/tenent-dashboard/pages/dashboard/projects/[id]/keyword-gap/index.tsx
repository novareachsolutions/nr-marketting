import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/Dialog';
import { AiInsights } from '@/components/ui/AiInsights';
import { NextStepBar } from '@/components/ui/NextStepBar';
import { SuggestCompetitors } from '@/components/ui/SuggestCompetitors';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject, useCompetitors } from '@/hooks/useProjects';
import { useKeywordGap } from '@/hooks/useKeywordGap';
import type { GapType } from '@/types/keyword-gap';
import styles from '../../../keyword-gap/index.module.css';

function formatVolume(v: number | null | undefined): string { if (v === null || v === undefined) return '--'; if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`; if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`; return String(v); }
function getPositionColor(pos: number | null): string { if (pos === null) return 'var(--text-tertiary)'; if (pos <= 3) return '#22c55e'; if (pos <= 10) return '#34d399'; if (pos <= 20) return '#eab308'; if (pos <= 50) return '#f97316'; return '#ef4444'; }
function getDifficultyColor(d: number): string { if (d < 25) return '#22c55e'; if (d < 50) return '#eab308'; if (d < 75) return '#f97316'; return '#ef4444'; }
const INTENT_COLORS: Record<string, string> = { informational: '#3b82f6', navigational: '#8b5cf6', commercial: '#f59e0b', transactional: '#22c55e' };
const INTENT_LABELS: Record<string, string> = { informational: 'I', navigational: 'N', commercial: 'C', transactional: 'T' };
const DOMAIN_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6'];
const GAP_TYPES: { key: GapType | 'all'; label: string }[] = [{ key: 'all', label: 'All' }, { key: 'shared', label: 'Shared' }, { key: 'missing', label: 'Missing' }, { key: 'weak', label: 'Weak' }, { key: 'strong', label: 'Strong' }, { key: 'untapped', label: 'Untapped' }, { key: 'unique', label: 'Unique' }];
const GAP_STYLES: Record<string, string> = { shared: styles.gapShared, missing: styles.gapMissing, weak: styles.gapWeak, strong: styles.gapStrong, untapped: styles.gapUntapped, unique: styles.gapUnique };

function ProjectKeywordGapContent() {
  const router = useRouter();
  const id = router.query.id as string;
  const { data: project } = useProject(id);
  const { data: competitors } = useCompetitors(id);
  const [showGuide, setShowGuide] = useState(false);
  const [activeQuery, setActiveQuery] = useState('');
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [activeGapType, setActiveGapType] = useState<GapType | 'all'>('all');
  const [kwSearch, setKwSearch] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const { data, isLoading, error } = useKeywordGap(activeQuery, 'AU');

  useEffect(() => {
    if (project && competitors && competitors.length > 0 && !autoTriggered) {
      const domains = [project.domain, ...competitors.map((c) => c.domain)].slice(0, 5);
      setActiveQuery(domains.join(','));
      setAutoTriggered(true);
    }
  }, [project, competitors, autoTriggered]);

  const filtered = useMemo(() => {
    if (!data?.keywords) return [];
    let result = [...data.keywords];
    if (activeGapType !== 'all') result = result.filter((k) => k.gapType === activeGapType);
    if (kwSearch) { const q = kwSearch.toLowerCase(); result = result.filter((k) => k.keyword.toLowerCase().includes(q)); }
    return result;
  }, [data?.keywords, activeGapType, kwSearch]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const getBestPosition = (positions: Record<string, number | null>): number | null => {
    const vals = Object.values(positions).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.min(...vals) : null;
  };

  if (!project) return <div className={styles.layout}><Sidebar projectId={id} /><div className={sidebarStyles.contentWithSidebar}><main className={styles.main}><div className={styles.loadingState}>Loading project...</div></main></div></div>;

  return (
    <div className={styles.layout}>
      <Head><title>Keyword Gap — {project.name}</title></Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>Keyword Gap</h1>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>{project.domain} vs {competitors?.length || 0} competitors</span>
            <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Guide">?</button>
          </div>
          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Keyword Gap — Guide">
            <h4>What is this?</h4>
            <p>Shows which keywords your competitors rank for that {project.domain} doesn't. Uses your project competitors automatically. Add competitors in Project Overview.</p>
            <h4>Gap types</h4>
            <ul>
              <li><strong>Missing</strong> — Competitors rank, you don't. Create content!</li>
              <li><strong>Weak</strong> — You rank lower. Optimize pages.</li>
              <li><strong>Strong</strong> — You rank higher. Protect these.</li>
              <li><strong>Untapped</strong> — At least 1 competitor ranks, you don't.</li>
              <li><strong>Unique</strong> — Only you rank. Your advantage.</li>
            </ul>
          </GuideModal>

          {(!competitors || competitors.length === 0) && !isLoading && (
            <div style={{ maxWidth: 500, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--text-tertiary)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', marginBottom: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔀</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No competitors to analyze</div>
                <div style={{ fontSize: 13 }}>Add competitors to discover keyword gaps and content opportunities.</div>
              </div>
              <SuggestCompetitors projectId={id} domain={project.domain} />
            </div>
          )}

          {isLoading && <div className={styles.loadingState}>Analyzing keyword gap...</div>}
          {error && !isLoading && <div className={styles.errorState}>{(error as any)?.response?.data?.message || 'Failed to analyze.'}</div>}

          {data && !isLoading && (
            <>
              <AiInsights module="keyword-gap" context={{ domains: data.domains, summary: data.summary, topMissing: data.keywords.filter((k) => k.gapType === 'missing').slice(0, 3).map((k) => k.keyword) }} />

              <div className={styles.summaryGrid}>
                {GAP_TYPES.map((gt) => {
                  const count = gt.key === 'all' ? data.summary.totalKeywords : (data.summary as any)[gt.key];
                  return (<div key={gt.key} className={activeGapType === gt.key ? styles.summaryCardActive : styles.summaryCard} onClick={() => { setActiveGapType(gt.key as any); setPage(1); }}><div className={styles.summaryCardLabel}>{gt.label}</div><div className={styles.summaryCardValue}>{formatVolume(count)}</div></div>);
                })}
              </div>

              <div className={styles.filtersRow}>
                <input className={styles.filterInput} type="text" placeholder="Filter keywords..." value={kwSearch} onChange={(e) => { setKwSearch(e.target.value); setPage(1); }} style={{ minWidth: 180 }} />
              </div>

              <div className={styles.tableSection}><div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Keyword</th><th>Volume</th><th>KD</th><th>CPC</th><th>Intent</th>{data.domains.map((dm, i) => (<th key={dm} style={{ color: DOMAIN_COLORS[i] }}>{dm.length > 15 ? dm.slice(0, 15) + '...' : dm}</th>))}<th>Gap</th></tr></thead>
                  <tbody>{paginated.map((kw, i) => {
                    const bestPos = getBestPosition(kw.positions);
                    return (<tr key={i}>
                      <td className={styles.kwCell}>{kw.keyword}</td>
                      <td>{formatVolume(kw.volume)}</td>
                      <td><span className={styles.kdBadge} style={{ backgroundColor: getDifficultyColor(kw.kd) }}>{kw.kd}</span></td>
                      <td>${kw.cpc.toFixed(2)}</td>
                      <td><span className={styles.intentBadge} style={{ backgroundColor: INTENT_COLORS[kw.intent] || '#6b7280' }}>{INTENT_LABELS[kw.intent] || '?'}</span></td>
                      {data.domains.map((dm) => { const pos = kw.positions?.[dm]; const isBest = pos !== null && pos !== undefined && pos === bestPos; return (<td key={dm}>{pos !== null && pos !== undefined ? <span className={isBest ? styles.positionBest : styles.positionBadge} style={{ backgroundColor: getPositionColor(pos) }}>{pos}</span> : <span style={{ color: 'var(--text-tertiary)' }}>--</span>}</td>); })}
                      <td><span className={`${styles.gapBadge} ${GAP_STYLES[kw.gapType] || ''}`}>{kw.gapType}</span></td>
                    </tr>);
                  })}</tbody>
                </table>
              </div>
              {totalPages > 1 && (<div className={styles.pagination}><button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span className={styles.pageInfo}>Page {page} of {totalPages}</span><button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button></div>)}
              </div>
            </>
          )}
          <NextStepBar projectId={id} currentStep={5} />
        </main>
      </div>
    </div>
  );
}

export default function ProjectKeywordGapPage() {
  return <AuthGuard><ProjectKeywordGapContent /></AuthGuard>;
}
