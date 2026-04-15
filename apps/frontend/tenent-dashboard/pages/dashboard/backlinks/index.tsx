import { useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/Dialog';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useBacklinks } from '@/hooks/useBacklinks';
import {
  Search,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Link2,
  Shield,
  Globe,
  ExternalLink,
} from 'lucide-react';
import styles from './index.module.css';

const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false },
);
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false });

// ─── Helpers ───────────────────────────────────────────
function formatNumber(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function getAuthorityColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'var(--text-tertiary)';
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

function formatDate(iso: string): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Authority Gauge ───────────────────────────────────
function AuthorityGauge({ score }: { score: number }) {
  const color = getAuthorityColor(score);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className={styles.authGauge}>
      <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--border-primary)" strokeWidth="6" />
      <circle
        cx="44"
        cy="44"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        transform="rotate(-90 44 44)"
      />
      <text x="44" y="42" textAnchor="middle" fill="var(--text-primary)" fontSize="20" fontWeight="700">
        {score}
      </text>
      <text x="44" y="56" textAnchor="middle" fill="var(--text-tertiary)" fontSize="8" fontWeight="600">
        AUTHORITY
      </text>
    </svg>
  );
}

// ─── Component ─────────────────────────────────────────
function BacklinksContent() {
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [country, setCountry] = useState('AU');
  const [showGuide, setShowGuide] = useState(false);

  const { data, isLoading, error } = useBacklinks(activeQuery, country);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) setActiveQuery(searchInput.trim());
  };

  const maxTrendBacklinks =
    data && data.trend.length > 0
      ? Math.max(...data.trend.map((t) => t.backlinks))
      : 0;

  return (
    <div className={styles.layout}>
      <Head>
        <title>Backlinks — NR SEO</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Backlinks</h1>
            <button
              className={styles.guideBtn}
              onClick={() => setShowGuide(true)}
              title="How to use this tool"
            >
              ?
            </button>
          </div>
          <p className={styles.pageSubtitle}>
            Get a complete view of any site&apos;s backlink profile — referring domains, anchor texts,
            new/lost links, and link-building progress.
          </p>

          <GuideModal
            isOpen={showGuide}
            onClose={() => setShowGuide(false)}
            title="Backlinks — Guide"
          >
            <h4>What is Backlinks Analytics?</h4>
            <p>
              Examine any domain&apos;s backlink profile. See who&apos;s linking to a site, analyze link
              quality, monitor new and lost backlinks, and find link-building opportunities.
            </p>
            <h4>How to use it</h4>
            <ul>
              <li>
                <strong>Enter a domain</strong> — Type any domain (e.g. example.com) and click Analyze.
              </li>
              <li>
                <strong>Overview</strong> — Review total backlinks, referring domains, and authority.
              </li>
              <li>
                <strong>Trend</strong> — Track backlink growth over 12 months.
              </li>
              <li>
                <strong>Referring Domains</strong> — See top sites linking in.
              </li>
              <li>
                <strong>Anchors</strong> — Analyze anchor text distribution for over-optimization risk.
              </li>
              <li>
                <strong>New / Lost</strong> — Monitor recent backlink changes.
              </li>
            </ul>
            <h4>Why backlinks matter</h4>
            <p>
              Backlinks act as &ldquo;votes of confidence&rdquo; for your site. High-quality backlinks help
              improve search rankings, while low-quality or spammy links can hurt your SEO.
            </p>
          </GuideModal>

          {/* Search Form */}
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <input
              className={styles.searchInput}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter domain or URL (e.g. example.com)"
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
              {isLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Search size={15} /> Analyze
                </>
              )}
            </button>
          </form>

          {/* Empty state */}
          {!activeQuery && !isLoading && (
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>Check Backlinks for Any Website</div>
              <p className={styles.emptyText}>
                Enter any domain or URL above and click &ldquo;Analyze&rdquo; to see its complete backlink
                profile — referring domains, anchor texts, new opportunities, and more.
              </p>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className={styles.loadingState}>
              <Loader2 size={16} className="animate-spin" />
              Analyzing backlink profile... this may take up to a minute.
            </div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div className={styles.errorState}>
              {(error as any)?.response?.data?.message ||
                (error as any)?.message ||
                'Failed to analyze domain. Please try again.'}
            </div>
          )}

          {/* Results */}
          {data && !isLoading && (
            <>
              {/* Domain header */}
              <div className={styles.domainHeader}>
                <AuthorityGauge score={data.overview.authorityScore} />
                <div className={styles.domainMeta}>
                  <div className={styles.domainLabel}>Domain</div>
                  <div className={styles.domainName}>{data.domain}</div>
                  <div className={styles.domainBadges}>
                    <span className={styles.badge}>{data.country}</span>
                    <span className={styles.badge}>
                      Last checked: {new Date().toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metric Cards */}
              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>
                    <Link2 size={12} /> Total Backlinks
                  </div>
                  <div className={styles.metricValue}>{formatNumber(data.overview.totalBacklinks)}</div>
                  <div className={styles.metricSub}>
                    {formatNumber(data.overview.textBacklinks)} text ·{' '}
                    {formatNumber(data.overview.imageBacklinks)} image
                  </div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>
                    <Globe size={12} /> Referring Domains
                  </div>
                  <div className={styles.metricValue}>
                    {formatNumber(data.overview.referringDomains)}
                  </div>
                  <div className={styles.metricSub}>
                    {formatNumber(data.overview.referringIps)} unique IPs
                  </div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>
                    <Shield size={12} /> Follow / Nofollow
                  </div>
                  <div className={styles.metricValue}>{data.overview.dofollowPercent}%</div>
                  <div className={styles.metricSub}>
                    {formatNumber(data.overview.followBacklinks)} follow ·{' '}
                    {formatNumber(data.overview.nofollowBacklinks)} nofollow
                  </div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>
                    <TrendingUp size={12} /> 30-day Change
                  </div>
                  <div className={styles.metricValue}>
                    +{formatNumber(data.overview.newBacklinks30d)}
                  </div>
                  <div className={styles.metricSub}>
                    <span className={styles.deltaUp}>
                      <ArrowUpRight size={10} /> {data.overview.newBacklinks30d} new
                    </span>
                    {'  '}·{'  '}
                    <span className={styles.deltaDown}>
                      <ArrowDownRight size={10} /> {data.overview.lostBacklinks30d} lost
                    </span>
                  </div>
                </div>
              </div>

              {/* Trend chart */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <TrendingUp size={15} /> Backlink Growth (12 months)
                  </div>
                  <div className={styles.sectionHint}>
                    Peak: {formatNumber(maxTrendBacklinks)} backlinks
                  </div>
                </div>
                <div className={styles.chartWrap}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                      <XAxis
                        dataKey="month"
                        stroke="var(--text-tertiary)"
                        style={{ fontSize: 11 }}
                      />
                      <YAxis
                        stroke="var(--text-tertiary)"
                        style={{ fontSize: 11 }}
                        tickFormatter={(v) => formatNumber(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={
                          ((value: any, name: string) => [
                            formatNumber(Number(value)),
                            name === 'backlinks'
                              ? 'Backlinks'
                              : name === 'referringDomains'
                                ? 'Referring Domains'
                                : 'Authority',
                          ]) as any
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="backlinks"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="referringDomains"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Two column: Anchors + Top Referring */}
              <div className={styles.twoCol}>
                {/* Anchor distribution */}
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>Anchor Text Distribution</div>
                    <div className={styles.sectionHint}>Top 10</div>
                  </div>
                  <div className={styles.anchorList}>
                    {data.anchorDistribution.map((a) => (
                      <div key={a.anchor}>
                        <div className={styles.anchorRow}>
                          <div className={styles.anchorLabel} title={a.anchor}>
                            {a.anchor}
                          </div>
                          <div className={styles.anchorCount}>{a.percentage.toFixed(1)}%</div>
                        </div>
                        <div className={styles.anchorBar}>
                          <div
                            className={styles.anchorBarFill}
                            style={{ width: `${Math.min(100, a.percentage * 3)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TLD distribution */}
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>TLD Distribution</div>
                    <div className={styles.sectionHint}>Top domains by extension</div>
                  </div>
                  <div>
                    {data.tldDistribution.map((t) => (
                      <div key={t.label} className={styles.distRow}>
                        <div className={styles.distLabel}>{t.label}</div>
                        <div className={styles.distBar}>
                          <div
                            className={styles.distBarFill}
                            style={{ width: `${Math.min(100, t.percentage * 1.5)}%` }}
                          />
                        </div>
                        <div className={styles.distValue}>
                          {formatNumber(t.count)} · {t.percentage.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top Referring Domains */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>Top Referring Domains</div>
                  <div className={styles.sectionHint}>
                    {data.topReferringDomains.length} domains
                  </div>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Domain</th>
                      <th>Authority</th>
                      <th>Backlinks</th>
                      <th>Follow Ratio</th>
                      <th>Category</th>
                      <th>First Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topReferringDomains.map((d) => (
                      <tr key={d.domain}>
                        <td>
                          <div className={styles.tableDomain}>{d.domain}</div>
                          <div className={styles.tableMuted}>{d.countryCode}</div>
                        </td>
                        <td>
                          <span
                            className={styles.scoreChip}
                            style={{ background: getAuthorityColor(d.authorityScore) }}
                          >
                            {d.authorityScore}
                          </span>
                        </td>
                        <td>{formatNumber(d.backlinks)}</td>
                        <td>{Math.round(d.followRatio * 100)}%</td>
                        <td className={styles.tableMuted}>{d.category}</td>
                        <td className={styles.tableMuted}>{formatDate(d.firstSeen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Top Backlinks */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>Top Backlinks</div>
                  <div className={styles.sectionHint}>Highest authority sources</div>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Anchor</th>
                      <th>Type</th>
                      <th>Auth</th>
                      <th>First Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topBacklinks.map((b, i) => (
                      <tr key={`${b.sourceUrl}-${i}`}>
                        <td style={{ maxWidth: 360 }}>
                          <a
                            href={b.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.sourceLink}
                          >
                            {b.sourceTitle || b.sourceUrl}
                            <ExternalLink
                              size={10}
                              style={{ display: 'inline', marginLeft: 4, verticalAlign: 'middle' }}
                            />
                          </a>
                          <div className={styles.tableMuted}>{b.sourceUrl}</div>
                        </td>
                        <td>
                          <div className={styles.anchorText}>&ldquo;{b.anchor}&rdquo;</div>
                        </td>
                        <td>
                          <span
                            className={
                              b.type === 'follow' ? styles.chipFollow : styles.chipNofollow
                            }
                          >
                            {b.type}
                          </span>
                        </td>
                        <td>
                          <span
                            className={styles.scoreChip}
                            style={{ background: getAuthorityColor(b.sourceAuthority) }}
                          >
                            {b.sourceAuthority}
                          </span>
                        </td>
                        <td className={styles.tableMuted}>{formatDate(b.firstSeen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* New / Lost */}
              <div className={styles.twoCol}>
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                      <ArrowUpRight size={15} style={{ color: '#22c55e' }} /> New Backlinks
                    </div>
                    <div className={styles.sectionHint}>Last 30 days</div>
                  </div>
                  <table className={styles.table}>
                    <tbody>
                      {data.newBacklinks.map((b, i) => (
                        <tr key={`new-${i}`}>
                          <td style={{ maxWidth: 260 }}>
                            <a
                              href={b.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.sourceLink}
                            >
                              {b.sourceTitle || b.sourceUrl}
                            </a>
                            <div className={styles.tableMuted}>&ldquo;{b.anchor}&rdquo;</div>
                          </td>
                          <td className={styles.tableMuted}>{formatDate(b.firstSeen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                      <ArrowDownRight size={15} style={{ color: '#ef4444' }} /> Lost Backlinks
                    </div>
                    <div className={styles.sectionHint}>Last 30 days</div>
                  </div>
                  <table className={styles.table}>
                    <tbody>
                      {data.lostBacklinks.map((b, i) => (
                        <tr key={`lost-${i}`}>
                          <td style={{ maxWidth: 260 }}>
                            <a
                              href={b.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.sourceLink}
                            >
                              {b.sourceTitle || b.sourceUrl}
                            </a>
                            <div className={styles.tableMuted}>&ldquo;{b.anchor}&rdquo;</div>
                          </td>
                          <td className={styles.tableMuted}>{formatDate(b.firstSeen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category distribution */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>Category Distribution</div>
                  <div className={styles.sectionHint}>Referring domains by niche</div>
                </div>
                <div>
                  {data.categoryDistribution.map((c) => (
                    <div key={c.label} className={styles.distRow}>
                      <div className={styles.distLabel}>{c.label}</div>
                      <div className={styles.distBar}>
                        <div
                          className={styles.distBarFill}
                          style={{ width: `${Math.min(100, c.percentage * 2)}%` }}
                        />
                      </div>
                      <div className={styles.distValue}>
                        {formatNumber(c.count)} · {c.percentage.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function BacklinksPage() {
  return (
    <AuthGuard>
      <BacklinksContent />
    </AuthGuard>
  );
}
