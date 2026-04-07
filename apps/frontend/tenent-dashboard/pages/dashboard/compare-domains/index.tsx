import { useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/GuideModal';
import { AiInsights } from '@/components/ui/AiInsights';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useCompareDomains } from '@/hooks/useCompareDomains';
import type { CompareDomainData } from '@/types/compare-domains';
import styles from './index.module.css';

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
  if (pos <= 3) return '#22c55e';
  if (pos <= 10) return '#34d399';
  if (pos <= 20) return '#eab308';
  if (pos <= 50) return '#f97316';
  return '#ef4444';
}

const METRIC_ROWS = [
  { key: 'authorityScore', label: 'Authority Score', format: (v: number) => String(v) },
  { key: 'organicKeywords', label: 'Organic Keywords', format: formatVolume },
  { key: 'organicTraffic', label: 'Organic Traffic', format: formatVolume },
  { key: 'organicTrafficCost', label: 'Traffic Cost', format: formatCurrency },
  { key: 'paidKeywords', label: 'Paid Keywords', format: formatVolume },
  { key: 'paidTraffic', label: 'Paid Traffic', format: formatVolume },
  { key: 'backlinks', label: 'Backlinks', format: formatVolume },
  { key: 'referringDomains', label: 'Referring Domains', format: formatVolume },
] as const;

function CompareDomainsContent() {
  const [domainInputs, setDomainInputs] = useState<string[]>(['', '']);
  const [activeQuery, setActiveQuery] = useState('');
  const [country, setCountry] = useState('AU');
  const [showGuide, setShowGuide] = useState(false);

  const { data, isLoading, error } = useCompareDomains(activeQuery, country);

  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    const filled = domainInputs.filter((d) => d.trim());
    if (filled.length >= 2) {
      setActiveQuery(filled.map((d) => d.trim()).join(','));
    }
  };

  const updateInput = (index: number, value: string) => {
    const next = [...domainInputs];
    next[index] = value;
    setDomainInputs(next);
  };

  const addInput = () => {
    if (domainInputs.length < 5) {
      setDomainInputs([...domainInputs, '']);
    }
  };

  const removeInput = (index: number) => {
    if (domainInputs.length > 2) {
      setDomainInputs(domainInputs.filter((_, i) => i !== index));
    }
  };

  const filledCount = domainInputs.filter((d) => d.trim()).length;

  // Build traffic trend chart data (merge all domains' trends by date)
  const trendData = (() => {
    if (!data?.domains?.length) return [];
    const dateMap: Record<string, Record<string, number>> = {};
    data.domains.forEach((dm) => {
      (dm.trafficTrend || []).forEach((t) => {
        if (!dateMap[t.date]) dateMap[t.date] = {};
        dateMap[t.date][dm.domain] = t.traffic;
      });
    });
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  })();

  // Build intent comparison chart data
  const intentData = (() => {
    if (!data?.intentComparison) return [];
    const intents = ['informational', 'navigational', 'commercial', 'transactional'];
    return intents.map((intent) => {
      const row: Record<string, any> = { intent: intent.charAt(0).toUpperCase() + intent.slice(1) };
      Object.entries(data.intentComparison).forEach(([domain, vals]) => {
        row[domain] = (vals as any)[intent] || 0;
      });
      return row;
    });
  })();

  return (
    <div className={styles.layout}>
      <Head>
        <title>Compare Domains | NR SEO</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>Compare Domains</h1>
            <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="How to use this tool">?</button>
          </div>

          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Compare Domains — Guide">
            <h4>What is Compare Domains?</h4>
            <p>Put 2-5 websites side-by-side and instantly see who's winning at SEO. Compare authority, traffic, keywords, backlinks, and more — with visual charts showing traffic trends and keyword intent distribution.</p>

            <h4>How to use it</h4>
            <ul>
              <li><strong>Enter 2-5 domains</strong> — Type domains in the input fields. Click "+ Add Domain" for more (max 5).</li>
              <li><strong>Click Compare</strong> — The tool generates a side-by-side comparison.</li>
              <li><strong>Review metrics table</strong> — Each row is a metric, each column is a domain. The highest value per row is highlighted in green.</li>
              <li><strong>Check charts</strong> — Traffic Trend shows 6-month growth per domain. Intent chart compares keyword distribution.</li>
              <li><strong>Keyword overlap</strong> — See how many keywords are shared vs unique to each domain.</li>
            </ul>

            <h4>Key metrics compared</h4>
            <ul>
              <li><strong>Authority Score</strong> — Overall domain strength (0-100).</li>
              <li><strong>Organic Keywords / Traffic</strong> — How many keywords rank and how much traffic they drive.</li>
              <li><strong>Traffic Cost</strong> — Dollar value of organic traffic.</li>
              <li><strong>Backlinks / Referring Domains</strong> — Link profile strength.</li>
              <li><strong>Common Keywords</strong> — Keywords all domains rank for, with each domain's position.</li>
            </ul>

            <h4>Pro tips</h4>
            <ul>
              <li>Compare yourself against your top 2-3 competitors to identify where you're behind.</li>
              <li>A competitor with faster traffic growth may be outpacing your SEO efforts.</li>
              <li>Look at common keywords — if they rank higher, study their content strategy.</li>
            </ul>
          </GuideModal>

          {/* Domain Inputs */}
          <form className={styles.inputsForm} onSubmit={handleCompare}>
            {domainInputs.map((val, i) => (
              <div key={i} className={styles.inputsRow}>
                <span className={styles.colorDot} style={{ backgroundColor: DOMAIN_COLORS[i] }} />
                <input
                  className={styles.domainInput}
                  type="text"
                  value={val}
                  onChange={(e) => updateInput(i, e.target.value)}
                  placeholder={`Domain ${i + 1}`}
                />
                {domainInputs.length > 2 && (
                  <button type="button" className={styles.removeBtn} onClick={() => removeInput(i)}>×</button>
                )}
              </div>
            ))}
            <div className={styles.actionsRow}>
              <button
                type="button"
                className={styles.addBtn}
                onClick={addInput}
                disabled={domainInputs.length >= 5}
              >
                + Add Domain
              </button>
              <select
                className={styles.countrySelect}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="AU">AU</option>
                <option value="US">US</option>
                <option value="GB">GB</option>
                <option value="CA">CA</option>
                <option value="IN">IN</option>
                <option value="DE">DE</option>
                <option value="FR">FR</option>
                <option value="ES">ES</option>
                <option value="IT">IT</option>
                <option value="BR">BR</option>
                <option value="JP">JP</option>
              </select>
              <button
                className={styles.compareBtn}
                type="submit"
                disabled={filledCount < 2 || isLoading}
              >
                {isLoading ? 'Comparing...' : 'Compare'}
              </button>
            </div>
          </form>

          {isLoading && <div className={styles.loadingState}>Comparing domains... this may take a moment.</div>}
          {error && !isLoading && (
            <div className={styles.errorState}>
              {(error as any)?.response?.data?.message || 'Failed to compare domains. Please try again.'}
            </div>
          )}

          {data && !isLoading && data.domains.length > 0 && (
            <>
              <AiInsights module="compare-domains" context={{ domains: data.domains.map((d) => d.domain), metrics: data.domains.map((d) => ({ domain: d.domain, authority: d.authorityScore, traffic: d.organicTraffic, keywords: d.organicKeywords, backlinks: d.backlinks })), shared: data.keywordOverlap?.shared }} />

              {/* Side-by-Side Metrics Table */}
              <div className={styles.comparisonTable}>
                <div className={styles.comparisonTableWrap}>
                  <table className={styles.compTable}>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        {data.domains.map((dm, i) => (
                          <th key={dm.domain}>
                            <div className={styles.domainHeader}>
                              <span className={styles.colorDot} style={{ backgroundColor: DOMAIN_COLORS[i] }} />
                              {dm.domain}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {METRIC_ROWS.map((row) => {
                        const values = data.domains.map((dm) => (dm as any)[row.key] as number);
                        const maxVal = Math.max(...values);
                        return (
                          <tr key={row.key}>
                            <td className={styles.metricLabel}>{row.label}</td>
                            {data.domains.map((dm, i) => {
                              const val = (dm as any)[row.key] as number;
                              return (
                                <td key={dm.domain}>
                                  <span className={val === maxVal && values.filter((v) => v === maxVal).length === 1 ? styles.metricHighlight : styles.metricValue}>
                                    {row.format(val)}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Charts Row: Traffic Trend + Intent Comparison */}
              <div className={styles.chartsRow}>
                {/* Traffic Trend */}
                {trendData.length > 0 && (
                  <div className={styles.chartSection}>
                    <div className={styles.chartTitle}>Traffic Trend</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={trendData}>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                          axisLine={{ stroke: 'var(--border-primary)' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => formatVolume(v)}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatVolume(value), '']}
                          contentStyle={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        {data.domains.map((dm, i) => (
                          <Line
                            key={dm.domain}
                            type="monotone"
                            dataKey={dm.domain}
                            stroke={DOMAIN_COLORS[i]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Intent Comparison */}
                {intentData.length > 0 && (
                  <div className={styles.chartSection}>
                    <div className={styles.chartTitle}>Keywords by Intent</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={intentData}>
                        <XAxis
                          dataKey="intent"
                          tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                          axisLine={{ stroke: 'var(--border-primary)' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${value}%`, '']}
                          contentStyle={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        {data.domains.map((dm, i) => (
                          <Bar key={dm.domain} dataKey={dm.domain} fill={DOMAIN_COLORS[i]} radius={[2, 2, 0, 0]} />
                        ))}
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Keyword Overlap */}
              {data.keywordOverlap && (
                <div className={styles.overlapGrid}>
                  <div className={styles.overlapCard}>
                    <div className={styles.overlapLabel}>Shared Keywords</div>
                    <div className={styles.overlapValue}>{formatVolume(data.keywordOverlap.shared)}</div>
                  </div>
                  {Object.entries(data.keywordOverlap.unique).map(([domain, count]) => (
                    <div key={domain} className={styles.overlapCard}>
                      <div className={styles.overlapLabel}>Unique to {domain}</div>
                      <div className={styles.overlapValue}>{formatVolume(count)}</div>
                    </div>
                  ))}
                  <div className={styles.overlapCard}>
                    <div className={styles.overlapLabel}>Total Universe</div>
                    <div className={styles.overlapValue}>{formatVolume(data.keywordOverlap.totalUniverse)}</div>
                  </div>
                </div>
              )}

              {/* Common Keywords Table */}
              {data.commonKeywords && data.commonKeywords.length > 0 && (
                <div className={styles.tableSection}>
                  <div className={styles.tableSectionHeader}>
                    <div className={styles.tableSectionTitle}>Top Common Keywords</div>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Keyword</th>
                          <th>Volume</th>
                          {data.domains.map((dm, i) => (
                            <th key={dm.domain}>
                              <span style={{ color: DOMAIN_COLORS[i] }}>{dm.domain}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.commonKeywords.map((kw, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 500 }}>{kw.keyword}</td>
                            <td>{formatVolume(kw.volume)}</td>
                            {data.domains.map((dm, j) => {
                              const pos = kw.positions?.[dm.domain];
                              return (
                                <td key={dm.domain}>
                                  {pos ? (
                                    <span
                                      className={styles.positionBadge}
                                      style={{ backgroundColor: getPositionColor(pos) }}
                                    >
                                      {pos}
                                    </span>
                                  ) : '--'}
                                </td>
                              );
                            })}
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

export default function CompareDomainsPage() {
  return (
    <AuthGuard>
      <CompareDomainsContent />
    </AuthGuard>
  );
}
