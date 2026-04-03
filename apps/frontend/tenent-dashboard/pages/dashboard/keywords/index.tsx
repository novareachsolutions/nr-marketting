import { useState, FormEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProjects } from '@/hooks/useProjects';
import {
  useKeywordSearch,
  useKeywordSuggestions,
  useSaveKeyword,
} from '@/hooks/useKeywords';
import { showSuccessToast } from '@repo/shared-frontend';
import type { KeywordSuggestion, SearchIntent, SuggestionFilters } from '@/types/keyword';
import styles from './index.module.css';

function getDifficultyColor(d: number | null): string {
  if (d === null) return 'var(--text-tertiary)';
  if (d < 25) return '#22c55e';
  if (d < 50) return '#eab308';
  if (d < 75) return '#f97316';
  return '#ef4444';
}

function getDifficultyLabel(d: number | null): string {
  if (d === null) return '--';
  if (d < 25) return 'Easy';
  if (d < 50) return 'Medium';
  if (d < 75) return 'Hard';
  return 'Very Hard';
}

function formatVolume(v: number | null): string {
  if (v === null) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toString();
}

const INTENT_COLORS: Record<SearchIntent, string> = {
  INFORMATIONAL: '#3b82f6',
  NAVIGATIONAL: '#8b5cf6',
  COMMERCIAL: '#f59e0b',
  TRANSACTIONAL: '#22c55e',
};

const INTENT_LABELS: Record<SearchIntent, string> = {
  INFORMATIONAL: 'I',
  NAVIGATIONAL: 'N',
  COMMERCIAL: 'C',
  TRANSACTIONAL: 'T',
};

type MatchType = 'broad' | 'phrase' | 'exact' | 'questions';

function KeywordResearchContent() {
  const queryClient = useQueryClient();
  const { data: projects } = useProjects();
  const saveKeyword = useSaveKeyword();

  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [country, setCountry] = useState('AU');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sugPage, setSugPage] = useState(1);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [savingKeyword, setSavingKeyword] = useState<string | null>(null);

  // Filter state
  const [matchType, setMatchType] = useState<MatchType>('broad');
  const [showFilters, setShowFilters] = useState(false);
  const [filterIntent, setFilterIntent] = useState<string>('');
  const [filterMinVolume, setFilterMinVolume] = useState('');
  const [filterMaxKd, setFilterMaxKd] = useState('');
  const [filterMinWords, setFilterMinWords] = useState('');
  const [filterInclude, setFilterInclude] = useState('');
  const [filterExclude, setFilterExclude] = useState('');

  // Build filters object
  const filters: SuggestionFilters = {};
  if (matchType !== 'broad') filters.matchType = matchType;
  if (filterIntent) filters.intent = filterIntent as SearchIntent;
  if (filterMinVolume) filters.minVolume = parseInt(filterMinVolume, 10);
  if (filterMaxKd) filters.maxKd = parseInt(filterMaxKd, 10);
  if (filterMinWords) filters.minWords = parseInt(filterMinWords, 10);
  if (filterInclude) filters.includeWords = filterInclude;
  if (filterExclude) filters.excludeWords = filterExclude;

  const hasActiveFilters = Object.keys(filters).length > 0;

  const { data: keywordData, isLoading: isSearching } = useKeywordSearch(
    activeQuery,
    country,
  );

  const { data: suggestionsData, isLoading: isLoadingSuggestions } =
    useKeywordSuggestions(activeQuery, country, 50, sugPage, showSuggestions, hasActiveFilters ? filters : undefined);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setActiveQuery(searchInput.trim());
    setShowSuggestions(false);
    setSugPage(1);
  };

  const handleGetSuggestions = () => {
    setShowSuggestions(true);
    setSugPage(1);
  };

  const clearFilters = () => {
    setMatchType('broad');
    setFilterIntent('');
    setFilterMinVolume('');
    setFilterMaxKd('');
    setFilterMinWords('');
    setFilterInclude('');
    setFilterExclude('');
  };

  const resolveProjectId = (): string | null => {
    if (selectedProjectId) return selectedProjectId;
    if (projects && projects.length === 1) return projects[0].id;
    return null;
  };

  const handleSave = async (keyword: string) => {
    const pid = resolveProjectId();
    if (!pid) return;
    setSavingKeyword(keyword);
    try {
      await saveKeyword.mutateAsync({
        url: `/projects/${pid}/keywords`,
        body: { keyword },
      });
      showSuccessToast('Saved', `"${keyword}" added to project`);
      queryClient.invalidateQueries({ queryKey: ['project-keywords'] });
    } catch {
      // handled by global toast
    } finally {
      setSavingKeyword(null);
    }
  };

  const needsProjectSelector = projects && projects.length > 1 && !selectedProjectId;

  return (
    <>
      <Head>
        <title>Keyword Research — NR SEO Platform</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24 }}>Keyword Research</h1>

          {/* Search Bar */}
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Enter a keyword to research..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <select
              className={styles.countrySelect}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="AU">Australia</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="IN">India</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="ES">Spain</option>
              <option value="IT">Italy</option>
              <option value="BR">Brazil</option>
              <option value="JP">Japan</option>
            </select>
            <button type="submit" className={styles.searchBtn} disabled={!searchInput.trim() || isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Project Selector */}
          {projects && projects.length > 1 && (
            <div className={styles.projectSelector}>
              <label className={styles.projectLabel}>Save keywords to:</label>
              <select className={styles.projectSelect} value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.domain})</option>
                ))}
              </select>
            </div>
          )}

          {/* Keyword Card */}
          {keywordData && (
            <div className={styles.keywordCard}>
              <div className={styles.keywordHeader}>
                <h2 className={styles.keywordTitle}>{keywordData.keyword}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Intent Badge */}
                  <span
                    className={styles.intentBadge}
                    style={{ backgroundColor: INTENT_COLORS[keywordData.intent] }}
                    title={keywordData.intent}
                  >
                    {INTENT_LABELS[keywordData.intent]}
                  </span>
                  <span className={styles.keywordCountry}>{keywordData.country}</span>
                </div>
              </div>

              <div className={styles.metricsRow}>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Search Volume</span>
                  <span className={styles.metricValue}>{formatVolume(keywordData.searchVolume)}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Difficulty</span>
                  <div className={styles.difficultyWrap}>
                    <span className={styles.difficultyBadge} style={{ backgroundColor: getDifficultyColor(keywordData.difficulty) }}>
                      {keywordData.difficulty ?? '--'}
                    </span>
                    <span className={styles.difficultyText} style={{ color: getDifficultyColor(keywordData.difficulty) }}>
                      {getDifficultyLabel(keywordData.difficulty)}
                    </span>
                  </div>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>CPC</span>
                  <span className={styles.metricValue}>
                    {keywordData.cpc !== null ? `$${keywordData.cpc.toFixed(2)}` : '--'}
                  </span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Intent</span>
                  <span className={styles.metricValue} style={{ color: INTENT_COLORS[keywordData.intent], fontSize: 13 }}>
                    {keywordData.intent}
                  </span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Priority</span>
                  <span className={styles.metricValue}>{keywordData.priorityScore}</span>
                </div>
              </div>

              {/* Trend */}
              {keywordData.trend && keywordData.trend.length > 0 && (
                <div className={styles.trendSection}>
                  <span className={styles.metricLabel}>12-Month Trend</span>
                  <div className={styles.trendBars}>
                    {keywordData.trend.map((vol, i) => {
                      const max = Math.max(...(keywordData.trend || [1]));
                      const height = max > 0 ? (vol / max) * 100 : 0;
                      return (
                        <div key={i} className={styles.trendBar} style={{ height: `${Math.max(height, 4)}%` }} title={`${vol.toLocaleString()} searches`} />
                      );
                    })}
                  </div>
                </div>
              )}

              <div className={styles.keywordActions}>
                <button className={styles.suggestionsBtn} onClick={handleGetSuggestions} disabled={isLoadingSuggestions}>
                  {isLoadingSuggestions ? 'Loading...' : 'Get Suggestions'}
                </button>
                <button
                  className={styles.saveBtn}
                  onClick={() => handleSave(keywordData.keyword)}
                  disabled={savingKeyword === keywordData.keyword || (!resolveProjectId() && needsProjectSelector)}
                >
                  {savingKeyword === keywordData.keyword ? 'Saving...' : 'Save Keyword'}
                </button>
              </div>
            </div>
          )}

          {/* Suggestions Section */}
          {showSuggestions && (
            <div className={styles.suggestionsSection}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  Related Keywords {suggestionsData ? `(${suggestionsData.total})` : ''}
                </h3>
                <button
                  className={styles.filterToggle}
                  onClick={() => setShowFilters(!showFilters)}
                  style={{ color: hasActiveFilters ? 'var(--accent-primary)' : undefined }}
                >
                  {showFilters ? 'Hide Filters' : 'Filters'} {hasActiveFilters ? '(active)' : ''}
                </button>
              </div>

              {/* Match Type Tabs */}
              <div className={styles.matchTabs}>
                {(['broad', 'phrase', 'exact', 'questions'] as MatchType[]).map((mt) => (
                  <button
                    key={mt}
                    className={`${styles.matchTab} ${matchType === mt ? styles.matchTabActive : ''}`}
                    onClick={() => { setMatchType(mt); setSugPage(1); }}
                  >
                    {mt.charAt(0).toUpperCase() + mt.slice(1)}
                  </button>
                ))}
              </div>

              {/* Filters Panel */}
              {showFilters && (
                <div className={styles.filtersPanel}>
                  <div className={styles.filterRow}>
                    <div className={styles.filterGroup}>
                      <label>Intent</label>
                      <select value={filterIntent} onChange={(e) => { setFilterIntent(e.target.value); setSugPage(1); }}>
                        <option value="">All</option>
                        <option value="INFORMATIONAL">Informational</option>
                        <option value="COMMERCIAL">Commercial</option>
                        <option value="TRANSACTIONAL">Transactional</option>
                        <option value="NAVIGATIONAL">Navigational</option>
                      </select>
                    </div>
                    <div className={styles.filterGroup}>
                      <label>Min Volume</label>
                      <input type="number" placeholder="0" value={filterMinVolume} onChange={(e) => { setFilterMinVolume(e.target.value); setSugPage(1); }} />
                    </div>
                    <div className={styles.filterGroup}>
                      <label>Max KD%</label>
                      <input type="number" placeholder="100" value={filterMaxKd} onChange={(e) => { setFilterMaxKd(e.target.value); setSugPage(1); }} />
                    </div>
                    <div className={styles.filterGroup}>
                      <label>Min Words</label>
                      <input type="number" placeholder="1" value={filterMinWords} onChange={(e) => { setFilterMinWords(e.target.value); setSugPage(1); }} />
                    </div>
                  </div>
                  <div className={styles.filterRow}>
                    <div className={styles.filterGroup} style={{ flex: 1 }}>
                      <label>Include Words (comma-separated)</label>
                      <input type="text" placeholder="e.g. best, guide" value={filterInclude} onChange={(e) => { setFilterInclude(e.target.value); setSugPage(1); }} />
                    </div>
                    <div className={styles.filterGroup} style={{ flex: 1 }}>
                      <label>Exclude Words (comma-separated)</label>
                      <input type="text" placeholder="e.g. free, cheap" value={filterExclude} onChange={(e) => { setFilterExclude(e.target.value); setSugPage(1); }} />
                    </div>
                    <button className={styles.clearFiltersBtn} onClick={clearFilters}>Clear All</button>
                  </div>
                </div>
              )}

              {/* Clusters sidebar (if available) */}
              {suggestionsData?.clusters && Object.keys(suggestionsData.clusters).length > 0 && (
                <div className={styles.clustersBar}>
                  <span className={styles.clustersLabel}>Topic Groups:</span>
                  {Object.entries(suggestionsData.clusters).slice(0, 12).map(([group, kws]) => (
                    <button
                      key={group}
                      className={styles.clusterTag}
                      onClick={() => { setFilterInclude(group); setSugPage(1); }}
                      title={`${kws.length} keywords`}
                    >
                      {group} ({kws.length})
                    </button>
                  ))}
                </div>
              )}

              {/* Suggestions Table */}
              {isLoadingSuggestions ? (
                <div className={styles.loadingState}>Loading suggestions...</div>
              ) : suggestionsData && suggestionsData.keywords.length > 0 ? (
                <>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Keyword</th>
                          <th>Intent</th>
                          <th>Volume</th>
                          <th>KD%</th>
                          <th>CPC</th>
                          <th>Priority</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suggestionsData.keywords.map((kw: KeywordSuggestion, idx: number) => (
                          <tr key={idx}>
                            <td className={styles.kwCell}>
                              {kw.keyword}
                              {kw.isQuestion && <span className={styles.questionTag}>Q</span>}
                            </td>
                            <td>
                              <span
                                className={styles.intentBadgeSm}
                                style={{ backgroundColor: INTENT_COLORS[kw.intent] }}
                                title={kw.intent}
                              >
                                {INTENT_LABELS[kw.intent]}
                              </span>
                            </td>
                            <td>{formatVolume(kw.searchVolume)}</td>
                            <td>
                              <span className={styles.difficultyDot} style={{ backgroundColor: getDifficultyColor(kw.difficulty) }} />
                              {kw.difficulty ?? '--'}
                            </td>
                            <td>{kw.cpc !== null ? `$${kw.cpc.toFixed(2)}` : '--'}</td>
                            <td>
                              <span className={styles.priorityBadge}>{kw.priorityScore}</span>
                            </td>
                            <td>
                              <button
                                className={styles.tableSaveBtn}
                                onClick={() => handleSave(kw.keyword)}
                                disabled={savingKeyword === kw.keyword || (!resolveProjectId() && needsProjectSelector)}
                              >
                                {savingKeyword === kw.keyword ? '...' : 'Save'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {suggestionsData.total > 50 && (
                    <div className={styles.pagination}>
                      <button className={styles.pageBtn} disabled={sugPage <= 1} onClick={() => setSugPage((p) => p - 1)}>Previous</button>
                      <span className={styles.pageInfo}>Page {sugPage} of {Math.ceil(suggestionsData.total / 50)}</span>
                      <button className={styles.pageBtn} disabled={sugPage >= Math.ceil(suggestionsData.total / 50)} onClick={() => setSugPage((p) => p + 1)}>Next</button>
                    </div>
                  )}
                </>
              ) : suggestionsData ? (
                <div className={styles.emptyState}>No suggestions found {hasActiveFilters ? 'matching your filters' : 'for this keyword'}.</div>
              ) : null}
            </div>
          )}

          {/* Loading State */}
          {isSearching && <div className={styles.loadingState}>Searching keyword data...</div>}
        </main>
      </div>
    </>
  );
}

export default function KeywordResearchPage() {
  return (
    <AuthGuard>
      <KeywordResearchContent />
    </AuthGuard>
  );
}
