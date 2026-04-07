import { useState, FormEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/GuideModal';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { useProject } from '@/hooks/useProjects';
import {
  useProjectKeywords,
  useRemoveKeyword,
  useKeywordSearch,
  useKeywordSuggestions,
  useSaveKeyword,
} from '@/hooks/useKeywords';
import { showSuccessToast } from '@repo/shared-frontend';
import type { KeywordSuggestion, SearchIntent } from '@/types/keyword';
import styles from './keywords.module.css';

function getDifficultyColor(d: number | null): string {
  if (d === null) return 'var(--text-tertiary)';
  if (d < 25) return '#22c55e';
  if (d < 50) return '#eab308';
  if (d < 75) return '#f97316';
  return '#ef4444';
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

function SuggestionsTable({ title, keywords, savingKeyword, onSave }: {
  title: string;
  keywords: KeywordSuggestion[];
  savingKeyword: string | null;
  onSave: (keyword: string) => void;
}) {
  return (
    <div className={styles.suggestionsCard}>
      <h4 className={styles.suggestionsTitle}>{title}</h4>
      <table className={styles.sugTable}>
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Intent</th>
            <th>Volume</th>
            <th>KD%</th>
            <th>CPC</th>
            <th>Priority</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((kw, i) => (
            <tr key={i}>
              <td className={styles.kwCell}>
                {kw.keyword}
                {kw.isQuestion && <span className={styles.qTag}>Q</span>}
              </td>
              <td>
                <span className={styles.intentTag} style={{ backgroundColor: INTENT_COLORS[kw.intent] }}>
                  {INTENT_LABELS[kw.intent]}
                </span>
              </td>
              <td>{formatVolume(kw.searchVolume)}</td>
              <td>
                <span style={{ color: getDifficultyColor(kw.difficulty) }}>{kw.difficulty ?? '--'}</span>
              </td>
              <td>{kw.cpc !== null ? `$${kw.cpc.toFixed(2)}` : '--'}</td>
              <td><strong>{kw.priorityScore}</strong></td>
              <td>
                <button
                  className={styles.saveBtnSm}
                  onClick={() => onSave(kw.keyword)}
                  disabled={savingKeyword === kw.keyword}
                >
                  {savingKeyword === kw.keyword ? '...' : 'Save'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectKeywordsContent() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useProject(id);
  const [page, setPage] = useState(1);
  const [showGuide, setShowGuide] = useState(false);
  const { data: kwData, isLoading: kwLoading } = useProjectKeywords(id, page);
  const removeKeyword = useRemoveKeyword();
  const saveKeyword = useSaveKeyword();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingKeyword, setSavingKeyword] = useState<string | null>(null);

  // Inline research state
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showDomainSuggestions, setShowDomainSuggestions] = useState(false);

  // Domain-based suggestion: use project domain as seed keyword
  const domainSeed = project?.domain
    ? project.domain.replace(/\.(com|org|net|io|co|au|uk|com\.au)$/i, '').replace(/^www\./, '').replace(/[-_.]/g, ' ').trim()
    : '';

  const { data: domainSuggestionsData, isLoading: isDomainLoading } =
    useKeywordSuggestions(domainSeed, 'US', 10, 1, showDomainSuggestions && !!domainSeed);

  const { data: searchData, isLoading: isSearching } = useKeywordSearch(activeQuery, 'US');

  const { data: searchSuggestionsData, isLoading: isSugLoading } =
    useKeywordSuggestions(activeQuery, 'US', 10, 1, showSuggestions && !!activeQuery);

  const handleDelete = async (keywordId: string) => {
    setDeletingId(keywordId);
    try {
      await removeKeyword.mutateAsync(`/projects/${id}/keywords/${keywordId}`);
      showSuccessToast('Removed', 'Keyword removed from project');
      queryClient.invalidateQueries({ queryKey: ['project-keywords', id] });
    } catch {
      // handled by global toast
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async (keyword: string) => {
    setSavingKeyword(keyword);
    try {
      await saveKeyword.mutateAsync({
        url: `/projects/${id}/keywords`,
        body: { keyword },
      });
      showSuccessToast('Saved', `"${keyword}" added to project`);
      queryClient.invalidateQueries({ queryKey: ['project-keywords', id] });
    } catch {
      // handled by global toast
    } finally {
      setSavingKeyword(null);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setActiveQuery(searchInput.trim());
    setShowSuggestions(false);
  };

  if (projectLoading || !project) {
    return <div className={styles.loading}>Loading project...</div>;
  }

  return (
    <>
      <Head>
        <title>Keywords — {project.name} — NR SEO Platform</title>
      </Head>
      <Sidebar projectId={id} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.pageHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 className={styles.pageTitle}>
                Saved Keywords
                {kwData && (
                  <span className={styles.countBadge}>{kwData.total}</span>
                )}
              </h1>
              <button onClick={() => setShowGuide(true)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="How to use this tool">?</button>
            </div>
            <Link href="/dashboard/keywords" className={styles.researchBtn}>
              Keyword Research
            </Link>
          </div>

          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Project Keywords — Guide">
            <h4>What are Project Keywords?</h4>
            <p>This is your project's keyword library. Keywords you save here form the foundation of your SEO strategy for this domain.</p>

            <h4>How to use it</h4>
            <ul>
              <li><strong>Search & save</strong> — Use the inline search bar to find keywords. Click Save to add them to your project.</li>
              <li><strong>Domain suggestions</strong> — Click "Suggest for domain" to get keyword ideas based on your project's domain name.</li>
              <li><strong>Manage keywords</strong> — View all saved keywords with their metrics. Remove keywords you no longer need.</li>
              <li><strong>Go to Keyword Research</strong> — Click the button to access the full keyword research tool.</li>
            </ul>

            <h4>Pro tips</h4>
            <ul>
              <li>Save 10-20 core keywords per project to build your tracking list.</li>
              <li>Use domain suggestions to discover keywords you might be missing.</li>
              <li>Saved keywords can be imported into Position Tracking for daily rank monitoring.</li>
            </ul>
          </GuideModal>

          {/* Inline Keyword Research */}
          <div className={styles.researchSection}>
            <form className={styles.inlineSearch} onSubmit={handleSearch}>
              <input
                className={styles.inlineInput}
                type="text"
                placeholder={`Search keywords for ${project.domain}...`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button type="submit" className={styles.inlineSearchBtn} disabled={!searchInput.trim() || isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </button>
              <button
                type="button"
                className={styles.domainSuggestBtn}
                onClick={() => setShowDomainSuggestions(true)}
                disabled={isDomainLoading || !domainSeed}
              >
                {isDomainLoading ? 'Loading...' : `Suggest for ${project.domain}`}
              </button>
            </form>

            {/* Search result card */}
            {searchData && (
              <div className={styles.searchResultCard}>
                <div className={styles.searchResultHeader}>
                  <strong>{searchData.keyword}</strong>
                  <span className={styles.intentTag} style={{ backgroundColor: INTENT_COLORS[searchData.intent] }}>
                    {INTENT_LABELS[searchData.intent]}
                  </span>
                </div>
                <div className={styles.searchResultMetrics}>
                  <span>Vol: <strong>{formatVolume(searchData.searchVolume)}</strong></span>
                  <span>KD: <strong style={{ color: getDifficultyColor(searchData.difficulty) }}>{searchData.difficulty ?? '--'}</strong></span>
                  <span>CPC: <strong>{searchData.cpc !== null ? `$${searchData.cpc.toFixed(2)}` : '--'}</strong></span>
                  <span>Priority: <strong>{searchData.priorityScore}</strong></span>
                </div>
                <div className={styles.searchResultActions}>
                  <button className={styles.saveBtnSm} onClick={() => handleSave(searchData.keyword)} disabled={savingKeyword === searchData.keyword}>
                    {savingKeyword === searchData.keyword ? 'Saving...' : 'Save'}
                  </button>
                  <button className={styles.suggestBtnSm} onClick={() => setShowSuggestions(true)} disabled={isSugLoading}>
                    {isSugLoading ? 'Loading...' : 'Get Suggestions'}
                  </button>
                </div>
              </div>
            )}

            {/* Search suggestions */}
            {showSuggestions && searchSuggestionsData && searchSuggestionsData.keywords.length > 0 && (
              <SuggestionsTable
                title={`Suggestions for "${activeQuery}"`}
                keywords={searchSuggestionsData.keywords}
                savingKeyword={savingKeyword}
                onSave={handleSave}
              />
            )}

            {/* Domain-based suggestions */}
            {showDomainSuggestions && domainSuggestionsData && domainSuggestionsData.keywords.length > 0 && (
              <SuggestionsTable
                title={`Suggested keywords for ${project.domain}`}
                keywords={domainSuggestionsData.keywords}
                savingKeyword={savingKeyword}
                onSave={handleSave}
              />
            )}
          </div>

          {kwLoading ? (
            <div className={styles.loading}>Loading keywords...</div>
          ) : kwData && kwData.keywords.length > 0 ? (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Keyword</th>
                      <th>Target URL</th>
                      <th>Notes</th>
                      <th>Saved</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kwData.keywords.map((kw) => (
                      <tr key={kw.id}>
                        <td className={styles.kwCell}>{kw.keyword}</td>
                        <td className={styles.urlCell}>
                          {kw.targetUrl ? (
                            <a
                              href={kw.targetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.urlLink}
                            >
                              {kw.targetUrl}
                            </a>
                          ) : (
                            <span className={styles.muted}>--</span>
                          )}
                        </td>
                        <td className={styles.notesCell}>
                          {kw.notes || (
                            <span className={styles.muted}>--</span>
                          )}
                        </td>
                        <td className={styles.dateCell}>
                          {new Date(kw.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(kw.id)}
                            disabled={deletingId === kw.id}
                          >
                            {deletingId === kw.id ? '...' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {kwData.totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span className={styles.pageInfo}>
                    Page {kwData.page} of {kwData.totalPages}
                  </span>
                  <button
                    className={styles.pageBtn}
                    disabled={page >= kwData.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>K</div>
              <h3 className={styles.emptyTitle}>No keywords saved yet</h3>
              <p className={styles.emptyDesc}>
                Use the Keyword Research tool to find and save keywords to this
                project.
              </p>
              <Link href="/dashboard/keywords" className={styles.emptyBtn}>
                Research Keywords
              </Link>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default function ProjectKeywordsPage() {
  return (
    <AuthGuard>
      <ProjectKeywordsContent />
    </AuthGuard>
  );
}
