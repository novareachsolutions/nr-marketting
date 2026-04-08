import { useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/Dialog';
import { AiInsights } from '@/components/ui/AiInsights';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useDomainOverview } from '@/hooks/useDomainOverview';
import type { DomainOverviewData } from '@/types/domain-overview';
import styles from './index.module.css';

// Lazy-load recharts components (they require window)
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false },
);
const LineChart = dynamic(
  () => import('recharts').then((m) => m.LineChart),
  { ssr: false },
);
const Line = dynamic(
  () => import('recharts').then((m) => m.Line),
  { ssr: false },
);
const XAxis = dynamic(
  () => import('recharts').then((m) => m.XAxis),
  { ssr: false },
);
const YAxis = dynamic(
  () => import('recharts').then((m) => m.YAxis),
  { ssr: false },
);
const Tooltip = dynamic(
  () => import('recharts').then((m) => m.Tooltip),
  { ssr: false },
);
const BarChart = dynamic(
  () => import('recharts').then((m) => m.BarChart),
  { ssr: false },
);
const Bar = dynamic(
  () => import('recharts').then((m) => m.Bar),
  { ssr: false },
);
const PieChart = dynamic(
  () => import('recharts').then((m) => m.PieChart),
  { ssr: false },
);
const Pie = dynamic(
  () => import('recharts').then((m) => m.Pie),
  { ssr: false },
);
const Cell = dynamic(
  () => import('recharts').then((m) => m.Cell),
  { ssr: false },
);
const Legend = dynamic(
  () => import('recharts').then((m) => m.Legend),
  { ssr: false },
);

// ─── Helpers ───────────────────────────────────────────────

function formatVolume(v: number | null): string {
  if (v === null || v === undefined) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function formatCurrency(v: number | null): string {
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
  const colors: Record<string, string> = {
    'Top 3': '#22c55e',
    '4-10': '#34d399',
    '11-20': '#eab308',
    '21-50': '#f97316',
    '51-100': '#ef4444',
  };
  return colors[label] || '#6366f1';
}

const INTENT_COLORS: Record<string, string> = {
  informational: '#3b82f6',
  navigational: '#8b5cf6',
  commercial: '#f59e0b',
  transactional: '#22c55e',
};

// ─── Authority Gauge SVG ───────────────────────────────────

function AuthorityGauge({ score }: { score: number | null }) {
  const displayScore = score ?? 0;
  const color = getAuthorityColor(score);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = (displayScore / 100) * circumference;

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className={styles.authorityGauge}>
      <circle
        cx="50" cy="50" r={radius}
        fill="none"
        stroke="var(--border-primary)"
        strokeWidth="6"
      />
      <circle
        cx="50" cy="50" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text
        x="50" y="48" textAnchor="middle"
        fill="var(--text-primary)"
        fontSize="22" fontWeight="700"
      >
        {score !== null ? score : '--'}
      </text>
      <text
        x="50" y="62" textAnchor="middle"
        fill="var(--text-tertiary)"
        fontSize="8" fontWeight="500"
      >
        AUTHORITY
      </text>
    </svg>
  );
}

// ─── Page Component ────────────────────────────────────────

function DomainOverviewContent() {
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [country, setCountry] = useState('AU');
  const [showGuide, setShowGuide] = useState(false);

  const { data, isLoading, error } = useDomainOverview(activeQuery, country);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveQuery(searchInput.trim());
    }
  };

  return (
    <div className={styles.layout}>
      <Head>
        <title>Domain Overview | NR SEO</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>Domain Overview</h1>
            <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="How to use this tool">?</button>
          </div>

          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Domain Overview — Guide">
            <h4>What is Domain Overview?</h4>
            <p>Get a complete SEO snapshot of any domain in seconds. Enter any website and see its authority score, organic/paid traffic, backlinks, keyword distributions, top pages, competitors, and traffic by country.</p>

            <h4>How to use it</h4>
            <ul>
              <li><strong>Enter a domain</strong> — Type any domain (e.g. google.com) and click Analyze.</li>
              <li><strong>Review authority score</strong> — The circular gauge shows overall domain strength (0-100).</li>
              <li><strong>Check traffic metrics</strong> — Three cards show organic search, paid search, and backlinks data.</li>
              <li><strong>Explore trends</strong> — The traffic trend chart shows 12-month organic traffic history.</li>
              <li><strong>Analyze competitors</strong> — See the top competing domains and their metrics.</li>
            </ul>

            <h4>Key metrics explained</h4>
            <ul>
              <li><strong>Authority Score (0-100)</strong> — Overall domain quality. Higher = more authoritative.</li>
              <li><strong>Organic Traffic</strong> — Estimated monthly visitors from organic search.</li>
              <li><strong>Traffic Cost</strong> — Dollar value of organic traffic if you had to pay for it via ads.</li>
              <li><strong>Backlinks</strong> — Total links pointing to the domain. Follow links pass SEO value.</li>
              <li><strong>Referring Domains</strong> — Unique domains linking to the site (more important than total backlinks).</li>
            </ul>

            <h4>Pro tips</h4>
            <ul>
              <li>Use this to quickly evaluate any competitor or potential partner site.</li>
              <li>Compare the authority score with your own domain to gauge competitive distance.</li>
              <li>Check the intent distribution to understand what type of content drives their traffic.</li>
            </ul>
          </GuideModal>

          {/* Search Form */}
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <input
              className={styles.searchInput}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter domain (e.g. example.com)"
            />
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
              className={styles.searchBtn}
              type="submit"
              disabled={!searchInput.trim() || isLoading}
            >
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </form>

          {/* Loading */}
          {isLoading && (
            <div className={styles.loadingState}>Analyzing domain... this may take a moment.</div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div className={styles.errorState}>
              {(error as any)?.response?.data?.message || 'Failed to analyze domain. Please try again.'}
            </div>
          )}

          {/* Results */}
          {data && !isLoading && (
            <>
              <AiInsights module="domain-overview" context={{ domain: data.domain, authorityScore: data.authorityScore, organicKeywords: data.organicKeywords, organicTraffic: data.organicTraffic, organicTrafficCost: data.organicTrafficCost, totalBacklinks: data.totalBacklinks, referringDomains: data.referringDomains }} />

              {/* Authority Score */}
              <div className={styles.authoritySection}>
                <AuthorityGauge score={data.authorityScore} />
                <div className={styles.authorityInfo}>
                  <div className={styles.authorityLabel}>Domain Authority</div>
                  <div className={styles.authorityDomain}>{data.domain}</div>
                  {data.authorityTrend && (
                    <div className={styles.authorityTrendBars}>
                      {data.authorityTrend.map((val, i) => (
                        <div
                          key={i}
                          className={styles.authorityTrendBar}
                          style={{
                            height: `${Math.max(4, (val / 100) * 32)}px`,
                            backgroundColor: getAuthorityColor(val),
                          }}
                          title={`${val}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Three-Column Metrics */}
              <div className={styles.metricsGrid}>
                {/* Organic Search */}
                <div className={styles.metricCard}>
                  <div className={styles.metricCardTitle}>Organic Search</div>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Keywords</span>
                    <span className={styles.metricValueLg}>{formatVolume(data.organicKeywords)}</span>
                  </div>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Traffic</span>
                    <span className={styles.metricValue}>{formatVolume(data.organicTraffic)}</span>
                  </div>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Traffic Cost</span>
                    <span className={styles.metricValue}>{formatCurrency(data.organicTrafficCost)}</span>
                  </div>
                </div>

                {/* Paid Search */}
                <div className={styles.metricCard}>
                  <div className={styles.metricCardTitle}>Paid Search</div>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Keywords</span>
                    <span className={styles.metricValueLg}>{formatVolume(data.paidKeywords)}</span>
                  </div>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Traffic</span>
                    <span className={styles.metricValue}>{formatVolume(data.paidTraffic)}</span>
                  </div>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Traffic Cost</span>
                    <span className={styles.metricValue}>{formatCurrency(data.paidTrafficCost)}</span>
                  </div>
                </div>

                {/* Backlinks */}
                <div className={styles.metricCard}>
                  <div className={styles.metricCardTitle}>Backlinks</div>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Total</span>
                    <span className={styles.metricValueLg}>{formatVolume(data.totalBacklinks)}</span>
                  </div>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Referring Domains</span>
                    <span className={styles.metricValue}>{formatVolume(data.referringDomains)}</span>
                  </div>
                  {data.followBacklinks !== null && data.nofollowBacklinks !== null && (
                    <div className={styles.ratioBarWrap}>
                      <div className={styles.ratioBar}>
                        <div
                          className={styles.ratioFollow}
                          style={{ width: `${(data.followBacklinks / (data.followBacklinks + data.nofollowBacklinks)) * 100}%` }}
                        />
                        <div
                          className={styles.ratioNofollow}
                          style={{ width: `${(data.nofollowBacklinks / (data.followBacklinks + data.nofollowBacklinks)) * 100}%` }}
                        />
                      </div>
                      <div className={styles.ratioLabels}>
                        <span>Follow {formatVolume(data.followBacklinks)}</span>
                        <span>Nofollow {formatVolume(data.nofollowBacklinks)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Traffic Trend Chart */}
              {data.organicTrafficTrend && data.organicTrafficTrend.length > 0 && (
                <div className={styles.chartSection}>
                  <div className={styles.chartTitle}>Organic Traffic Trend</div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data.organicTrafficTrend}>
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
                        formatter={(value: number) => [formatVolume(value), 'Traffic']}
                        contentStyle={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="traffic"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#6366f1' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Intent Distribution + Position Distribution */}
              <div className={styles.chartsRow}>
                {/* Intent Distribution Pie */}
                {data.intentDistribution && (
                  <div className={styles.chartSection}>
                    <div className={styles.chartTitle}>Keywords by Intent</div>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Informational', value: data.intentDistribution.informational },
                            { name: 'Navigational', value: data.intentDistribution.navigational },
                            { name: 'Commercial', value: data.intentDistribution.commercial },
                            { name: 'Transactional', value: data.intentDistribution.transactional },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }: { name: string; value: number }) => `${name} ${value}%`}
                          labelLine={false}
                        >
                          {Object.values(INTENT_COLORS).map((color, i) => (
                            <Cell key={i} fill={color} />
                          ))}
                        </Pie>
                        <Legend
                          wrapperStyle={{ fontSize: '11px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Position Distribution Bar */}
                {data.positionDistribution && (
                  <div className={styles.chartSection}>
                    <div className={styles.chartTitle}>Keyword Positions</div>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart
                        data={[
                          { name: 'Top 3', count: data.positionDistribution.top3 },
                          { name: '4-10', count: data.positionDistribution.pos4_10 },
                          { name: '11-20', count: data.positionDistribution.pos11_20 },
                          { name: '21-50', count: data.positionDistribution.pos21_50 },
                          { name: '51-100', count: data.positionDistribution.pos51_100 },
                        ]}
                      >
                        <XAxis
                          dataKey="name"
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
                          formatter={(value: number) => [formatVolume(value), 'Keywords']}
                          contentStyle={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {['Top 3', '4-10', '11-20', '21-50', '51-100'].map((label, i) => (
                            <Cell key={i} fill={getPositionColor(label)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Top Organic Keywords Table */}
              {data.topOrganicKeywords && data.topOrganicKeywords.length > 0 && (
                <div className={styles.tableSection}>
                  <div className={styles.tableSectionHeader}>
                    <div className={styles.tableSectionTitle}>Top Organic Keywords</div>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Keyword</th>
                          <th>Position</th>
                          <th>Volume</th>
                          <th>Traffic %</th>
                          <th>URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topOrganicKeywords.map((kw, i) => (
                          <tr key={i}>
                            <td className={styles.kwCell}>{kw.keyword}</td>
                            <td>
                              <span
                                className={styles.positionBadge}
                                style={{ backgroundColor: kw.position <= 3 ? '#22c55e' : kw.position <= 10 ? '#eab308' : '#f97316' }}
                              >
                                {kw.position}
                              </span>
                            </td>
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

              {/* Top Organic Pages Table */}
              {data.topOrganicPages && data.topOrganicPages.length > 0 && (
                <div className={styles.tableSection}>
                  <div className={styles.tableSectionHeader}>
                    <div className={styles.tableSectionTitle}>Top Organic Pages</div>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>URL</th>
                          <th>Traffic</th>
                          <th>Keywords</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topOrganicPages.map((page, i) => (
                          <tr key={i}>
                            <td className={styles.urlCell}>{page.url}</td>
                            <td>{formatVolume(page.traffic)}</td>
                            <td>{formatVolume(page.keywords)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Competitors Table */}
              {data.topCompetitors && data.topCompetitors.length > 0 && (
                <div className={styles.tableSection}>
                  <div className={styles.tableSectionHeader}>
                    <div className={styles.tableSectionTitle}>Main Organic Competitors</div>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Domain</th>
                          <th>Common Keywords</th>
                          <th>Organic Keywords</th>
                          <th>Organic Traffic</th>
                        </tr>
                      </thead>
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

              {/* Country Distribution */}
              {data.countryDistribution && data.countryDistribution.length > 0 && (
                <div className={styles.chartSection}>
                  <div className={styles.chartTitle}>Traffic by Country</div>
                  {data.countryDistribution.map((cd, i) => (
                    <div key={i} className={styles.countryRow}>
                      <span className={styles.countryCode}>{cd.country}</span>
                      <div className={styles.countryBarWrap}>
                        <div
                          className={styles.countryBar}
                          style={{ width: `${cd.trafficShare}%` }}
                        />
                      </div>
                      <span className={styles.countryPercent}>{cd.trafficShare}%</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function DomainOverviewPage() {
  return (
    <AuthGuard>
      <DomainOverviewContent />
    </AuthGuard>
  );
}
