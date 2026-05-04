import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Loader2,
  MinusCircle,
} from 'lucide-react';
import type {
  ChecklistReport,
  ChecklistItemResult,
  ChecklistStatus,
} from '@/types/audit';
import styles from './ChecklistTable.module.css';

type StatusFilter = 'all' | 'failing' | ChecklistStatus;

const CATEGORY_COLORS: Record<number, string> = {
  1: '#ec4899', 2: '#22c55e', 3: '#3b82f6', 4: '#ef4444', 5: '#a855f7',
  6: '#eab308', 7: '#f97316', 8: '#06b6d4', 9: '#84cc16', 10: '#64748b',
};

interface Props {
  report: ChecklistReport | undefined;
  isLoading: boolean;
  isError?: boolean;
}

export function ChecklistTable({ report, isLoading, isError }: Props) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const filteredCategories = useMemo(() => {
    if (!report) return [];
    if (filter === 'all') return report.categories;
    return report.categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => matchesFilter(item, filter)),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [report, filter]);

  if (isLoading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.loadingState}>
          <Loader2 size={18} className="animate-spin" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
          Loading checklist...
        </div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          Could not load the audit checklist. Run a crawl first or refresh the page.
        </div>
      </div>
    );
  }

  const { totals } = report;
  const failingCount = totals.errors + totals.warnings + totals.notices;

  const toggleCategory = (id: number) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className={styles.wrap}>
      {/* Header summary */}
      <div className={styles.headerRow}>
        <div>
          <div className={styles.headerTitle}>
            <ListChecks size={16} /> Technical SEO Audit Checklist
          </div>
          <div className={styles.headerSubtitle}>
            {totals.items} checks across {report.categories.length} categories — mark status as you audit each item.
          </div>
        </div>
        <div className={styles.totalsBadges}>
          <span className={`${styles.totalChip} ${styles.totalChipPass}`}>
            <CheckCircle2 size={14} /> {totals.passed} passed
          </span>
          <span className={`${styles.totalChip} ${styles.totalChipError}`}>
            <XCircle size={14} /> {totals.errors} errors
          </span>
          <span className={`${styles.totalChip} ${styles.totalChipWarn}`}>
            <AlertTriangle size={14} /> {totals.warnings} warnings
          </span>
          <span className={`${styles.totalChip} ${styles.totalChipNotice}`}>
            <Info size={14} /> {totals.notices} notices
          </span>
          {totals.skipped > 0 && (
            <span className={`${styles.totalChip} ${styles.totalChipSkip}`}>
              <MinusCircle size={14} /> {totals.skipped} skipped
            </span>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>Filter</span>
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          All <span className={styles.filterCount}>{totals.items}</span>
        </FilterButton>
        <FilterButton active={filter === 'failing'} onClick={() => setFilter('failing')}>
          Failing <span className={styles.filterCount}>{failingCount}</span>
        </FilterButton>
        <FilterButton active={filter === 'Error'} onClick={() => setFilter('Error')}>
          Errors <span className={styles.filterCount}>{totals.errors}</span>
        </FilterButton>
        <FilterButton active={filter === 'Warning'} onClick={() => setFilter('Warning')}>
          Warnings <span className={styles.filterCount}>{totals.warnings}</span>
        </FilterButton>
        <FilterButton active={filter === 'Notice'} onClick={() => setFilter('Notice')}>
          Notices <span className={styles.filterCount}>{totals.notices}</span>
        </FilterButton>
        <FilterButton active={filter === 'Pass'} onClick={() => setFilter('Pass')}>
          Passed <span className={styles.filterCount}>{totals.passed}</span>
        </FilterButton>
        <FilterButton active={filter === 'Skipped'} onClick={() => setFilter('Skipped')}>
          Skipped <span className={styles.filterCount}>{totals.skipped}</span>
        </FilterButton>
      </div>

      {/* Categories */}
      {filteredCategories.length === 0 ? (
        <div className={styles.empty}>No items match the current filter.</div>
      ) : (
        filteredCategories.map((cat) => {
          const isCollapsed = collapsedCategories.has(cat.id);
          return (
            <div key={cat.id} className={styles.category}>
              <div
                className={styles.categoryHeader}
                onClick={() => toggleCategory(cat.id)}
              >
                <div className={styles.categoryHeaderLeft}>
                  <span
                    className={styles.categoryColorBar}
                    style={{ background: CATEGORY_COLORS[cat.id] || '#64748b' }}
                  />
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  <span className={styles.categoryName}>
                    {cat.id}. {cat.name}
                  </span>
                </div>
                <div className={styles.categoryStats}>
                  {cat.summary.errors > 0 && (
                    <span className={`${styles.statDot} ${styles.statDotError}`}>{cat.summary.errors} err</span>
                  )}
                  {cat.summary.warnings > 0 && (
                    <span className={`${styles.statDot} ${styles.statDotWarn}`}>{cat.summary.warnings} warn</span>
                  )}
                  {cat.summary.notices > 0 && (
                    <span className={`${styles.statDot} ${styles.statDotNotice}`}>{cat.summary.notices} notice</span>
                  )}
                  {cat.summary.passed > 0 && (
                    <span className={`${styles.statDot} ${styles.statDotPass}`}>{cat.summary.passed} pass</span>
                  )}
                  {cat.summary.skipped > 0 && (
                    <span className={`${styles.statDot} ${styles.statDotSkip}`}>{cat.summary.skipped} skipped</span>
                  )}
                </div>
              </div>

              {!isCollapsed && (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Checklist Item</th>
                        <th className={styles.colSeverity}>Status</th>
                        <th className={styles.colStatus}>Done</th>
                        <th className={styles.colPriority}>Priority</th>
                        <th className={styles.colCount}>Affected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.items.map((item) => (
                        <ChecklistRow
                          key={item.id}
                          item={item}
                          expanded={expandedItems.has(item.id)}
                          onToggle={() => toggleItem(item.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.filterBtn} ${active ? styles.filterBtnActive : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ChecklistRow({
  item,
  expanded,
  onToggle,
}: {
  item: ChecklistItemResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasDetails =
    item.affectedUrls.length > 0 || !!item.message || !!item.suggestion;

  return (
    <>
      <tr>
        <td className={styles.idCell}>{item.id}</td>
        <td className={styles.titleCell}>
          {item.title}
          {item.status === 'Skipped' && item.message && (
            <span className={styles.titleNote}>{item.message}</span>
          )}
          {hasDetails && (
            <div style={{ marginTop: 4 }}>
              <button
                type="button"
                className={styles.expandToggleBtn}
                onClick={onToggle}
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {expanded ? 'Hide details' : 'View details'}
              </button>
            </div>
          )}
        </td>
        <td>
          <StatusBadge status={item.status} />
        </td>
        <td>
          <DoneBadge status={item.status} />
        </td>
        <td>
          <PriorityBadge severity={item.severity} />
        </td>
        <td className={`${styles.affectedCount} ${item.affectedCount === 0 ? styles.affectedCountZero : ''}`}>
          {item.affectedCount > 0 ? item.affectedCount : '—'}
        </td>
      </tr>

      {expanded && hasDetails && (
        <tr className={styles.expandRow}>
          <td className={styles.expandCell} colSpan={6}>
            {item.message && (
              <div className={styles.expandSection}>
                <div className={styles.expandLabel}>What we found</div>
                <div className={styles.expandText}>{item.message}</div>
              </div>
            )}
            {item.suggestion && (
              <div className={styles.expandSection}>
                <div className={styles.expandLabel}>How to fix</div>
                <div className={styles.expandText}>{item.suggestion}</div>
              </div>
            )}
            {item.affectedUrls.length > 0 && (
              <div className={styles.expandSection}>
                <div className={styles.expandLabel}>
                  Sample affected URLs ({item.affectedCount} total)
                </div>
                <ul className={styles.urlList}>
                  {item.affectedUrls.map((url) => (
                    <li key={url}>{url}</li>
                  ))}
                </ul>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: ChecklistStatus }) {
  const cls =
    status === 'Error' ? styles.statusError :
    status === 'Warning' ? styles.statusWarning :
    status === 'Notice' ? styles.statusNotice :
    status === 'Pass' ? styles.statusPass :
    styles.statusSkipped;

  return <span className={`${styles.statusBadge} ${cls}`}>{status}</span>;
}

function DoneBadge({ status }: { status: ChecklistStatus }) {
  if (status === 'Pass') {
    return (
      <span className={`${styles.doneBadge} ${styles.doneYes}`}>
        <CheckCircle2 size={14} /> Done
      </span>
    );
  }
  if (status === 'Skipped') {
    return <span className={`${styles.doneBadge} ${styles.doneSkipped}`}>Not checked</span>;
  }
  return (
    <span className={`${styles.doneBadge} ${styles.doneNo}`}>
      <XCircle size={14} /> Not done
    </span>
  );
}

function PriorityBadge({ severity }: { severity: 'High' | 'Medium' | 'Low' }) {
  const cls =
    severity === 'High' ? styles.priorityHigh :
    severity === 'Medium' ? styles.priorityMedium :
    styles.priorityLow;
  return (
    <span className={`${styles.priorityBadge} ${cls}`}>
      <span className={styles.priorityDot} />
      {severity}
    </span>
  );
}

function matchesFilter(item: ChecklistItemResult, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'failing') {
    return item.status === 'Error' || item.status === 'Warning' || item.status === 'Notice';
  }
  return item.status === filter;
}
