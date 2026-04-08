import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/Dialog';
import { AiInsights } from '@/components/ui/AiInsights';
import { NextStepBar } from '@/components/ui/NextStepBar';
import { SuggestCompetitors } from '@/components/ui/SuggestCompetitors';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject, useCompetitors } from '@/hooks/useProjects';
import { useCompareDomains } from '@/hooks/useCompareDomains';
import styles from '../../../compare-domains/index.module.css';

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });

const DOMAIN_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6'];
function formatVolume(v: number | null | undefined): string { if (v === null || v === undefined) return '--'; if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`; if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`; return String(v); }
function formatCurrency(v: number | null | undefined): string { if (v === null || v === undefined) return '--'; if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`; if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`; return `$${v.toFixed(0)}`; }
function getPositionColor(pos: number | null): string { if (pos === null) return 'var(--text-tertiary)'; if (pos <= 3) return '#22c55e'; if (pos <= 10) return '#34d399'; if (pos <= 20) return '#eab308'; if (pos <= 50) return '#f97316'; return '#ef4444'; }

const METRIC_ROWS = [
  { key: 'authorityScore', label: 'Authority Score', format: (v: number) => String(v) },
  { key: 'organicKeywords', label: 'Organic Keywords', format: formatVolume },
  { key: 'organicTraffic', label: 'Organic Traffic', format: formatVolume },
  { key: 'organicTrafficCost', label: 'Traffic Cost', format: formatCurrency },
  { key: 'backlinks', label: 'Backlinks', format: formatVolume },
  { key: 'referringDomains', label: 'Referring Domains', format: formatVolume },
] as const;

function ProjectCompareDomainsContent() {
  const router = useRouter();
  const id = router.query.id as string;
  const { data: project } = useProject(id);
  const { data: competitors } = useCompetitors(id);
  const [showGuide, setShowGuide] = useState(false);
  const [activeQuery, setActiveQuery] = useState('');
  const [autoTriggered, setAutoTriggered] = useState(false);

  const { data, isLoading, error } = useCompareDomains(activeQuery, 'AU');

  // Auto-trigger when project + competitors load
  useEffect(() => {
    if (project && competitors && competitors.length > 0 && !autoTriggered) {
      const domains = [project.domain, ...competitors.map((c) => c.domain)].slice(0, 5);
      setActiveQuery(domains.join(','));
      setAutoTriggered(true);
    }
  }, [project, competitors, autoTriggered]);

  const trendData = (() => {
    if (!data?.domains?.length) return [];
    const dateMap: Record<string, Record<string, number>> = {};
    data.domains.forEach((dm) => { (dm.trafficTrend || []).forEach((t) => { if (!dateMap[t.date]) dateMap[t.date] = {}; dateMap[t.date][dm.domain] = t.traffic; }); });
    return Object.entries(dateMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, vals]) => ({ date, ...vals }));
  })();

  if (!project) return <div className={styles.layout}><Sidebar projectId={id} /><div className={sidebarStyles.contentWithSidebar}><main className={styles.main}><div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>Loading project...</div></main></div></div>;

  return (
    <div className={styles.layout}>
      <Head><title>Compare Domains — {project.name}</title></Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>Compare Domains</h1>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>{project.domain} vs {competitors?.length || 0} competitors</span>
            <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Guide">?</button>
          </div>
          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Compare Domains — Guide">
            <h4>What is this?</h4>
            <p>Compares your project domain ({project.domain}) against your project competitors side-by-side. Add competitors in Project Overview to see them here.</p>
          </GuideModal>

          {(!competitors || competitors.length === 0) && !isLoading && (
            <div style={{ maxWidth: 500, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--text-tertiary)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', marginBottom: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚖️</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No competitors to compare</div>
                <div style={{ fontSize: 13 }}>Add competitors to see a side-by-side comparison of SEO metrics.</div>
              </div>
              <SuggestCompetitors projectId={id} domain={project.domain} />
            </div>
          )}

          {isLoading && <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>Comparing domains...</div>}
          {error && !isLoading && <div className={styles.errorState}>{(error as any)?.response?.data?.message || 'Failed to compare.'}</div>}

          {data && !isLoading && data.domains.length > 0 && (
            <>
              <AiInsights module="compare-domains" context={{ domains: data.domains.map((d) => d.domain), metrics: data.domains.map((d) => ({ domain: d.domain, authority: d.authorityScore, traffic: d.organicTraffic, keywords: d.organicKeywords })), shared: data.keywordOverlap?.shared }} />

              <div className={styles.comparisonTable}><div className={styles.comparisonTableWrap}>
                <table className={styles.compTable}>
                  <thead><tr><th>Metric</th>{data.domains.map((dm, i) => (<th key={dm.domain}><div className={styles.domainHeader}><span className={styles.colorDot} style={{ backgroundColor: DOMAIN_COLORS[i] }} />{dm.domain}</div></th>))}</tr></thead>
                  <tbody>{METRIC_ROWS.map((row) => {
                    const values = data.domains.map((dm) => (dm as any)[row.key] as number);
                    const maxVal = Math.max(...values);
                    return (<tr key={row.key}><td className={styles.metricLabel}>{row.label}</td>{data.domains.map((dm, i) => { const val = (dm as any)[row.key] as number; return (<td key={dm.domain}><span className={val === maxVal && values.filter((v) => v === maxVal).length === 1 ? styles.metricHighlight : styles.metricValue}>{row.format(val)}</span></td>); })}</tr>);
                  })}</tbody>
                </table>
              </div></div>

              {trendData.length > 0 && (
                <div className={styles.chartSection}><div className={styles.chartTitle}>Traffic Trend</div>
                  <ResponsiveContainer width="100%" height={260}><LineChart data={trendData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={{ stroke: 'var(--border-primary)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatVolume(v)} />
                    <Tooltip formatter={(value: number) => [formatVolume(value), '']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px', fontSize: '12px' }} />
                    {data.domains.map((dm, i) => (<Line key={dm.domain} type="monotone" dataKey={dm.domain} stroke={DOMAIN_COLORS[i]} strokeWidth={2} dot={false} />))}
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </LineChart></ResponsiveContainer>
                </div>
              )}

              {data.keywordOverlap && (
                <div className={styles.overlapGrid}>
                  <div className={styles.overlapCard}><div className={styles.overlapLabel}>Shared Keywords</div><div className={styles.overlapValue}>{formatVolume(data.keywordOverlap.shared)}</div></div>
                  {Object.entries(data.keywordOverlap.unique).map(([domain, count]) => (<div key={domain} className={styles.overlapCard}><div className={styles.overlapLabel}>Unique to {domain}</div><div className={styles.overlapValue}>{formatVolume(count)}</div></div>))}
                  <div className={styles.overlapCard}><div className={styles.overlapLabel}>Total Universe</div><div className={styles.overlapValue}>{formatVolume(data.keywordOverlap.totalUniverse)}</div></div>
                </div>
              )}

              {data.commonKeywords && data.commonKeywords.length > 0 && (
                <div className={styles.tableSection}><div className={styles.tableSectionHeader}><div className={styles.tableSectionTitle}>Top Common Keywords</div></div><div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>Keyword</th><th>Volume</th>{data.domains.map((dm, i) => (<th key={dm.domain} style={{ color: DOMAIN_COLORS[i] }}>{dm.domain}</th>))}</tr></thead>
                    <tbody>{data.commonKeywords.map((kw, i) => (<tr key={i}><td style={{ fontWeight: 500 }}>{kw.keyword}</td><td>{formatVolume(kw.volume)}</td>{data.domains.map((dm) => { const pos = kw.positions?.[dm.domain]; return (<td key={dm.domain}>{pos ? <span className={styles.positionBadge} style={{ backgroundColor: getPositionColor(pos) }}>{pos}</span> : '--'}</td>); })}</tr>))}</tbody>
                  </table>
                </div></div>
              )}
            </>
          )}
          <NextStepBar projectId={id} currentStep={8} />
        </main>
      </div>
    </div>
  );
}

export default function ProjectCompareDomainsPage() {
  return <AuthGuard><ProjectCompareDomainsContent /></AuthGuard>;
}
