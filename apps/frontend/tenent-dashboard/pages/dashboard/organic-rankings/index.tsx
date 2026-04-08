import { useState, useMemo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/Dialog';
import { AiInsights } from '@/components/ui/AiInsights';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useOrganicRankings } from '@/hooks/useOrganicRankings';
import { useDebounce } from '@/hooks/useDebounce';
import { formatVolume, formatCurrency, getPositionColor, getDifficultyColor, INTENT_COLORS, INTENT_LABELS, SERP_ABBREV } from '@/utils/seo-helpers';
import type {
  OrganicRankingsData,
  OrganicRankingPosition,
  OrganicRankingChange,
  ChangeType,
  SearchIntent,
} from '@/types/organic-rankings';
import styles from './index.module.css';

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });
const ScatterChart = dynamic(() => import('recharts').then((m) => m.ScatterChart), { ssr: false });
const Scatter = dynamic(() => import('recharts').then((m) => m.Scatter), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const ZAxis = dynamic(() => import('recharts').then((m) => m.ZAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });

type TabType = 'positions' | 'changes' | 'competitors' | 'pages';

// ─── Page Component ────────────────────────────────────────

function OrganicRankingsContent() {
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [country, setCountry] = useState('AU');
  const [showGuide, setShowGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('positions');

  // Positions tab state
  const [posSearch, setPosSearch] = useState('');
  const debouncedPosSearch = useDebounce(posSearch, 300);
  const [posMinPos, setPosMinPos] = useState('');
  const [posMaxPos, setPosMaxPos] = useState('');
  const [posMinVol, setPosMinVol] = useState('');
  const [posIntent, setPosIntent] = useState('');
  const [posSort, setPosSort] = useState<keyof OrganicRankingPosition>('trafficPercent');
  const [posSortOrder, setPosSortOrder] = useState<'asc' | 'desc'>('desc');
  const [posPage, setPosPage] = useState(1);

  // Changes tab state
  const [changeTypeFilter, setChangeTypeFilter] = useState('');

  const { data, isLoading, error } = useOrganicRankings(activeQuery, country);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveQuery(searchInput.trim());
      setActiveTab('positions');
      setPosPage(1);
    }
  };

  const handleSort = (col: keyof OrganicRankingPosition) => {
    if (posSort === col) {
      setPosSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setPosSort(col);
      setPosSortOrder('desc');
    }
    setPosPage(1);
  };

  // ─── Filtered & Sorted Positions ─────────────────────────
  const PER_PAGE = 25;

  const filteredPositions = useMemo(() => {
    if (!data?.positions) return [];
    let result = [...data.positions];

    if (debouncedPosSearch) {
      const q = debouncedPosSearch.toLowerCase();
      result = result.filter((p) => p.keyword.toLowerCase().includes(q));
    }
    if (posMinPos) result = result.filter((p) => p.position >= parseInt(posMinPos));
    if (posMaxPos) result = result.filter((p) => p.position <= parseInt(posMaxPos));
    if (posMinVol) result = result.filter((p) => p.volume >= parseInt(posMinVol));
    if (posIntent) result = result.filter((p) => p.intent === posIntent);

    result.sort((a, b) => {
      const aVal = a[posSort] ?? 0;
      const bVal = b[posSort] ?? 0;
      if (aVal < bVal) return posSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return posSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data?.positions, debouncedPosSearch, posMinPos, posMaxPos, posMinVol, posIntent, posSort, posSortOrder]);

  const totalPosPages = Math.ceil(filteredPositions.length / PER_PAGE);
  const paginatedPositions = filteredPositions.slice((posPage - 1) * PER_PAGE, posPage * PER_PAGE);

  // ─── Filtered Changes ────────────────────────────────────
  const filteredChanges = useMemo(() => {
    if (!data?.positionChanges) return [];
    if (!changeTypeFilter) return data.positionChanges;
    return data.positionChanges.filter((c) => c.changeType === changeTypeFilter);
  }, [data?.positionChanges, changeTypeFilter]);

  const renderSortArrow = (col: keyof OrganicRankingPosition) => {
    if (posSort !== col) return null;
    return <span className={styles.sortArrow}>{posSortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className={styles.layout}>
      <Head>
        <title>Organic Rankings | NR SEO</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>Organic Rankings</h1>
            <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="How to use this tool">?</button>
          </div>

          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Organic Rankings — Guide">
            <h4>What is Organic Rankings?</h4>
            <p>Discover what keywords any domain ranks for in Google organic search. See positions, traffic share, SERP features, competitors, and top pages — all from a single domain lookup.</p>

            <h4>How to use it</h4>
            <ul>
              <li><strong>Enter a domain</strong> — Type any domain and click Analyze.</li>
              <li><strong>Positions tab</strong> — See all keywords the domain ranks for, with position, volume, traffic %, intent, KD%, and SERP features. Sort by any column. Filter by keyword, position range, volume, or intent.</li>
              <li><strong>Position Changes tab</strong> — See which keywords improved, declined, were newly acquired, or lost. Filter by change type.</li>
              <li><strong>Competitors tab</strong> — See domains competing for the same keywords, with a scatter chart showing competitive positioning.</li>
              <li><strong>Pages tab</strong> — See which pages drive the most organic traffic.</li>
            </ul>

            <h4>Key metrics explained</h4>
            <ul>
              <li><strong>Position</strong> — Where the domain ranks in Google (1 = top result).</li>
              <li><strong>Traffic %</strong> — Share of the domain's total organic traffic from this keyword.</li>
              <li><strong>SERP Features</strong> — Special search results: FS=Featured Snippet, PAA=People Also Ask, SL=Sitelinks, IMG=Image Pack.</li>
              <li><strong>Intent (I/N/C/T)</strong> — Search intent: Informational, Navigational, Commercial, Transactional.</li>
            </ul>

            <h4>Pro tips</h4>
            <ul>
              <li>Use this on competitor domains to discover their keyword strategy.</li>
              <li>Look at "Position Changes" to spot competitors gaining or losing ground.</li>
              <li>Check the Pages tab to find which content types work best in your niche.</li>
            </ul>
          </GuideModal>

          {/* Search Form */}
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <input
              className={styles.searchInput}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter domain, subdomain or URL"
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

          {isLoading && <div className={styles.loadingState}>Analyzing organic rankings... this may take a moment.</div>}
          {error && !isLoading && (
            <div className={styles.errorState}>
              {(error as any)?.response?.data?.message || 'Failed to analyze domain. Please try again.'}
            </div>
          )}

          {data && !isLoading && (
            <>
              <AiInsights module="organic-rankings" context={{ domain: data.domain, totalKeywords: data.summary.totalOrganicKeywords, traffic: data.summary.organicMonthlyTraffic, positionsCount: data.positions.length, changesCount: data.positionChanges.length, competitorsCount: data.competitors.length }} />

              {/* Summary Metrics Bar */}
              <div className={styles.summaryBar}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Organic Keywords</div>
                  <div className={styles.summaryValue}>{formatVolume(data.summary.totalOrganicKeywords)}</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Monthly Traffic</div>
                  <div className={styles.summaryValue}>{formatVolume(data.summary.organicMonthlyTraffic)}</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Traffic Cost</div>
                  <div className={styles.summaryValue}>{formatCurrency(data.summary.organicTrafficCost)}</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Non-Branded</div>
                  <div className={styles.summaryValue}>{data.summary.nonBrandedTrafficPercent}%</div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className={styles.tabsRow}>
                {(['positions', 'changes', 'competitors', 'pages'] as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    className={activeTab === tab ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'positions' ? `Positions (${data.positions.length})`
                      : tab === 'changes' ? `Position Changes (${data.positionChanges.length})`
                      : tab === 'competitors' ? `Competitors (${data.competitors.length})`
                      : `Pages (${data.pages.length})`}
                  </button>
                ))}
              </div>

              {/* ─── Tab: Positions ───────────────────────── */}
              {activeTab === 'positions' && (
                <>
                  <div className={styles.filtersRow}>
                    <input
                      className={styles.filterInput}
                      type="text"
                      placeholder="Filter keywords..."
                      value={posSearch}
                      onChange={(e) => { setPosSearch(e.target.value); setPosPage(1); }}
                      style={{ minWidth: 180 }}
                    />
                    <input
                      className={styles.filterInput}
                      type="number"
                      placeholder="Min pos"
                      value={posMinPos}
                      onChange={(e) => { setPosMinPos(e.target.value); setPosPage(1); }}
                      style={{ width: 80 }}
                    />
                    <input
                      className={styles.filterInput}
                      type="number"
                      placeholder="Max pos"
                      value={posMaxPos}
                      onChange={(e) => { setPosMaxPos(e.target.value); setPosPage(1); }}
                      style={{ width: 80 }}
                    />
                    <input
                      className={styles.filterInput}
                      type="number"
                      placeholder="Min volume"
                      value={posMinVol}
                      onChange={(e) => { setPosMinVol(e.target.value); setPosPage(1); }}
                      style={{ width: 100 }}
                    />
                    <select
                      className={styles.filterSelect}
                      value={posIntent}
                      onChange={(e) => { setPosIntent(e.target.value); setPosPage(1); }}
                    >
                      <option value="">All Intents</option>
                      <option value="informational">Informational</option>
                      <option value="navigational">Navigational</option>
                      <option value="commercial">Commercial</option>
                      <option value="transactional">Transactional</option>
                    </select>
                  </div>

                  <div className={styles.tableSection}>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>#</th>
                            <th onClick={() => handleSort('keyword')}>Keyword{renderSortArrow('keyword')}</th>
                            <th onClick={() => handleSort('position')}>Pos{renderSortArrow('position')}</th>
                            <th onClick={() => handleSort('volume')}>Volume{renderSortArrow('volume')}</th>
                            <th onClick={() => handleSort('trafficPercent')}>Traffic %{renderSortArrow('trafficPercent')}</th>
                            <th onClick={() => handleSort('trafficCost')}>Cost{renderSortArrow('trafficCost')}</th>
                            <th>URL</th>
                            <th>SERP</th>
                            <th onClick={() => handleSort('intent')}>Intent{renderSortArrow('intent')}</th>
                            <th onClick={() => handleSort('kd')}>KD{renderSortArrow('kd')}</th>
                            <th onClick={() => handleSort('cpc')}>CPC{renderSortArrow('cpc')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedPositions.map((p, i) => (
                            <tr key={i}>
                              <td style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{(posPage - 1) * PER_PAGE + i + 1}</td>
                              <td className={styles.kwCell}>{p.keyword}</td>
                              <td>
                                <span className={styles.positionBadge} style={{ backgroundColor: getPositionColor(p.position) }}>
                                  {p.position}
                                </span>
                              </td>
                              <td>{formatVolume(p.volume)}</td>
                              <td>{p.trafficPercent}%</td>
                              <td>{formatCurrency(p.trafficCost)}</td>
                              <td className={styles.urlCell}>{p.url}</td>
                              <td>
                                <div className={styles.serpTags}>
                                  {p.serpFeatures.map((sf, j) => (
                                    <span key={j} className={styles.serpTag} title={sf}>
                                      {SERP_ABBREV[sf] || sf}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <span
                                  className={styles.intentBadge}
                                  style={{ backgroundColor: INTENT_COLORS[p.intent] || '#6b7280' }}
                                  title={p.intent}
                                >
                                  {INTENT_LABELS[p.intent] || '?'}
                                </span>
                              </td>
                              <td>
                                <span className={styles.kdBadge} style={{ backgroundColor: getDifficultyColor(p.kd) }}>
                                  {p.kd}
                                </span>
                              </td>
                              <td>${p.cpc.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPosPages > 1 && (
                      <div className={styles.pagination}>
                        <button className={styles.pageBtn} disabled={posPage <= 1} onClick={() => setPosPage((p) => p - 1)}>Previous</button>
                        <span className={styles.pageInfo}>Page {posPage} of {totalPosPages} ({filteredPositions.length} keywords)</span>
                        <button className={styles.pageBtn} disabled={posPage >= totalPosPages} onClick={() => setPosPage((p) => p + 1)}>Next</button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ─── Tab: Position Changes ────────────────── */}
              {activeTab === 'changes' && (
                <>
                  <div className={styles.filtersRow}>
                    <select
                      className={styles.filterSelect}
                      value={changeTypeFilter}
                      onChange={(e) => setChangeTypeFilter(e.target.value)}
                    >
                      <option value="">All Changes</option>
                      <option value="improved">Improved</option>
                      <option value="declined">Declined</option>
                      <option value="new">New</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>

                  <div className={styles.tableSection}>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Keyword</th>
                            <th>Type</th>
                            <th>Position</th>
                            <th>Change</th>
                            <th>Volume</th>
                            <th>URL</th>
                            <th>Traffic Impact</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredChanges.map((c, i) => (
                            <tr key={i}>
                              <td className={styles.kwCell}>{c.keyword}</td>
                              <td>
                                <span className={`${styles.changeBadge} ${
                                  c.changeType === 'improved' ? styles.changeImproved
                                    : c.changeType === 'declined' ? styles.changeDeclined
                                    : c.changeType === 'new' ? styles.changeNew
                                    : styles.changeLost
                                }`}>
                                  {c.changeType.toUpperCase()}
                                </span>
                              </td>
                              <td>
                                <span className={styles.posArrow}>
                                  {c.oldPosition !== null ? c.oldPosition : '--'}
                                  <span>→</span>
                                  {c.newPosition !== null ? c.newPosition : '--'}
                                </span>
                              </td>
                              <td>
                                {c.change !== 0 ? (
                                  <span className={`${styles.changeValue} ${c.change > 0 ? styles.changePositive : styles.changeNegative}`}>
                                    {c.change > 0 ? `+${c.change}` : c.change}
                                  </span>
                                ) : '--'}
                              </td>
                              <td>{formatVolume(c.volume)}</td>
                              <td className={styles.urlCell}>{c.url}</td>
                              <td>
                                <span className={`${styles.changeValue} ${c.trafficImpact >= 0 ? styles.changePositive : styles.changeNegative}`}>
                                  {c.trafficImpact >= 0 ? '+' : ''}{formatVolume(c.trafficImpact)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* ─── Tab: Competitors ─────────────────────── */}
              {activeTab === 'competitors' && (
                <>
                  {/* Competitive Positioning Map */}
                  {data.competitors.length > 0 && (
                    <div className={styles.chartSection}>
                      <div className={styles.chartTitle}>Competitive Positioning Map</div>
                      <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart>
                          <XAxis
                            type="number"
                            dataKey="seKeywords"
                            name="SE Keywords"
                            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                            axisLine={{ stroke: 'var(--border-primary)' }}
                            tickFormatter={(v: number) => formatVolume(v)}
                          />
                          <YAxis
                            type="number"
                            dataKey="seTraffic"
                            name="SE Traffic"
                            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                            axisLine={{ stroke: 'var(--border-primary)' }}
                            tickFormatter={(v: number) => formatVolume(v)}
                          />
                          <ZAxis
                            type="number"
                            dataKey="commonKeywords"
                            range={[40, 400]}
                            name="Common Keywords"
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => [formatVolume(value), name]}
                            contentStyle={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                          <Scatter
                            data={data.competitors}
                            fill="#6366f1"
                            fillOpacity={0.7}
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className={styles.tableSection}>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Domain</th>
                            <th>Common Keywords</th>
                            <th>SE Keywords</th>
                            <th>SE Traffic</th>
                            <th>Traffic Cost</th>
                            <th>Paid Keywords</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.competitors.map((comp, i) => (
                            <tr key={i}>
                              <td className={styles.kwCell}>{comp.domain}</td>
                              <td>{formatVolume(comp.commonKeywords)}</td>
                              <td>{formatVolume(comp.seKeywords)}</td>
                              <td>{formatVolume(comp.seTraffic)}</td>
                              <td>{formatCurrency(comp.trafficCost)}</td>
                              <td>{formatVolume(comp.paidKeywords)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* ─── Tab: Pages ───────────────────────────── */}
              {activeTab === 'pages' && (
                <div className={styles.tableSection}>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>URL</th>
                          <th>Traffic %</th>
                          <th>Keywords</th>
                          <th>Traffic</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.pages.map((page, i) => (
                          <tr key={i}>
                            <td className={styles.urlCell} style={{ maxWidth: 400 }}>{page.url}</td>
                            <td>
                              <div className={styles.trafficBarWrap}>
                                <div className={styles.trafficBar}>
                                  <div className={styles.trafficBarFill} style={{ width: `${Math.min(100, page.trafficPercent * 4)}%` }} />
                                </div>
                                <span className={styles.trafficBarLabel}>{page.trafficPercent}%</span>
                              </div>
                            </td>
                            <td>{formatVolume(page.keywords)}</td>
                            <td>{formatVolume(page.traffic)}</td>
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

export default function OrganicRankingsPage() {
  return (
    <AuthGuard>
      <OrganicRankingsContent />
    </AuthGuard>
  );
}
