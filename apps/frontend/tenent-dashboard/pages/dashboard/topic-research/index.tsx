import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import { GuideModal } from '@/components/ui/Dialog';
import { AiInsights } from '@/components/ui/AiInsights';
import { useProjects, useCompetitors } from '@/hooks/useProjects';
import {
  useTopicResearch,
  useSubtopics,
  useAiTopicSuggestions,
} from '@/hooks/useTopicResearch';
import { Sparkles, Loader2, Filter, X, ChevronRight, ChevronDown, ChevronUp, ExternalLink, Search } from 'lucide-react';
import type { TopicCard, SearchIntent, TopicResearchFilters, AiTopicSuggestion } from '@/types/topic-research';
import styles from './index.module.css';

function getDifficultyColor(d: number | null): string {
  if (d === null) return 'var(--text-tertiary)';
  if (d < 25) return '#22c55e';
  if (d < 50) return '#eab308';
  if (d < 75) return '#f97316';
  return '#ef4444';
}

function getEfficiencyLabel(e: number | null): string {
  if (e === null) return '--';
  if (e >= 70) return 'High';
  if (e >= 40) return 'Medium';
  return 'Low';
}

function getEfficiencyColor(e: number | null): string {
  if (e === null) return 'var(--text-tertiary)';
  if (e >= 70) return '#22c55e';
  if (e >= 40) return '#eab308';
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

const COUNTRY_NAMES: Record<string, string> = {
  AU: 'Australia',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  IN: 'India',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  BR: 'Brazil',
  JP: 'Japan',
};

function TopicResearchContent() {
  const router = useRouter();
  const { data: projects } = useProjects();
  const queryProjectId = (router.query.projectId as string) || '';

  const [topicInput, setTopicInput] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [activeDomain, setActiveDomain] = useState('');
  const [country, setCountry] = useState('AU');
  const [selectedProjectId, setSelectedProjectId] = useState(queryProjectId);
  const [showGuide, setShowGuide] = useState(false);

  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const [aiRequested, setAiRequested] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [filterIntent, setFilterIntent] = useState('');
  const [filterMinVolume, setFilterMinVolume] = useState('');
  const [filterMaxKd, setFilterMaxKd] = useState('');
  const [filterMinEfficiency, setFilterMinEfficiency] = useState('');
  const [sortBy, setSortBy] = useState<'efficiency' | 'volume' | 'difficulty'>('efficiency');

  useEffect(() => {
    if (queryProjectId && !selectedProjectId) {
      setSelectedProjectId(queryProjectId);
    }
  }, [queryProjectId]);

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);
  const { data: competitors } = useCompetitors(selectedProjectId);
  const competitorDomains = competitors?.map((c) => c.domain) || [];

  const filters: TopicResearchFilters = {};
  if (filterIntent) filters.intent = filterIntent as SearchIntent;
  if (filterMinVolume) filters.minVolume = parseInt(filterMinVolume, 10);
  if (filterMaxKd) filters.maxKd = parseInt(filterMaxKd, 10);
  if (filterMinEfficiency) filters.minEfficiency = parseInt(filterMinEfficiency, 10);
  const hasActiveFilters = Object.keys(filters).length > 0;

  const { data: topicData, isLoading: isSearching } = useTopicResearch(
    activeQuery, country, activeDomain || undefined, hasActiveFilters ? filters : undefined,
  );

  const { data: subtopicData, isLoading: isLoadingSubtopics } = useSubtopics(
    expandedTopic || '', activeQuery, country,
  );

  const { data: aiSuggestions, isLoading: isLoadingAi, error: aiError } = useAiTopicSuggestions(
    selectedProject?.domain || null, competitorDomains, aiRequested,
  );

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) return;
    setActiveQuery(topicInput.trim());
    setActiveDomain(domainInput.trim());
    setExpandedTopic(null);
    setExpandedCards(new Set());
  };

  const handleTopicClick = (topic: string) => {
    if (expandedTopic === topic) {
      setExpandedTopic(null);
    } else {
      setExpandedTopic(topic);
    }
  };

  const toggleCardExpand = (topic: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const handleAiTopicClick = (suggestion: AiTopicSuggestion) => {
    setTopicInput(suggestion.topic);
    setActiveQuery(suggestion.topic);
    setActiveDomain(domainInput.trim());
    setExpandedTopic(null);
    setExpandedCards(new Set());
  };

  const handleAiKeywordClick = (keyword: string) => {
    setTopicInput(keyword);
    setActiveQuery(keyword);
    setActiveDomain(domainInput.trim());
    setExpandedTopic(null);
    setExpandedCards(new Set());
  };

  const handleRelatedClick = (keyword: string) => {
    setTopicInput(keyword);
    setActiveQuery(keyword);
    setExpandedTopic(null);
    setExpandedCards(new Set());
  };

  const clearFilters = () => {
    setFilterIntent('');
    setFilterMinVolume('');
    setFilterMaxKd('');
    setFilterMinEfficiency('');
  };

  const sortedCards = topicData?.cards ? [...topicData.cards].sort((a, b) => {
    if (sortBy === 'efficiency') return (b.topicEfficiency ?? 0) - (a.topicEfficiency ?? 0);
    if (sortBy === 'volume') return (b.searchVolume ?? 0) - (a.searchVolume ?? 0);
    return (a.difficulty ?? 100) - (b.difficulty ?? 100);
  }) : [];

  const expandedCardData = expandedTopic ? sortedCards.find((c) => c.topic === expandedTopic) : null;

  return (
    <>
      <Head>
        <title>Topic Research — NR SEO Platform</title>
      </Head>
      <Sidebar projectId={queryProjectId || undefined} />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          {/* Page Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Topic Research</h1>
            <button
              onClick={() => setShowGuide(true)}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-primary)',
                background: 'var(--bg-card)', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="How to use this tool"
            >
              ?
            </button>
          </div>

          <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} title="Topic Research — Guide">
            <h4>What is Topic Research?</h4>
            <p>Topic Research helps you discover content ideas by exploring related subtopics and building topic clusters.</p>
            <h4>How to use it</h4>
            <ul>
              <li><strong>Enter a topic</strong> — Type any keyword to explore related subtopics.</li>
              <li><strong>Add a domain</strong> — Optionally enter a domain for tailored content ideas.</li>
              <li><strong>AI Topic Ideas</strong> — Select a project and click &ldquo;Get AI Topic Ideas&rdquo; for AI-generated suggestions.</li>
              <li><strong>Explore cards</strong> — Click any card to see headlines, questions, and related searches.</li>
            </ul>
            <h4>Metrics</h4>
            <ul>
              <li><strong>Subtopic Volume</strong> — Combined search volume across all subtopics.</li>
              <li><strong>Difficulty</strong> — How hard it is to rank (0-100%).</li>
              <li><strong>Topic Efficiency</strong> — High volume + low difficulty = High efficiency.</li>
            </ul>
          </GuideModal>

          {/* Search Bar (SEMrush style) */}
          <form className={styles.searchBar} onSubmit={handleSearch}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Enter topic"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
            />
            <select className={styles.countrySelect} value={country} onChange={(e) => setCountry(e.target.value)}>
              {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            <input
              className={styles.domainInput}
              type="text"
              placeholder="Search content on domain"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
            />
            <button type="submit" className={styles.searchBtn} disabled={!topicInput.trim() || isSearching}>
              {isSearching ? 'Searching...' : 'Get content ideas'}
            </button>
          </form>

          {/* Project Selector */}
          {projects && projects.length > 1 && !queryProjectId && (
            <div className={styles.projectSelector}>
              <label className={styles.projectLabel}>Project:</label>
              <select
                className={styles.projectSelect}
                value={selectedProjectId}
                onChange={(e) => { setSelectedProjectId(e.target.value); setAiRequested(false); }}
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.domain})</option>
                ))}
              </select>
            </div>
          )}

          {/* AI Topic Suggestions */}
          {selectedProject && (
            <div className={styles.aiSuggestionsSection}>
              <div className={styles.aiSuggestionsHeader}>
                <div className={styles.aiSuggestionsTitle}>
                  <div className={styles.aiSuggestionsIcon}><Sparkles size={14} /></div>
                  AI Topic Ideas for {selectedProject.domain}
                </div>
                {!aiRequested && (
                  <button className={styles.aiGenerateBtn} onClick={() => setAiRequested(true)}>
                    <Sparkles size={13} /> Get AI Topic Ideas
                  </button>
                )}
              </div>
              {aiRequested && (
                <div className={styles.aiSuggestionsBody}>
                  {isLoadingAi && (
                    <div className={styles.aiLoadingState}>
                      <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                      Analyzing your domain and competitors to suggest topics...
                    </div>
                  )}
                  {aiError && !isLoadingAi && (
                    <div className={styles.emptyState}>Could not generate topic suggestions right now.</div>
                  )}
                  {aiSuggestions && aiSuggestions.suggestions && aiSuggestions.suggestions.length > 0 && !isLoadingAi && (
                    <div className={styles.aiSuggestionsGrid}>
                      {aiSuggestions.suggestions.map((s: AiTopicSuggestion, i: number) => (
                        <div key={i} className={styles.aiSuggestionCard} onClick={() => handleAiTopicClick(s)}>
                          <div className={styles.aiSuggestionTopic}>
                            <ChevronRight size={14} style={{ display: 'inline', marginRight: 4, color: 'var(--accent-primary)' }} />
                            {s.topic}
                          </div>
                          <div className={styles.aiSuggestionReason}>{s.reason}</div>
                          <div className={styles.aiSuggestionKeywords}>
                            {s.keywords.map((kw, j) => (
                              <button key={j} className={styles.aiKeywordChip} onClick={(e) => { e.stopPropagation(); handleAiKeywordClick(kw); }}>
                                {kw}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {aiSuggestions && (!aiSuggestions.suggestions || aiSuggestions.suggestions.length === 0) && !isLoadingAi && (
                    <div className={styles.emptyState}>No topic suggestions available.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI Insights (after search) */}
          {topicData && (
            <AiInsights
              module="topic-research-insights"
              context={{
                topic: topicData.topic, country: topicData.country, totalCards: topicData.total,
                topTopics: topicData.cards.slice(0, 5).map((c) => ({ topic: c.topic, volume: c.searchVolume, difficulty: c.difficulty, efficiency: c.topicEfficiency })),
              }}
            />
          )}

          {/* Loading */}
          {isSearching && <div className={styles.loadingState}>Researching topics...</div>}

          {/* Results */}
          {topicData && !isSearching && (
            <>
              {/* Sort & Filter Bar */}
              <div className={styles.sortBar}>
                <span className={styles.resultCount}>
                  {sortedCards.length} topic{sortedCards.length !== 1 ? 's' : ''} for &ldquo;{topicData.topic}&rdquo;
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ''}`}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter size={13} />
                    Filters{hasActiveFilters ? ' (active)' : ''}
                  </button>
                  <select className={styles.sortSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                    <option value="efficiency">Sort: Topic Efficiency</option>
                    <option value="volume">Sort: Search Volume</option>
                    <option value="difficulty">Sort: Difficulty (low first)</option>
                  </select>
                </div>
              </div>

              {showFilters && (
                <div className={styles.filtersPanel}>
                  <div className={styles.filterRow}>
                    <div className={styles.filterGroup}>
                      <label>Min Volume</label>
                      <input type="number" placeholder="e.g. 100" value={filterMinVolume} onChange={(e) => setFilterMinVolume(e.target.value)} />
                    </div>
                    <div className={styles.filterGroup}>
                      <label>Max KD%</label>
                      <input type="number" placeholder="e.g. 50" value={filterMaxKd} onChange={(e) => setFilterMaxKd(e.target.value)} />
                    </div>
                    <div className={styles.filterGroup}>
                      <label>Min Efficiency</label>
                      <input type="number" placeholder="e.g. 40" value={filterMinEfficiency} onChange={(e) => setFilterMinEfficiency(e.target.value)} />
                    </div>
                    <div className={styles.filterGroup}>
                      <label>Intent</label>
                      <select value={filterIntent} onChange={(e) => setFilterIntent(e.target.value)}>
                        <option value="">All</option>
                        <option value="INFORMATIONAL">Informational</option>
                        <option value="NAVIGATIONAL">Navigational</option>
                        <option value="COMMERCIAL">Commercial</option>
                        <option value="TRANSACTIONAL">Transactional</option>
                      </select>
                    </div>
                    {hasActiveFilters && <button className={styles.clearFiltersBtn} onClick={clearFilters}>Clear</button>}
                  </div>
                </div>
              )}

              {/* Horizontal Topic Cards */}
              <div className={styles.topicCardsRow}>
                {sortedCards.map((card) => (
                  <TopicCardComponent
                    key={card.topic}
                    card={card}
                    isActive={expandedTopic === card.topic}
                    isExpanded={expandedCards.has(card.topic)}
                    onCardClick={() => handleTopicClick(card.topic)}
                    onToggle={() => toggleCardExpand(card.topic)}
                    subtopics={subtopicData && expandedTopic === card.topic ? subtopicData.subtopics.slice(0, 3) : []}
                  />
                ))}
              </div>

              {/* Expanded Detail Panel (below cards) */}
              {expandedTopic && expandedCardData && (
                <div className={styles.detailPanel}>
                  {/* Header */}
                  <div className={styles.detailHeader}>
                    <div className={styles.detailTitle}>{expandedCardData.topic}</div>
                    <button className={styles.detailClose} onClick={() => setExpandedTopic(null)}>
                      <X size={14} />
                    </button>
                  </div>

                  {/* Metrics Bar */}
                  <div className={styles.detailMetrics}>
                    <div className={styles.detailMetric}>
                      <div className={styles.detailMetricLabel}>Subtopic Volume</div>
                      <div className={styles.detailMetricValue}>{formatVolume(expandedCardData.searchVolume)}</div>
                    </div>
                    <div className={styles.detailMetric}>
                      <div className={styles.detailMetricLabel}>Difficulty</div>
                      <div className={styles.detailMetricValue} style={{ color: getDifficultyColor(expandedCardData.difficulty) }}>
                        {expandedCardData.difficulty !== null ? `${expandedCardData.difficulty}.00%` : '--'}
                      </div>
                    </div>
                    <div className={styles.detailMetric}>
                      <div className={styles.detailMetricLabel}>Topic Efficiency</div>
                      <div className={styles.detailMetricValue} style={{ color: getEfficiencyColor(expandedCardData.topicEfficiency) }}>
                        {getEfficiencyLabel(expandedCardData.topicEfficiency)}
                      </div>
                    </div>
                  </div>

                  {isLoadingSubtopics && <div className={styles.loadingState}>Loading details...</div>}

                  {!isLoadingSubtopics && subtopicData && (
                    <>
                      {/* Headlines + Questions side by side */}
                      <div className={styles.detailColumns}>
                        {/* Headlines */}
                        <div className={styles.detailColumn}>
                          <div className={styles.detailColumnHeader}>
                            Headlines <span className={styles.detailColumnCount}>{subtopicData.headlines.length}</span>
                          </div>
                          <ul className={styles.detailList}>
                            {subtopicData.headlines.length > 0 ? subtopicData.headlines.map((h, i) => (
                              <li key={i} className={styles.detailListItem}>
                                <span className={styles.detailListIcon} style={{ backgroundColor: INTENT_COLORS[subtopicData.subtopics[i % subtopicData.subtopics.length]?.intent || 'INFORMATIONAL'] }}>
                                  {INTENT_LABELS[subtopicData.subtopics[i % subtopicData.subtopics.length]?.intent || 'INFORMATIONAL']}
                                </span>
                                <span className={styles.detailListText}>{h}</span>
                                <ExternalLink size={13} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
                              </li>
                            )) : (
                              <li className={styles.emptyState}>No headlines found.</li>
                            )}
                          </ul>
                        </div>

                        {/* Questions */}
                        <div className={styles.detailColumn}>
                          <div className={styles.detailColumnHeader}>
                            Questions <span className={styles.detailColumnCount}>{subtopicData.questions.length}</span>
                          </div>
                          <ul className={styles.detailList}>
                            {subtopicData.questions.length > 0 ? subtopicData.questions.map((q, i) => (
                              <li key={i} className={styles.detailListItem}>
                                <span className={styles.detailListIcon} style={{ backgroundColor: '#6366f1' }}>?</span>
                                <span className={styles.detailListText}>{q}</span>
                                <ExternalLink size={13} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
                              </li>
                            )) : (
                              <li className={styles.emptyState}>No questions found.</li>
                            )}
                          </ul>
                        </div>
                      </div>

                      {/* Related Searches */}
                      {subtopicData.subtopics.length > 0 && (
                        <div className={styles.relatedSection}>
                          <div className={styles.relatedLabel}>
                            Related searches <span className={styles.relatedCount}>{subtopicData.subtopics.length}</span>
                          </div>
                          <div className={styles.relatedChips}>
                            {subtopicData.subtopics.map((sub, i) => (
                              <button key={i} className={styles.relatedChip} onClick={() => handleRelatedClick(sub.keyword)}>
                                {sub.keyword}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {sortedCards.length === 0 && (
                <div className={styles.emptyState}>No topics found. Try a different search term.</div>
              )}
            </>
          )}

          {/* Empty state */}
          {!topicData && !isSearching && !activeQuery && (
            <div className={styles.emptyState} style={{ padding: 64 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Discover Content Ideas
              </div>
              <p style={{ maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
                Enter any keyword or phrase to explore dozens of related subtopics and build powerful topic clusters.
                Find content ideas sorted by topic efficiency based on keyword difficulty and search volume.
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

/* ─── Topic Card (SEMrush style) ────────────────────────── */
function TopicCardComponent({
  card,
  isActive,
  isExpanded,
  onCardClick,
  onToggle,
  subtopics,
}: {
  card: TopicCard;
  isActive: boolean;
  isExpanded: boolean;
  onCardClick: () => void;
  onToggle: () => void;
  subtopics: { keyword: string; intent: SearchIntent }[];
}) {
  // Show first 3 subtopics as "ideas" in the card, or placeholder text
  const ideas = subtopics.length > 0
    ? subtopics.map((s) => ({ text: s.keyword, intent: s.intent }))
    : [
        { text: `${card.topic} guide`, intent: 'INFORMATIONAL' as SearchIntent },
        { text: `${card.topic} tips`, intent: 'INFORMATIONAL' as SearchIntent },
        { text: `best ${card.topic}`, intent: 'COMMERCIAL' as SearchIntent },
      ];

  const visibleIdeas = isExpanded ? ideas : ideas.slice(0, 3);

  return (
    <div
      className={`${styles.topicCard} ${isActive ? styles.topicCardActive : ''}`}
      onClick={onCardClick}
    >
      <div className={styles.topicCardHead}>
        <div className={styles.topicCardTitle}>{card.topic}</div>
        <div className={styles.topicCardVolume}>
          Volume: <strong>{formatVolume(card.searchVolume)}</strong>
        </div>
      </div>

      <ul className={styles.topicCardIdeas}>
        {visibleIdeas.map((idea, i) => (
          <li key={i} className={styles.topicCardIdea}>
            <span
              className={styles.ideaIcon}
              style={{ backgroundColor: INTENT_COLORS[idea.intent] }}
            >
              {INTENT_LABELS[idea.intent]}
            </span>
            {idea.text}
          </li>
        ))}
      </ul>

      {ideas.length > 3 && (
        <button
          className={styles.topicCardToggle}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {isExpanded ? (
            <><span>Hide ideas</span> <ChevronUp size={14} /></>
          ) : (
            <><span>Show more</span> <ChevronDown size={14} /></>
          )}
        </button>
      )}
    </div>
  );
}

export default function TopicResearchPage() {
  return (
    <AuthGuard>
      <TopicResearchContent />
    </AuthGuard>
  );
}
