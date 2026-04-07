import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/GuideModal';
import { AiInsights } from '@/components/ui/AiInsights';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject } from '@/hooks/useProjects';
import { useDomainOverview } from '@/hooks/useDomainOverview';
import styles from '../../../domain-overview/index.module.css';

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const PieChart = dynamic(() => import('recharts').then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), { ssr: false });
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });

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

function getAuthorityColor(score: number | null): string {
  if (score === null) return 'var(--text-tertiary)';
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

function getPositionColor(label: string): string {
  const colors: Record<string, string> = { 'Top 3': '#22c55e', '4-10': '#34d399', '11-20': '#eab308', '21-50': '#f97316', '51-100': '#ef4444' };
  return colors[label] || '#6366f1';
}

const INTENT_COLORS: Record<string, string> = { informational: '#3b82f6', navigational: '#8b5cf6', commercial: '#f59e0b', transactional: '#22c55e' };

function AuthorityGauge({ score }: { score: number | null }) {
  const displayScore = score ?? 0;
  const color = getAuthorityColor(score);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = (displayScore / 100) * circumference;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className={styles.authorityGauge}>
      <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border-primary)" strokeWidth="6" />
      <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" transform="rotate(-90 50 50)" />
      <text x="50" y="48" textAnchor="middle" fill="var(--text-primary)" fontSize="22" fontWeight="700">{score !== null ? score : '--'}</text>
      <text x="50" y="62" textAnchor="middle" fill="var(--text-tertiary)" fontSize="8" fontWeight="500">AUTHORITY</text>
    </svg>
  );
}

function ProjectDomainOverviewContent() {
  const router = useRouter();
  const id = router.query.id as string;
  const { data: project } = useProject(id);
  const [showGuide, setShowGuide] = useState(false);

  const domain = project?.domain || '';
  const { data, isLoading, error } = useDomainOverview(domain, 'AU');

  if (!project) return <div className={styles.layout}><Sidebar projectId={id} /><div className={sidebarStyles.contentWithSidebar}><main className={styles.main}><div className={styles.loadingState}>Loading project...</div></main></div></div>;

  return (
    <div className={styles.layout}>
      <Head><title>Domain Overview — {project.name}</title></Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>Domain Overview</h1>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>{project.domain}</span>
            <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Guide">?</button>
          </div>

          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Domain Overview — Guide">
            <h4>What is this?</h4>
            <p>Automatically analyzes your project domain ({project.domain}) showing authority score, organic/paid traffic, backlinks, keyword distributions, top pages, competitors, and country distribution.</p>
            <h4>Key metrics</h4>
            <ul>
              <li><strong>Authority Score (0-100)</strong> — Overall domain quality.</li>
              <li><strong>Organic Traffic</strong> — Estimated monthly visitors from organic search.</li>
              <li><strong>Traffic Cost</strong> — Dollar value of organic traffic.</li>
              <li><strong>Backlinks</strong> — Total links pointing to the domain.</li>
            </ul>
          </GuideModal>

          {isLoading && <div className={styles.loadingState}>Analyzing {project.domain}...</div>}
          {error && !isLoading && <div className={styles.errorState}>{(error as any)?.response?.data?.message || 'Failed to analyze domain.'}</div>}

          {data && !isLoading && (
            <>
              <AiInsights module="domain-overview" context={{ domain: data.domain, authorityScore: data.authorityScore, organicKeywords: data.organicKeywords, organicTraffic: data.organicTraffic, totalBacklinks: data.totalBacklinks, referringDomains: data.referringDomains }} />

              <div className={styles.authoritySection}>
                <AuthorityGauge score={data.authorityScore} />
                <div className={styles.authorityInfo}>
                  <div className={styles.authorityLabel}>Domain Authority</div>
                  <div className={styles.authorityDomain}>{data.domain}</div>
                </div>
              </div>

              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                  <div className={styles.metricCardTitle}>Organic Search</div>
                  <div className={styles.metricRow}><span className={styles.metricLabel}>Keywords</span><span className={styles.metricValueLg}>{formatVolume(data.organicKeywords)}</span></div>
                  <div className={styles.metricRow}><span className={styles.metricLabel}>Traffic</span><span className={styles.metricValue}>{formatVolume(data.organicTraffic)}</span></div>
                  <div className={styles.metricRow}><span className={styles.metricLabel}>Traffic Cost</span><span className={styles.metricValue}>{formatCurrency(data.organicTrafficCost)}</span></div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricCardTitle}>Paid Search</div>
                  <div className={styles.metricRow}><span className={styles.metricLabel}>Keywords</span><span className={styles.metricValueLg}>{formatVolume(data.paidKeywords)}</span></div>
                  <div className={styles.metricRow}><span className={styles.metricLabel}>Traffic</span><span className={styles.metricValue}>{formatVolume(data.paidTraffic)}</span></div>
                  <div className={styles.metricRow}><span className={styles.metricLabel}>Traffic Cost</span><span className={styles.metricValue}>{formatCurrency(data.paidTrafficCost)}</span></div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricCardTitle}>Backlinks</div>
                  <div className={styles.metricRow}><span className={styles.metricLabel}>Total</span><span className={styles.metricValueLg}>{formatVolume(data.totalBacklinks)}</span></div>
                  <div className={styles.metricRow}><span className={styles.metricLabel}>Referring Domains</span><span className={styles.metricValue}>{formatVolume(data.referringDomains)}</span></div>
                </div>
              </div>

              {data.organicTrafficTrend && data.organicTrafficTrend.length > 0 && (
                <div className={styles.chartSection}>
                  <div className={styles.chartTitle}>Organic Traffic Trend</div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data.organicTrafficTrend}>
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={{ stroke: 'var(--border-primary)' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatVolume(v)} />
                      <Tooltip formatter={(value: number) => [formatVolume(value), 'Traffic']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="traffic" stroke="#6366f1" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {data.topOrganicKeywords && data.topOrganicKeywords.length > 0 && (
                <div className={styles.tableSection}>
                  <div className={styles.tableSectionHeader}><div className={styles.tableSectionTitle}>Top Organic Keywords</div></div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>Keyword</th><th>Position</th><th>Volume</th><th>Traffic %</th><th>URL</th></tr></thead>
                      <tbody>
                        {data.topOrganicKeywords.map((kw, i) => (
                          <tr key={i}>
                            <td className={styles.kwCell}>{kw.keyword}</td>
                            <td><span className={styles.positionBadge} style={{ backgroundColor: kw.position <= 3 ? '#22c55e' : kw.position <= 10 ? '#eab308' : '#f97316' }}>{kw.position}</span></td>
                            <td>{formatVolume(kw.volume)}</td>
                            <td>{kw.trafficPercent}%</td>
                            <td className={styles.urlCell}>{kw.url}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {data.topCompetitors && data.topCompetitors.length > 0 && (
                <div className={styles.tableSection}>
                  <div className={styles.tableSectionHeader}><div className={styles.tableSectionTitle}>Main Organic Competitors</div></div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>Domain</th><th>Common Keywords</th><th>Organic Keywords</th><th>Organic Traffic</th></tr></thead>
                      <tbody>
                        {data.topCompetitors.map((comp, i) => (
                          <tr key={i}>
                            <td className={styles.kwCell}>{comp.domain}</td>
                            <td>{formatVolume(comp.commonKeywords)}</td>
                            <td>{formatVolume(comp.organicKeywords)}</td>
                            <td>{formatVolume(comp.organicTraffic)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ProjectDomainOverviewPage() {
  return <AuthGuard><ProjectDomainOverviewContent /></AuthGuard>;
}
