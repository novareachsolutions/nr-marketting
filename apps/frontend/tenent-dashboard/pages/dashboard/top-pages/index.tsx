import { useState, useMemo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/Dialog';
import { AiInsights } from '@/components/ui/AiInsights';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useTopPages } from '@/hooks/useTopPages';
import type { TopPage } from '@/types/top-pages';
import styles from './index.module.css';

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then((m) => m.Area), { ssr: false });

// ─── Helpers ───────────────────────────────────────────────

function formatVolume(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function getPositionColor(pos: number | null): string {
  if (pos === null) return 'var(--text-tertiary)';
  if (pos <= 3) return '#22c55e';
  if (pos <= 10) return '#34d399';
  if (pos <= 20) return '#eab308';
  if (pos <= 50) return '#f97316';
  return '#ef4444';
}

type SortCol = keyof TopPage;

// ─── Page Component ────────────────────────────────────────

function TopPagesContent() {
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [country, setCountry] = useState('AU');
  const [showGuide, setShowGuide] = useState(false);

  // Filters
  const [urlFilter, setUrlFilter] = useState('');
  const [minTraffic, setMinTraffic] = useState('');
  const [minKeywords, setMinKeywords] = useState('');

  // Sort
  const [sortCol, setSortCol] = useState<SortCol>('traffic');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const { data, isLoading, error } = useTopPages(activeQuery, country);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveQuery(searchInput.trim());
      setPage(1);
    }
  };

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    if (!data?.pages) return [];
    let result = [...data.pages];

    if (urlFilter) {
      const q = urlFilter.toLowerCase();
      result = result.filter((p) => p.url.toLowerCase().includes(q));
    }
    if (minTraffic) result = result.filter((p) => p.traffic >= parseInt(minTraffic));
    if (minKeywords) result = result.filter((p) => p.keywords >= parseInt(minKeywords));

    result.sort((a, b) => {
      const aVal = a[sortCol] ?? 0;
      const bVal = b[sortCol] ?? 0;
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data?.pages, urlFilter, minTraffic, minKeywords, sortCol, sortOrder]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const renderSortArrow = (col: SortCol) => {
    if (sortCol !== col) return null;
    return <span className={styles.sortArrow}>{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className={styles.layout}>
      <Head>
        <title>Top Pages | NR SEO</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>Top Pages</h1>
            <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="How to use this tool">?</button>
          </div>

          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Top Pages — Guide">
            <h4>What is Top Pages?</h4>
            <p>See which pages on any domain get the most organic traffic. Each page shows traffic, keyword count, top keyword with position, backlinks, and a 6-month traffic sparkline.</p>

            <h4>How to use it</h4>
            <ul>
              <li><strong>Enter a domain</strong> — Type any domain and click Analyze.</li>
              <li><strong>Review the table</strong> — Pages are sorted by traffic. Each row shows the page URL, traffic share, keywords driving traffic, the #1 keyword, backlinks, and a mini trend chart.</li>
              <li><strong>Filter</strong> — Search by URL path, set minimum traffic or keywords to narrow results.</li>
              <li><strong>Sort</strong> — Click any column header to sort ascending/descending.</li>
            </ul>

            <h4>Key metrics explained</h4>
            <ul>
              <li><strong>Traffic</strong> — Estimated monthly organic visits to this specific page.</li>
              <li><strong>Traffic %</strong> — This page's share of the domain's total organic traffic.</li>
              <li><strong>Keywords</strong> — Number of keywords this page ranks for in Google.</li>
              <li><strong>Top Keyword</strong> — The keyword driving the most traffic to this page, with its position badge.</li>
              <li><strong>Backlinks</strong> — Number of backlinks pointing to this specific page.</li>
              <li><strong>Trend</strong> — 6-month traffic sparkline showing if the page is growing or declining.</li>
            </ul>

            <h4>Pro tips</h4>
            <ul>
              <li>Use this on competitor domains to find their best-performing content.</li>
              <li>Pages with high traffic but declining trends may be opportunities to outrank.</li>
              <li>Look at top keywords per page to understand what content strategy works.</li>
            </ul>
          </GuideModal>

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

          {isLoading && <div className={styles.loadingState}>Fetching top pages... this may take a moment.</div>}
          {error && !isLoading && (
            <div className={styles.errorState}>
              {(error as any)?.response?.data?.message || 'Failed to fetch top pages. Please try again.'}
            </div>
          )}

          {data && !isLoading && (
            <>
              <AiInsights module="top-pages" context={{ domain: data.domain, totalPages: data.summary.totalPages, totalTraffic: data.summary.totalOrganicTraffic, avgKeywords: data.summary.avgKeywordsPerPage, topPageUrl: data.pages[0]?.url, topPageTraffic: data.pages[0]?.traffic }} />

              {/* Summary Bar */}
              <div className={styles.summaryBar}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Total Pages</div>
                  <div className={styles.summaryValue}>{formatVolume(data.summary.totalPages)}</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Organic Traffic</div>
                  <div className={styles.summaryValue}>{formatVolume(data.summary.totalOrganicTraffic)}</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Avg Keywords / Page</div>
                  <div className={styles.summaryValue}>{formatVolume(data.summary.avgKeywordsPerPage)}</div>
                </div>
              </div>

              {/* Filters */}
              <div className={styles.filtersRow}>
                <input
                  className={styles.filterInput}
                  type="text"
                  placeholder="Filter by URL..."
                  value={urlFilter}
                  onChange={(e) => { setUrlFilter(e.target.value); setPage(1); }}
                  style={{ minWidth: 200 }}
                />
                <input
                  className={styles.filterInput}
                  type="number"
                  placeholder="Min traffic"
                  value={minTraffic}
                  onChange={(e) => { setMinTraffic(e.target.value); setPage(1); }}
                  style={{ width: 110 }}
                />
                <input
                  className={styles.filterInput}
                  type="number"
                  placeholder="Min keywords"
                  value={minKeywords}
                  onChange={(e) => { setMinKeywords(e.target.value); setPage(1); }}
                  style={{ width: 120 }}
                />
              </div>

              {/* Table */}
              <div className={styles.tableSection}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th onClick={() => handleSort('url')}>URL{renderSortArrow('url')}</th>
                        <th onClick={() => handleSort('traffic')}>Traffic{renderSortArrow('traffic')}</th>
                        <th onClick={() => handleSort('trafficPercent')}>Traffic %{renderSortArrow('trafficPercent')}</th>
                        <th onClick={() => handleSort('keywords')}>Keywords{renderSortArrow('keywords')}</th>
                        <th>Top Keyword</th>
                        <th onClick={() => handleSort('backlinks')}>Backlinks{renderSortArrow('backlinks')}</th>
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((p, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{(page - 1) * PER_PAGE + i + 1}</td>
                          <td className={styles.urlCell} title={p.url}>{p.url}</td>
                          <td>{formatVolume(p.traffic)}</td>
                          <td>
                            <div className={styles.trafficBarWrap}>
                              <div className={styles.trafficBar}>
                                <div className={styles.trafficBarFill} style={{ width: `${Math.min(100, p.trafficPercent * 4)}%` }} />
                              </div>
                              <span className={styles.trafficBarLabel}>{p.trafficPercent}%</span>
                            </div>
                          </td>
                          <td>{formatVolume(p.keywords)}</td>
                          <td>
                            <span className={styles.kwCell}>{p.topKeyword}</span>
                            <span
                              className={styles.positionBadge}
                              style={{ backgroundColor: getPositionColor(p.topKeywordPosition) }}
                            >
                              {p.topKeywordPosition}
                            </span>
                          </td>
                          <td>{formatVolume(p.backlinks)}</td>
                          <td className={styles.sparklineCell}>
                            {p.trafficTrend && p.trafficTrend.length > 0 && (
                              <ResponsiveContainer width={60} height={24}>
                                <AreaChart data={p.trafficTrend.map((v, j) => ({ v, i: j }))}>
                                  <Area
                                    type="monotone"
                                    dataKey="v"
                                    stroke="#6366f1"
                                    fill="#6366f1"
                                    fillOpacity={0.15}
                                    strokeWidth={1.5}
                                    dot={false}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <span className={styles.pageInfo}>Page {page} of {totalPages} ({filtered.length} pages)</span>
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

export default function TopPagesPage() {
  return (
    <AuthGuard>
      <TopPagesContent />
    </AuthGuard>
  );
}
