import { useState, useMemo } from 'react';
import Head from 'next/head';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { GuideModal } from '@/components/ui/Dialog';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import {
  useBacklinkAuditList,
  useBacklinkAudit,
  useRunBacklinkAudit,
  useUpdateAuditLinkStatus,
  useDeleteBacklinkAudit,
  useDownloadDisavow,
  useInvalidateBacklinkAudit,
} from '@/hooks/useBacklinkAudit';
import type {
  BacklinkAuditLink,
  BacklinkAuditLinkStatus,
  BacklinkAuditToxicityLevel,
  BacklinkAuditInsightSeverity,
} from '@/types/backlink-audit';
import {
  ShieldAlert,
  Search,
  Loader2,
  Download,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertOctagon,
  CheckCircle,
  Lightbulb,
  History,
} from 'lucide-react';
import styles from './index.module.css';

// ─── Helpers ─────────────────────────────────────────
function getToxicityColor(score: number): string {
  if (score >= 60) return '#ef4444';
  if (score >= 30) return '#eab308';
  return '#22c55e';
}

function getAuthorityColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

// ─── Toxicity Gauge ──────────────────────────────────
function ToxicityGauge({ score }: { score: number }) {
  const color = getToxicityColor(score);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <svg width="92" height="92" viewBox="0 0 92 92">
      <circle
        cx="46"
        cy="46"
        r={radius}
        fill="none"
        stroke="var(--border-primary)"
        strokeWidth="6"
      />
      <circle
        cx="46"
        cy="46"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        transform="rotate(-90 46 46)"
      />
      <text
        x="46"
        y="44"
        textAnchor="middle"
        fill={color}
        fontSize="22"
        fontWeight="800"
      >
        {Math.round(score)}
      </text>
      <text
        x="46"
        y="58"
        textAnchor="middle"
        fill="var(--text-tertiary)"
        fontSize="8"
        fontWeight="700"
      >
        TOXICITY
      </text>
    </svg>
  );
}

// ─── Authority Gauge ─────────────────────────────────
function AuthorityGauge({ score }: { score: number }) {
  const color = getAuthorityColor(score);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <svg width="92" height="92" viewBox="0 0 92 92">
      <circle
        cx="46"
        cy="46"
        r={radius}
        fill="none"
        stroke="var(--border-primary)"
        strokeWidth="6"
      />
      <circle
        cx="46"
        cy="46"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        transform="rotate(-90 46 46)"
      />
      <text
        x="46"
        y="44"
        textAnchor="middle"
        fill={color}
        fontSize="22"
        fontWeight="800"
      >
        {Math.round(score)}
      </text>
      <text
        x="46"
        y="58"
        textAnchor="middle"
        fill="var(--text-tertiary)"
        fontSize="8"
        fontWeight="700"
      >
        AUTHORITY
      </text>
    </svg>
  );
}

type FilterKey = 'all' | 'toxic' | 'suspicious' | 'clean' | 'flagged' | 'disavow';

const SEVERITY_ICON: Record<BacklinkAuditInsightSeverity, JSX.Element> = {
  high: <AlertOctagon size={16} style={{ color: '#ef4444' }} />,
  medium: <AlertTriangle size={16} style={{ color: '#eab308' }} />,
  low: <CheckCircle size={16} style={{ color: '#22c55e' }} />,
};

// ─── Main Component ──────────────────────────────────
function BacklinkAuditContent() {
  const [domainInput, setDomainInput] = useState('');
  const [country, setCountry] = useState('AU');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showGuide, setShowGuide] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: auditList, refetch: refetchList } = useBacklinkAuditList();
  const { data: activeAudit, isLoading: loadingAudit } =
    useBacklinkAudit(activeJobId);
  const runAudit = useRunBacklinkAudit();
  const updateLink = useUpdateAuditLinkStatus();
  const deleteAudit = useDeleteBacklinkAudit();
  const downloadDisavow = useDownloadDisavow();
  const invalidate = useInvalidateBacklinkAudit();

  const handleRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;
    setErrorMsg(null);
    runAudit.mutate(
      {
        url: '/backlink-audit',
        body: { domain: domainInput.trim(), country },
      },
      {
        onSuccess: (job: any) => {
          setActiveJobId(job.id);
          refetchList();
        },
        onError: (err: any) => {
          setErrorMsg(
            err?.response?.data?.message || err?.message || 'Audit failed',
          );
        },
      },
    );
  };

  const handleStatusChange = (
    linkId: string,
    status: BacklinkAuditLinkStatus,
  ) => {
    if (!activeJobId) return;
    updateLink.mutate(
      {
        url: `/backlink-audit/${activeJobId}/links/${linkId}`,
        body: { status },
      },
      {
        onSuccess: () => invalidate(activeJobId),
      },
    );
  };

  const handleDeleteAudit = (id: string) => {
    if (!confirm('Delete this audit and all its links?')) return;
    deleteAudit.mutate(`/backlink-audit/${id}`, {
      onSuccess: () => {
        if (activeJobId === id) setActiveJobId(null);
        refetchList();
      },
    });
  };

  const handleDownload = () => {
    if (!activeAudit) return;
    downloadDisavow.mutate({
      jobId: activeAudit.id,
      domain: activeAudit.domain,
    });
  };

  // Filter the visible links
  const filteredLinks = useMemo(() => {
    if (!activeAudit) return [];
    const links = activeAudit.links || [];
    switch (filter) {
      case 'toxic':
        return links.filter((l) => l.toxicityLevel === 'toxic');
      case 'suspicious':
        return links.filter((l) => l.toxicityLevel === 'suspicious');
      case 'clean':
        return links.filter((l) => l.toxicityLevel === 'clean');
      case 'flagged':
        return links.filter((l) => l.status === 'flag');
      case 'disavow':
        return links.filter((l) => l.status === 'disavow');
      default:
        return links;
    }
  }, [activeAudit, filter]);

  const counts = useMemo(() => {
    if (!activeAudit)
      return { all: 0, toxic: 0, suspicious: 0, clean: 0, flagged: 0, disavow: 0 };
    const links = activeAudit.links || [];
    return {
      all: links.length,
      toxic: links.filter((l) => l.toxicityLevel === 'toxic').length,
      suspicious: links.filter((l) => l.toxicityLevel === 'suspicious').length,
      clean: links.filter((l) => l.toxicityLevel === 'clean').length,
      flagged: links.filter((l) => l.status === 'flag').length,
      disavow: links.filter((l) => l.status === 'disavow').length,
    };
  }, [activeAudit]);

  const hasResults = !!activeAudit;
  const isRunning = runAudit.isPending;

  return (
    <div className={styles.layout}>
      <Head>
        <title>Backlink Audit — NR SEO</title>
      </Head>
      <Sidebar />
      <div className={sidebarStyles.contentWithSidebar}>
        <main className={styles.main}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Backlink Audit</h1>
            <button
              className={styles.guideBtn}
              onClick={() => setShowGuide(true)}
              title="How to use"
            >
              ?
            </button>
          </div>
          <p className={styles.pageSubtitle}>
            Keep your backlink profile healthy — score every link, flag toxic sources,
            and build a disavow list for Google.
          </p>

          <GuideModal
            isOpen={showGuide}
            onClose={() => setShowGuide(false)}
            title="Backlink Audit — Guide"
          >
            <h4>What is Backlink Audit?</h4>
            <p>
              Audit any domain&apos;s backlinks for quality and toxicity. Each link is scored
              0-100 based on signals like source authority, spammy patterns, link-farm
              indicators, and more. Mark suspicious links for disavow and download a
              Google-format disavow file.
            </p>
            <h4>Workflow</h4>
            <ul>
              <li><strong>Enter a domain</strong> and click Run Audit.</li>
              <li><strong>Review insights</strong> — AI recommendations highlight the biggest risks.</li>
              <li><strong>Filter by toxicity</strong> — All / Toxic / Suspicious / Clean tabs.</li>
              <li><strong>Mark links</strong> — set each link to Keep, Flag, or Disavow.</li>
              <li><strong>Download disavow.txt</strong> — submit to Google Search Console.</li>
            </ul>
            <h4>Toxicity levels</h4>
            <ul>
              <li><strong>Clean (0-30)</strong> — Healthy, keep.</li>
              <li><strong>Suspicious (31-60)</strong> — Review manually, may want to flag.</li>
              <li><strong>Toxic (61-100)</strong> — High risk, candidates for disavow.</li>
            </ul>
          </GuideModal>

          {/* Run audit form */}
          <form className={styles.searchForm} onSubmit={handleRun}>
            <input
              className={styles.searchInput}
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="Enter domain (e.g. example.com)"
              disabled={isRunning}
            />
            <select
              className={styles.countrySelect}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={isRunning}
            >
              <option value="AU">AU</option>
              <option value="US">US</option>
              <option value="GB">GB</option>
              <option value="CA">CA</option>
              <option value="IN">IN</option>
              <option value="DE">DE</option>
              <option value="FR">FR</option>
            </select>
            <button
              type="submit"
              className={styles.runBtn}
              disabled={!domainInput.trim() || isRunning}
            >
              {isRunning ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Auditing...
                </>
              ) : (
                <>
                  <ShieldAlert size={15} /> Run Audit
                </>
              )}
            </button>
          </form>

          {errorMsg && <div className={styles.errorState}>{errorMsg}</div>}

          {/* Recent audits */}
          {auditList && auditList.length > 0 && (
            <div className={styles.recentPanel}>
              <div
                className={styles.recentHeader}
                onClick={() => setShowHistory(!showHistory)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <History size={14} /> Recent Audits ({auditList.length})
                </span>
                {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {showHistory && (
                <div className={styles.recentList}>
                  {auditList.map((a) => (
                    <div
                      key={a.id}
                      className={`${styles.recentRow} ${activeJobId === a.id ? styles.recentRowActive : ''}`}
                      onClick={() => setActiveJobId(a.id)}
                    >
                      <div>
                        <div className={styles.recentDomain}>{a.domain}</div>
                        <div className={styles.recentMeta}>
                          {a.country} · {a.totalLinks} links · {formatRelative(a.createdAt)}
                        </div>
                      </div>
                      <span
                        className={styles.scoreChip}
                        style={{ background: getToxicityColor(a.toxicityScore) }}
                        title="Toxicity score"
                      >
                        {Math.round(a.toxicityScore)}
                      </span>
                      <span className={styles.tableMuted}>
                        {a.toxicCount}T · {a.suspiciousCount}S · {a.cleanCount}C
                      </span>
                      <button
                        className={styles.recentDelete}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAudit(a.id);
                        }}
                        title="Delete audit"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!activeJobId && !isRunning && (
            <div className={styles.emptyState}>
              <ShieldAlert
                size={48}
                style={{ margin: '0 auto 12px', opacity: 0.5 }}
              />
              <div className={styles.emptyTitle}>Audit any backlink profile</div>
              <p className={styles.emptyText}>
                Enter a domain above to scan its backlinks for toxicity, identify
                spammy sources, and build a disavow list. Each link is scored against
                quality signals and grouped by risk level.
              </p>
            </div>
          )}

          {/* Loading active audit */}
          {(loadingAudit || isRunning) && (
            <div className={styles.loadingState}>
              <Loader2 size={16} className="animate-spin" />
              {isRunning
                ? 'Auditing backlinks... this may take up to a minute.'
                : 'Loading audit...'}
            </div>
          )}

          {/* Results */}
          {hasResults && !loadingAudit && activeAudit && (
            <>
              {/* Hero row: Toxicity + Authority gauges */}
              <div className={styles.heroRow}>
                <div className={styles.heroCard}>
                  <ToxicityGauge score={activeAudit.toxicityScore} />
                  <div>
                    <div className={styles.toxicityLabel}>Toxicity Score</div>
                    <div
                      className={styles.toxicityBig}
                      style={{ color: getToxicityColor(activeAudit.toxicityScore) }}
                    >
                      {Math.round(activeAudit.toxicityScore)}
                      <span style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>
                        {' '}/ 100
                      </span>
                    </div>
                    <div className={styles.toxicityHint}>
                      {activeAudit.toxicityScore >= 60
                        ? 'High risk — immediate action recommended'
                        : activeAudit.toxicityScore >= 30
                          ? 'Moderate risk — review suspicious links'
                          : 'Low risk — profile looks healthy'}
                    </div>
                  </div>
                </div>

                <div className={styles.heroCard}>
                  <AuthorityGauge score={activeAudit.authorityScore} />
                  <div>
                    <div className={styles.domainLabel}>Audited Domain</div>
                    <div className={styles.domainName}>{activeAudit.domain}</div>
                    <div className={styles.domainBadges}>
                      <span className={styles.badge}>{activeAudit.country}</span>
                      <span className={styles.badge}>
                        {activeAudit.totalLinks} links
                      </span>
                      <span className={styles.badge}>
                        {activeAudit.totalDomains} domains
                      </span>
                      <span className={styles.badge}>
                        Audited {formatRelative(activeAudit.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary cards */}
              <div className={styles.summaryGrid}>
                <div
                  className={`${styles.summaryCard} ${filter === 'toxic' ? styles.summaryCardActive : ''}`}
                  onClick={() => setFilter('toxic')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.summaryLabel}>
                    <AlertOctagon size={12} style={{ color: '#ef4444' }} /> Toxic
                  </div>
                  <div className={styles.summaryValue} style={{ color: '#ef4444' }}>
                    {activeAudit.toxicCount}
                  </div>
                  <div className={styles.summarySub}>High risk · disavow candidates</div>
                </div>

                <div
                  className={`${styles.summaryCard} ${filter === 'suspicious' ? styles.summaryCardActive : ''}`}
                  onClick={() => setFilter('suspicious')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.summaryLabel}>
                    <AlertTriangle size={12} style={{ color: '#eab308' }} /> Suspicious
                  </div>
                  <div className={styles.summaryValue} style={{ color: '#eab308' }}>
                    {activeAudit.suspiciousCount}
                  </div>
                  <div className={styles.summarySub}>Manual review needed</div>
                </div>

                <div
                  className={`${styles.summaryCard} ${filter === 'clean' ? styles.summaryCardActive : ''}`}
                  onClick={() => setFilter('clean')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.summaryLabel}>
                    <CheckCircle size={12} style={{ color: '#22c55e' }} /> Clean
                  </div>
                  <div className={styles.summaryValue} style={{ color: '#22c55e' }}>
                    {activeAudit.cleanCount}
                  </div>
                  <div className={styles.summarySub}>Healthy backlinks</div>
                </div>

                <div
                  className={`${styles.summaryCard} ${filter === 'disavow' ? styles.summaryCardActive : ''}`}
                  onClick={() => setFilter('disavow')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.summaryLabel}>
                    <ShieldAlert size={12} /> Disavow Queue
                  </div>
                  <div className={styles.summaryValue}>{counts.disavow}</div>
                  <div className={styles.summarySub}>Marked for disavow</div>
                </div>
              </div>

              {/* Insights panel */}
              {activeAudit.insights && activeAudit.insights.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                      <Lightbulb size={15} /> AI Insights
                    </div>
                    <div className={styles.sectionHint}>
                      Personal recommendations to improve your profile
                    </div>
                  </div>
                  <div className={styles.insightsList}>
                    {activeAudit.insights.map((ins, i) => (
                      <div key={i} className={styles.insightRow}>
                        <div className={styles.insightIcon}>
                          {SEVERITY_ICON[ins.severity]}
                        </div>
                        <div className={styles.insightContent}>
                          <div className={styles.insightTitle}>
                            {ins.title}
                            <span
                              className={`${styles.severityChip} ${
                                ins.severity === 'high'
                                  ? styles.severityHigh
                                  : ins.severity === 'medium'
                                    ? styles.severityMedium
                                    : styles.severityLow
                              }`}
                            >
                              {ins.severity}
                            </span>
                          </div>
                          <div className={styles.insightDesc}>{ins.description}</div>
                          {ins.action && (
                            <div className={styles.insightAction}>→ {ins.action}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Distributions: toxicity + authority */}
              {activeAudit.distribution && (
                <div className={styles.twoCol}>
                  <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTitle}>Toxicity Distribution</div>
                    </div>
                    <div className={styles.distList}>
                      {activeAudit.distribution.toxicityBuckets.map((b) => {
                        const pct =
                          activeAudit.totalLinks > 0
                            ? (b.count / activeAudit.totalLinks) * 100
                            : 0;
                        const color = b.label.toLowerCase().includes('toxic')
                          ? '#ef4444'
                          : b.label.toLowerCase().includes('suspicious')
                            ? '#eab308'
                            : '#22c55e';
                        return (
                          <div key={b.label} className={styles.distRow}>
                            <div className={styles.distLabel}>{b.label}</div>
                            <div className={styles.distBar}>
                              <div
                                className={styles.distBarFill}
                                style={{ width: `${pct}%`, background: color }}
                              />
                            </div>
                            <div className={styles.distCount}>{b.count}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTitle}>
                        Source Authority Distribution
                      </div>
                    </div>
                    <div className={styles.distList}>
                      {activeAudit.distribution.authorityBuckets.map((b) => {
                        const pct =
                          activeAudit.totalLinks > 0
                            ? (b.count / activeAudit.totalLinks) * 100
                            : 0;
                        return (
                          <div key={b.label} className={styles.distRow}>
                            <div className={styles.distLabel}>{b.label}</div>
                            <div className={styles.distBar}>
                              <div
                                className={styles.distBarFill}
                                style={{
                                  width: `${pct}%`,
                                  background: 'var(--accent-primary)',
                                }}
                              />
                            </div>
                            <div className={styles.distCount}>{b.count}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Disavow action bar */}
              <div className={styles.disavowBar}>
                <div className={styles.disavowInfo}>
                  <ShieldAlert size={16} style={{ color: '#ef4444' }} />
                  <span>
                    <strong>{counts.disavow}</strong> link{counts.disavow !== 1 ? 's' : ''}{' '}
                    marked for disavow
                    {counts.disavow > 0 && ' — ready to submit to Google'}
                  </span>
                </div>
                <button
                  className={styles.downloadBtn}
                  disabled={counts.disavow === 0 || downloadDisavow.isPending}
                  onClick={handleDownload}
                >
                  {downloadDisavow.isPending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Building...
                    </>
                  ) : (
                    <>
                      <Download size={13} />
                      Download disavow.txt
                    </>
                  )}
                </button>
              </div>

              {/* Filter tabs + table */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>Backlink Quality Audit</div>
                  <div className={styles.sectionHint}>
                    {filteredLinks.length} of {counts.all} links
                  </div>
                </div>

                <div className={styles.tabs}>
                  {(
                    [
                      { key: 'all', label: 'All', count: counts.all },
                      { key: 'toxic', label: 'Toxic', count: counts.toxic },
                      { key: 'suspicious', label: 'Suspicious', count: counts.suspicious },
                      { key: 'clean', label: 'Clean', count: counts.clean },
                      { key: 'flagged', label: 'Flagged', count: counts.flagged },
                      { key: 'disavow', label: 'Disavow', count: counts.disavow },
                    ] as { key: FilterKey; label: string; count: number }[]
                  ).map((t) => (
                    <button
                      key={t.key}
                      className={`${styles.tab} ${filter === t.key ? styles.tabActive : ''}`}
                      onClick={() => setFilter(t.key)}
                    >
                      {t.label} <span className={styles.tabCount}>{t.count}</span>
                    </button>
                  ))}
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Anchor</th>
                        <th>Auth</th>
                        <th>Toxicity</th>
                        <th>Risk Factors</th>
                        <th>Type</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLinks.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            style={{
                              textAlign: 'center',
                              padding: 32,
                              color: 'var(--text-tertiary)',
                            }}
                          >
                            No links in this filter
                          </td>
                        </tr>
                      )}
                      {filteredLinks.map((link) => (
                        <LinkRow
                          key={link.id}
                          link={link}
                          onStatusChange={handleStatusChange}
                          isUpdating={updateLink.isPending}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Link Row ─────────────────────────────────────
function LinkRow({
  link,
  onStatusChange,
  isUpdating,
}: {
  link: BacklinkAuditLink;
  onStatusChange: (linkId: string, status: BacklinkAuditLinkStatus) => void;
  isUpdating: boolean;
}) {
  const levelClass = (lvl: BacklinkAuditToxicityLevel) =>
    lvl === 'toxic'
      ? styles.levelToxic
      : lvl === 'suspicious'
        ? styles.levelSuspicious
        : styles.levelClean;

  const statusClass = (s: BacklinkAuditLinkStatus) =>
    s === 'keep'
      ? styles.statusKeep
      : s === 'flag'
        ? styles.statusFlag
        : s === 'disavow'
          ? styles.statusDisavow
          : styles.statusPending;

  return (
    <tr>
      <td style={{ maxWidth: 280 }}>
        <a
          href={link.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className={styles.sourceLink}
        >
          {link.sourceTitle || link.sourceUrl}
          <ExternalLink
            size={10}
            style={{
              display: 'inline',
              marginLeft: 4,
              verticalAlign: 'middle',
            }}
          />
        </a>
        <div className={styles.tableMuted}>{link.sourceDomain}</div>
      </td>
      <td>
        <span className={styles.anchorText} title={link.anchor}>
          &ldquo;{link.anchor}&rdquo;
        </span>
      </td>
      <td>
        <span
          className={styles.scoreChip}
          style={{ background: getAuthorityColor(link.sourceAuthority) }}
        >
          {link.sourceAuthority}
        </span>
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            className={styles.scoreChip}
            style={{ background: getToxicityColor(link.toxicityScore) }}
          >
            {link.toxicityScore}
          </span>
          <span className={`${styles.levelChip} ${levelClass(link.toxicityLevel)}`}>
            {link.toxicityLevel}
          </span>
        </div>
      </td>
      <td>
        <div className={styles.riskFactors}>
          {(link.riskFactors || []).slice(0, 4).map((f, i) => (
            <span key={i} className={styles.riskChip}>
              {f}
            </span>
          ))}
          {(link.riskFactors?.length || 0) > 4 && (
            <span className={styles.riskChip}>
              +{(link.riskFactors?.length || 0) - 4}
            </span>
          )}
        </div>
      </td>
      <td>
        <span className={styles.tableMuted}>{link.linkType}</span>
      </td>
      <td>
        <select
          className={`${styles.statusSelect} ${statusClass(link.status)}`}
          value={link.status}
          disabled={isUpdating}
          onChange={(e) =>
            onStatusChange(link.id, e.target.value as BacklinkAuditLinkStatus)
          }
        >
          <option value="pending">Pending</option>
          <option value="keep">Keep</option>
          <option value="flag">Flag</option>
          <option value="disavow">Disavow</option>
        </select>
      </td>
    </tr>
  );
}

export default function BacklinkAuditPage() {
  return (
    <AuthGuard>
      <BacklinkAuditContent />
    </AuthGuard>
  );
}
