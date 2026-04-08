import { useState, useMemo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/Dialog';
import { AiInsights } from '@/components/ui/AiInsights';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useBacklinkGap } from '@/hooks/useBacklinkGap';
import type { BacklinkGapType, ReferringDomain } from '@/types/backlink-gap';
import styles from './index.module.css';

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });

const DOMAIN_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6'];

function formatVolume(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function getAuthorityColor(s: number): string {
  if (s >= 70) return '#22c55e';
  if (s >= 50) return '#eab308';
  if (s >= 30) return '#f97316';
  return '#ef4444';
}

const GAP_TYPES: { key: BacklinkGapType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'best', label: 'Best' },
  { key: 'weak', label: 'Weak' },
  { key: 'strong', label: 'Strong' },
  { key: 'shared', label: 'Shared' },
  { key: 'unique', label: 'Unique' },
];

const GAP_STYLES: Record<string, string> = {
  best: styles.gapBest,
  weak: styles.gapWeak,
  strong: styles.gapStrong,
  shared: styles.gapShared,
  unique: styles.gapUnique,
};

type SortCol = 'domain' | 'authorityScore' | 'monthlyVisits' | 'matches' | 'gapType';

function BacklinkGapContent() {
  const [domainInputs, setDomainInputs] = useState<string[]>(['', '']);
  const [activeQuery, setActiveQuery] = useState('');
  const [country, setCountry] = useState('AU');
  const [showGuide, setShowGuide] = useState(false);
  const [activeGapType, setActiveGapType] = useState<BacklinkGapType | 'all'>('all');
  const [sortCol, setSortCol] = useState<SortCol>('authorityScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const { data, isLoading, error } = useBacklinkGap(activeQuery, country);

  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    const filled = domainInputs.filter((d) => d.trim());
    if (filled.length >= 2) {
      setActiveQuery(filled.map((d) => d.trim()).join(','));
      setActiveGapType('all');
      setPage(1);
    }
  };

  const updateInput = (i: number, val: string) => { const n = [...domainInputs]; n[i] = val; setDomainInputs(n); };
  const addInput = () => { if (domainInputs.length < 5) setDomainInputs([...domainInputs, '']); };
  const removeInput = (i: number) => { if (domainInputs.length > 2) setDomainInputs(domainInputs.filter((_, j) => j !== i)); };

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortOrder('desc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    if (!data?.referringDomains) return [];
    let result = [...data.referringDomains];
    if (activeGapType !== 'all') result = result.filter((r) => r.gapType === activeGapType);
    result.sort((a, b) => {
      const av = a[sortCol] ?? '';
      const bv = b[sortCol] ?? '';
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [data?.referringDomains, activeGapType, sortCol, sortOrder]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const filledCount = domainInputs.filter((d) => d.trim()).length;

  const renderSortArrow = (col: SortCol) => {
    if (sortCol !== col) return null;
    return <span className={styles.sortArrow}>{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className={styles.layout}>
      <Head><title>Backlink Gap | NR SEO</title></Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>Backlink Gap</h1>
            <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="How to use this tool">?</button>
          </div>

          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Backlink Gap — Guide">
            <h4>What is Backlink Gap?</h4>
            <p>Find which websites link to your competitors but not to you. These are your top link-building targets — if they link to your rivals, they'll likely link to you too with the right outreach.</p>

            <h4>How to use it</h4>
            <ul>
              <li><strong>Enter your domain first</strong> — The first field is "You".</li>
              <li><strong>Add competitors</strong> — Enter 1-4 competitor domains.</li>
              <li><strong>Click Find Prospects</strong> — The tool compares backlink profiles.</li>
              <li><strong>Review the trend chart</strong> — See who's building backlinks faster over 6 months.</li>
              <li><strong>Use gap tabs</strong> — Filter referring domains by Best, Weak, Strong, Shared, or Unique.</li>
            </ul>

            <h4>Gap types explained</h4>
            <ul>
              <li><strong>Best</strong> — Links to all competitors but NOT you. <em>Top outreach priority!</em></li>
              <li><strong>Weak</strong> — Links to you less than competitors. <em>Ask for more/better links.</em></li>
              <li><strong>Strong</strong> — Links to you but NOT competitors. <em>Your advantage — maintain it.</em></li>
              <li><strong>Shared</strong> — Links to you AND competitors. <em>Common in your niche.</em></li>
              <li><strong>Unique</strong> — Links to only one domain. <em>Exclusive relationship.</em></li>
            </ul>

            <h4>Key metrics explained</h4>
            <ul>
              <li><strong>Authority Score</strong> — Quality of the referring domain (higher = more valuable link).</li>
              <li><strong>Monthly Visits</strong> — Traffic to the referring domain (higher = more referral traffic potential).</li>
              <li><strong>Matches</strong> — How many of the analyzed domains this site links to (e.g. 3/4).</li>
            </ul>

            <h4>Pro tips</h4>
            <ul>
              <li>Focus on "Best" prospects with high authority scores — these are the most valuable links to acquire.</li>
              <li>High "Matches" count means the site commonly links in your niche — easier outreach.</li>
              <li>Sort by Authority Score to prioritize quality over quantity.</li>
            </ul>
          </GuideModal>

          <form className={styles.inputsForm} onSubmit={handleCompare}>
            {domainInputs.map((val, i) => (
              <div key={i} className={styles.inputGroup}>
                <span className={styles.colorDot} style={{ backgroundColor: DOMAIN_COLORS[i] }} />
                <span className={styles.inputLabel}>{i === 0 ? 'Your Domain' : `Competitor ${i}`}</span>
                <input className={styles.domainInput} type="text" value={val} onChange={(e) => updateInput(i, e.target.value)} placeholder={i === 0 ? 'yourdomain.com' : `competitor${i}.com`} />
                {i > 1 && <button type="button" className={styles.removeBtn} onClick={() => removeInput(i)}>×</button>}
              </div>
            ))}
            <div className={styles.actionsRow}>
              <button type="button" className={styles.addBtn} onClick={addInput} disabled={domainInputs.length >= 5}>+ Add Competitor</button>
              <select className={styles.countrySelect} value={country} onChange={(e) => setCountry(e.target.value)}>
                {['AU','US','GB','CA','IN','DE','FR','ES','IT','BR','JP'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className={styles.compareBtn} type="submit" disabled={filledCount < 2 || isLoading}>
                {isLoading ? 'Analyzing...' : 'Find Prospects'}
              </button>
            </div>
          </form>

          {isLoading && <div className={styles.loadingState}>Analyzing backlink gap... this may take a moment.</div>}
          {error && !isLoading && (
            <div className={styles.errorState}>{(error as any)?.response?.data?.message || 'Failed to analyze backlink gap.'}</div>
          )}

          {data && !isLoading && (
            <>
              <AiInsights module="backlink-gap" context={{ domains: data.domains, summary: data.summary, topProspects: data.referringDomains.filter((r) => r.gapType === 'best').slice(0, 3).map((r) => ({ domain: r.domain, authority: r.authorityScore })) }} />

              {/* Summary Cards */}
              <div className={styles.summaryGrid}>
                {GAP_TYPES.map((gt) => {
                  const count = gt.key === 'all' ? data.summary.totalReferringDomains : (data.summary as any)[gt.key];
                  return (
                    <div key={gt.key} className={activeGapType === gt.key ? styles.summaryCardActive : styles.summaryCard} onClick={() => { setActiveGapType(gt.key as any); setPage(1); }}>
                      <div className={styles.summaryCardLabel}>{gt.label}</div>
                      <div className={styles.summaryCardValue}>{formatVolume(count)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Backlink Trend Chart */}
              {data.backlinkTrend && data.backlinkTrend.length > 0 && (
                <div className={styles.chartSection}>
                  <div className={styles.chartTitle}>Backlink Growth Trend</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data.backlinkTrend}>
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={{ stroke: 'var(--border-primary)' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatVolume(v)} />
                      <Tooltip formatter={(value: number) => [formatVolume(value), '']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px', fontSize: '12px' }} />
                      {data.domains.map((dm, i) => (
                        <Line key={dm} type="monotone" dataKey={dm} stroke={DOMAIN_COLORS[i]} strokeWidth={2} dot={false} />
                      ))}
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Gap Type Tabs */}
              <div className={styles.gapTabs}>
                {GAP_TYPES.map((gt) => {
                  const count = gt.key === 'all' ? data.referringDomains.length : data.referringDomains.filter((r) => r.gapType === gt.key).length;
                  return (
                    <button key={gt.key} className={activeGapType === gt.key ? styles.gapTabActive : styles.gapTab} onClick={() => { setActiveGapType(gt.key as any); setPage(1); }}>
                      {gt.label} <span className={styles.gapTabCount}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Referring Domains Table */}
              <div className={styles.tableSection}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th onClick={() => handleSort('domain')}>Referring Domain{renderSortArrow('domain')}</th>
                        <th onClick={() => handleSort('authorityScore')}>Authority{renderSortArrow('authorityScore')}</th>
                        <th onClick={() => handleSort('monthlyVisits')}>Monthly Visits{renderSortArrow('monthlyVisits')}</th>
                        <th onClick={() => handleSort('matches')}>Matches{renderSortArrow('matches')}</th>
                        {data.domains.map((dm, i) => (
                          <th key={dm} style={{ color: DOMAIN_COLORS[i] }}>{dm.length > 15 ? dm.slice(0, 15) + '...' : dm}</th>
                        ))}
                        <th onClick={() => handleSort('gapType')}>Gap{renderSortArrow('gapType')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((rd, i) => {
                        const maxBl = Math.max(...Object.values(rd.backlinksPerDomain || {}));
                        return (
                          <tr key={i}>
                            <td className={styles.domainCell}>{rd.domain}</td>
                            <td>
                              <span className={styles.authorityBadge} style={{ backgroundColor: getAuthorityColor(rd.authorityScore) }}>
                                {rd.authorityScore}
                              </span>
                            </td>
                            <td>{formatVolume(rd.monthlyVisits)}</td>
                            <td>{rd.matches}/{data.domains.length}</td>
                            {data.domains.map((dm) => {
                              const bl = rd.backlinksPerDomain?.[dm] || 0;
                              return (
                                <td key={dm}>
                                  {bl > 0 ? (
                                    <span className={bl === maxBl ? styles.blCountBest : undefined}>{formatVolume(bl)}</span>
                                  ) : '--'}
                                </td>
                              );
                            })}
                            <td>
                              <span className={`${styles.gapBadge} ${GAP_STYLES[rd.gapType] || ''}`}>{rd.gapType}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <span className={styles.pageInfo}>Page {page} of {totalPages} ({filtered.length} domains)</span>
                    <button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function BacklinkGapPage() {
  return (
    <AuthGuard>
      <BacklinkGapContent />
    </AuthGuard>
  );
}
