import { useState, useMemo } from 'react';
import Head from 'next/head';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/GuideModal';
import { AiInsights } from '@/components/ui/AiInsights';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useKeywordGap } from '@/hooks/useKeywordGap';
import { useDebounce } from '@/hooks/useDebounce';
import { formatVolume, getPositionColor, getDifficultyColor, INTENT_COLORS, INTENT_LABELS, DOMAIN_COLORS } from '@/utils/seo-helpers';
import type { GapKeyword, GapType } from '@/types/keyword-gap';
import styles from './index.module.css';

const GAP_TYPES: { key: GapType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'shared', label: 'Shared' },
  { key: 'missing', label: 'Missing' },
  { key: 'weak', label: 'Weak' },
  { key: 'strong', label: 'Strong' },
  { key: 'untapped', label: 'Untapped' },
  { key: 'unique', label: 'Unique' },
];

const GAP_STYLES: Record<string, string> = {
  shared: styles.gapShared,
  missing: styles.gapMissing,
  weak: styles.gapWeak,
  strong: styles.gapStrong,
  untapped: styles.gapUntapped,
  unique: styles.gapUnique,
};

type SortCol = 'keyword' | 'volume' | 'kd' | 'cpc' | 'intent' | 'gapType';

// ─── Page Component ────────────────────────────────────────

function KeywordGapContent() {
  const [domainInputs, setDomainInputs] = useState<string[]>(['', '']);
  const [activeQuery, setActiveQuery] = useState('');
  const [country, setCountry] = useState('AU');
  const [showGuide, setShowGuide] = useState(false);

  // Filters
  const [activeGapType, setActiveGapType] = useState<GapType | 'all'>('all');
  const [kwSearch, setKwSearch] = useState('');
  const debouncedKwSearch = useDebounce(kwSearch, 300);
  const [intentFilter, setIntentFilter] = useState('');
  const [minVolume, setMinVolume] = useState('');
  const [maxKd, setMaxKd] = useState('');

  // Sort + pagination
  const [sortCol, setSortCol] = useState<SortCol>('volume');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const { data, isLoading, error } = useKeywordGap(activeQuery, country);

  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    const filled = domainInputs.filter((d) => d.trim());
    if (filled.length >= 2) {
      setActiveQuery(filled.map((d) => d.trim()).join(','));
      setActiveGapType('all');
      setPage(1);
    }
  };

  const updateInput = (i: number, val: string) => {
    const next = [...domainInputs];
    next[i] = val;
    setDomainInputs(next);
  };

  const addInput = () => {
    if (domainInputs.length < 5) setDomainInputs([...domainInputs, '']);
  };

  const removeInput = (i: number) => {
    if (domainInputs.length > 2) setDomainInputs(domainInputs.filter((_, j) => j !== i));
  };

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortOrder('desc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    if (!data?.keywords) return [];
    let result = [...data.keywords];

    if (activeGapType !== 'all') result = result.filter((k) => k.gapType === activeGapType);
    if (debouncedKwSearch) { const q = debouncedKwSearch.toLowerCase(); result = result.filter((k) => k.keyword.toLowerCase().includes(q)); }
    if (intentFilter) result = result.filter((k) => k.intent === intentFilter);
    if (minVolume) result = result.filter((k) => k.volume >= parseInt(minVolume));
    if (maxKd) result = result.filter((k) => k.kd <= parseInt(maxKd));

    result.sort((a, b) => {
      const av = a[sortCol] ?? '';
      const bv = b[sortCol] ?? '';
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data?.keywords, activeGapType, debouncedKwSearch, intentFilter, minVolume, maxKd, sortCol, sortOrder]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const filledCount = domainInputs.filter((d) => d.trim()).length;

  const renderSortArrow = (col: SortCol) => {
    if (sortCol !== col) return null;
    return <span className={styles.sortArrow}>{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  // Find best (lowest non-null) position per keyword row
  const getBestPosition = (positions: Record<string, number | null>): number | null => {
    const vals = Object.values(positions).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.min(...vals) : null;
  };

  return (
    <div className={styles.layout}>
      <Head>
        <title>Keyword Gap | NR SEO</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>Keyword Gap</h1>
            <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="How to use this tool">?</button>
          </div>

          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Keyword Gap — Guide">
            <h4>What is Keyword Gap?</h4>
            <p>Discover which keywords your competitors rank for that you don't. Enter your domain + up to 4 competitors and see a keyword-by-keyword comparison with gap type classification.</p>

            <h4>How to use it</h4>
            <ul>
              <li><strong>Enter your domain first</strong> — The first field is "You". All gap types are relative to your domain.</li>
              <li><strong>Add competitors</strong> — Enter 1-4 competitor domains.</li>
              <li><strong>Click Compare</strong> — The tool classifies every keyword into a gap type.</li>
              <li><strong>Use gap tabs</strong> — Click Missing, Weak, Strong, etc. to filter the table.</li>
              <li><strong>Apply filters</strong> — Narrow by keyword text, intent, volume, or KD%.</li>
            </ul>

            <h4>Gap types explained</h4>
            <ul>
              <li><strong>Shared</strong> — All domains rank for this keyword.</li>
              <li><strong>Missing</strong> — All competitors rank but you don't. <em>Create content for these!</em></li>
              <li><strong>Weak</strong> — You rank lower than all competitors. <em>Optimize existing pages.</em></li>
              <li><strong>Strong</strong> — You rank higher than all competitors. <em>Your strengths — protect them.</em></li>
              <li><strong>Untapped</strong> — You don't rank but at least 1 competitor does. <em>New opportunities.</em></li>
              <li><strong>Unique</strong> — Only you rank. <em>Your competitive advantage.</em></li>
            </ul>

            <h4>Pro tips</h4>
            <ul>
              <li>Start with "Missing" keywords — these are your biggest content gaps.</li>
              <li>Filter by Transactional intent + low KD% for quick revenue wins.</li>
              <li>The green-ringed position badge shows who ranks best for each keyword.</li>
            </ul>
          </GuideModal>

          {/* Domain Inputs */}
          <form className={styles.inputsForm} onSubmit={handleCompare}>
            {domainInputs.map((val, i) => (
              <div key={i} className={styles.inputGroup}>
                <span className={styles.colorDot} style={{ backgroundColor: DOMAIN_COLORS[i] }} />
                <span className={styles.inputLabel}>{i === 0 ? 'Your Domain' : `Competitor ${i}`}</span>
                <input
                  className={styles.domainInput}
                  type="text"
                  value={val}
                  onChange={(e) => updateInput(i, e.target.value)}
                  placeholder={i === 0 ? 'yourdomain.com' : `competitor${i}.com`}
                />
                {i > 1 && (
                  <button type="button" className={styles.removeBtn} onClick={() => removeInput(i)}>×</button>
                )}
              </div>
            ))}
            <div className={styles.actionsRow}>
              <button type="button" className={styles.addBtn} onClick={addInput} disabled={domainInputs.length >= 5}>
                + Add Competitor
              </button>
              <select className={styles.countrySelect} value={country} onChange={(e) => setCountry(e.target.value)}>
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
              <button className={styles.compareBtn} type="submit" disabled={filledCount < 2 || isLoading}>
                {isLoading ? 'Analyzing...' : 'Compare'}
              </button>
            </div>
          </form>

          {isLoading && <div className={styles.loadingState}>Analyzing keyword gap... this may take a moment.</div>}
          {error && !isLoading && (
            <div className={styles.errorState}>
              {(error as any)?.response?.data?.message || 'Failed to analyze keyword gap. Please try again.'}
            </div>
          )}

          {data && !isLoading && (
            <>
              <AiInsights module="keyword-gap" context={{ domains: data.domains, summary: data.summary, topMissing: data.keywords.filter((k) => k.gapType === 'missing').slice(0, 3).map((k) => k.keyword), topWeak: data.keywords.filter((k) => k.gapType === 'weak').slice(0, 3).map((k) => k.keyword) }} />

              {/* Summary Cards */}
              <div className={styles.summaryGrid}>
                {GAP_TYPES.map((gt) => {
                  const count = gt.key === 'all' ? data.summary.totalKeywords : (data.summary as any)[gt.key];
                  return (
                    <div
                      key={gt.key}
                      className={activeGapType === gt.key ? styles.summaryCardActive : styles.summaryCard}
                      onClick={() => { setActiveGapType(gt.key as any); setPage(1); }}
                    >
                      <div className={styles.summaryCardLabel}>{gt.label}</div>
                      <div className={styles.summaryCardValue}>{formatVolume(count)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Filters */}
              <div className={styles.filtersRow}>
                <input
                  className={styles.filterInput}
                  type="text"
                  placeholder="Filter keywords..."
                  value={kwSearch}
                  onChange={(e) => { setKwSearch(e.target.value); setPage(1); }}
                  style={{ minWidth: 180 }}
                />
                <select
                  className={styles.filterSelect}
                  value={intentFilter}
                  onChange={(e) => { setIntentFilter(e.target.value); setPage(1); }}
                >
                  <option value="">All Intents</option>
                  <option value="informational">Informational</option>
                  <option value="navigational">Navigational</option>
                  <option value="commercial">Commercial</option>
                  <option value="transactional">Transactional</option>
                </select>
                <input
                  className={styles.filterInput}
                  type="number"
                  placeholder="Min volume"
                  value={minVolume}
                  onChange={(e) => { setMinVolume(e.target.value); setPage(1); }}
                  style={{ width: 100 }}
                />
                <input
                  className={styles.filterInput}
                  type="number"
                  placeholder="Max KD%"
                  value={maxKd}
                  onChange={(e) => { setMaxKd(e.target.value); setPage(1); }}
                  style={{ width: 90 }}
                />
              </div>

              {/* Gap Type Tabs */}
              <div className={styles.gapTabs}>
                {GAP_TYPES.map((gt) => {
                  const count = gt.key === 'all' ? data.keywords.length : data.keywords.filter((k) => k.gapType === gt.key).length;
                  return (
                    <button
                      key={gt.key}
                      className={activeGapType === gt.key ? styles.gapTabActive : styles.gapTab}
                      onClick={() => { setActiveGapType(gt.key as any); setPage(1); }}
                    >
                      {gt.label}
                      <span className={styles.gapTabCount}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Keyword Table */}
              <div className={styles.tableSection}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th onClick={() => handleSort('keyword')}>Keyword{renderSortArrow('keyword')}</th>
                        <th onClick={() => handleSort('volume')}>Volume{renderSortArrow('volume')}</th>
                        <th onClick={() => handleSort('kd')}>KD{renderSortArrow('kd')}</th>
                        <th onClick={() => handleSort('cpc')}>CPC{renderSortArrow('cpc')}</th>
                        <th onClick={() => handleSort('intent')}>Intent{renderSortArrow('intent')}</th>
                        {data.domains.map((dm, i) => (
                          <th key={dm} style={{ color: DOMAIN_COLORS[i] }}>
                            {dm.length > 15 ? dm.slice(0, 15) + '...' : dm}
                          </th>
                        ))}
                        <th onClick={() => handleSort('gapType')}>Gap{renderSortArrow('gapType')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((kw, i) => {
                        const bestPos = getBestPosition(kw.positions);
                        return (
                          <tr key={i}>
                            <td className={styles.kwCell}>{kw.keyword}</td>
                            <td>{formatVolume(kw.volume)}</td>
                            <td>
                              <span className={styles.kdBadge} style={{ backgroundColor: getDifficultyColor(kw.kd) }}>
                                {kw.kd}
                              </span>
                            </td>
                            <td>${kw.cpc.toFixed(2)}</td>
                            <td>
                              <span
                                className={styles.intentBadge}
                                style={{ backgroundColor: INTENT_COLORS[kw.intent] || '#6b7280' }}
                                title={kw.intent}
                              >
                                {INTENT_LABELS[kw.intent] || '?'}
                              </span>
                            </td>
                            {data.domains.map((dm) => {
                              const pos = kw.positions?.[dm];
                              const isBest = pos !== null && pos !== undefined && pos === bestPos;
                              return (
                                <td key={dm}>
                                  {pos !== null && pos !== undefined ? (
                                    <span
                                      className={isBest ? styles.positionBest : styles.positionBadge}
                                      style={{ backgroundColor: getPositionColor(pos) }}
                                    >
                                      {pos}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-tertiary)' }}>--</span>
                                  )}
                                </td>
                              );
                            })}
                            <td>
                              <span className={`${styles.gapBadge} ${GAP_STYLES[kw.gapType] || ''}`}>
                                {kw.gapType}
                              </span>
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
                    <span className={styles.pageInfo}>Page {page} of {totalPages} ({filtered.length} keywords)</span>
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

export default function KeywordGapPage() {
  return (
    <AuthGuard>
      <KeywordGapContent />
    </AuthGuard>
  );
}
