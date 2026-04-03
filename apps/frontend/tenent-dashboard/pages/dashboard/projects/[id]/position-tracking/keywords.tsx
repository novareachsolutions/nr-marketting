import { useState, FormEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar, sidebarStyles } from '@/components/layout/Sidebar';
import {
  useTrackedKeywords,
  useKeywordTags,
  useAddTrackedKeywords,
  useImportProjectKeywords,
  useDeleteTrackedKeyword,
  useBulkDeleteTrackedKeywords,
  useBulkTagKeywords,
  useBulkUntagKeywords,
  useCreateKeywordTag,
  useDeleteKeywordTag,
  useTriggerRankCheck,
} from '@/hooks/usePositionTracking';
import { useProjectKeywords } from '@/hooks/useKeywords';
import { showSuccessToast } from '@repo/shared-frontend';
import type {
  TrackedKeywordWithPosition,
  TrackedKeywordsFilters,
  ChangeType,
  KeywordTag,
} from '@/types/positionTracking';
import styles from './keywords.module.css';

function getPositionColor(pos: number | null): string {
  if (pos === null) return '#94a3b8';
  if (pos <= 3) return '#22c55e';
  if (pos <= 10) return '#84cc16';
  if (pos <= 20) return '#eab308';
  if (pos <= 50) return '#f97316';
  return '#ef4444';
}

function getChangeDisplay(kw: TrackedKeywordWithPosition) {
  if (kw.changeType === 'new') return { text: 'NEW', color: '#3b82f6' };
  if (kw.changeType === 'lost') return { text: 'LOST', color: '#94a3b8' };
  if (kw.change === null || kw.change === 0) return { text: '--', color: 'var(--text-tertiary)' };
  if (kw.change > 0) return { text: `+${kw.change.toFixed(1)}`, color: '#22c55e' };
  return { text: kw.change.toFixed(1), color: '#ef4444' };
}

function formatVolume(v: number | null): string {
  if (v === null) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toString();
}

function RankingsTableContent() {
  const router = useRouter();
  const { id: projectId } = router.query as { id: string };
  const queryClient = useQueryClient();

  // State
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [filters, setFilters] = useState<TrackedKeywordsFilters>({});
  const [searchInput, setSearchInput] = useState('');

  // Hooks
  const { data, isLoading } = useTrackedKeywords(projectId, page, 50, filters);
  const { data: tags } = useKeywordTags(projectId);
  const deleteKeyword = useDeleteTrackedKeyword();
  const bulkDelete = useBulkDeleteTrackedKeywords();
  const bulkTag = useBulkTagKeywords();
  const bulkUntag = useBulkUntagKeywords();
  const triggerCheck = useTriggerRankCheck();

  const keywords = data?.keywords || [];
  const totalPages = data?.totalPages || 1;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['pt-keywords'] });
    queryClient.invalidateQueries({ queryKey: ['pt-overview'] });
    queryClient.invalidateQueries({ queryKey: ['pt-tags'] });
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput || undefined }));
    setPage(1);
  };

  const handleFilterChange = (key: keyof TrackedKeywordsFilters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
    setPage(1);
  };

  const handleSort = (field: string) => {
    setFilters((f) => ({
      ...f,
      sort: field,
      order: f.sort === field && f.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === keywords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(keywords.map((k) => k.id)));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteKeyword.mutateAsync({
        url: `/projects/${projectId}/position-tracking/keywords/${id}`,
      });
      invalidateAll();
    } catch {}
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await bulkDelete.mutateAsync({
        url: `/projects/${projectId}/position-tracking/keywords/bulk-delete`,
        body: { keywordIds: Array.from(selectedIds) },
      });
      setSelectedIds(new Set());
      invalidateAll();
      showSuccessToast('Deleted', `${selectedIds.size} keywords removed`);
    } catch {}
  };

  const handleBulkTag = async (tagId: string) => {
    if (selectedIds.size === 0) return;
    try {
      await bulkTag.mutateAsync({
        url: `/projects/${projectId}/position-tracking/keywords/bulk-tag`,
        body: { keywordIds: Array.from(selectedIds), tagId },
      });
      invalidateAll();
      showSuccessToast('Tagged', `${selectedIds.size} keywords tagged`);
    } catch {}
  };

  const handleCheckNow = async () => {
    try {
      await triggerCheck.mutateAsync({
        url: `/projects/${projectId}/position-tracking/check-now`,
        body: {},
      });
      showSuccessToast('Check Started', 'Position check running in background');
      setTimeout(() => invalidateAll(), 3000);
    } catch {}
  };

  const sortArrow = (field: string) => {
    if (filters.sort !== field) return '';
    return filters.order === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <>
      <Sidebar projectId={projectId} />
      <Head>
        <title>Rankings Table | NR SEO</title>
      </Head>

      <main className={`${sidebarStyles.contentWithSidebar} ${styles.main}`}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Rankings Table</h1>
            <p className={styles.subtitle}>
              <Link
                href={`/dashboard/projects/${projectId}/position-tracking`}
                className={styles.backLink}
              >
                ← Overview
              </Link>
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.secondaryBtn} onClick={handleCheckNow}>
              Check Now
            </button>
            <button className={styles.secondaryBtn} onClick={() => setShowTagManager(true)}>
              Manage Tags
            </button>
            <button className={styles.primaryBtn} onClick={() => setShowAddModal(true)}>
              + Add Keywords
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filtersRow}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <input
              className={styles.searchInput}
              placeholder="Search keywords..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className={styles.searchBtn}>
              Search
            </button>
          </form>

          <select
            className={styles.filterSelect}
            value={filters.changeType || ''}
            onChange={(e) => handleFilterChange('changeType', e.target.value)}
          >
            <option value="">All Changes</option>
            <option value="improved">Improved</option>
            <option value="declined">Declined</option>
            <option value="new">New</option>
            <option value="lost">Lost</option>
          </select>

          <select
            className={styles.filterSelect}
            value={filters.tagId || ''}
            onChange={(e) => handleFilterChange('tagId', e.target.value)}
          >
            <option value="">All Tags</option>
            {(tags || []).map((t: KeywordTag) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.keywordCount})
              </option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={filters.device || ''}
            onChange={(e) => handleFilterChange('device', e.target.value)}
          >
            <option value="">All Devices</option>
            <option value="DESKTOP">Desktop</option>
            <option value="MOBILE">Mobile</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className={styles.bulkBar}>
            <span>{selectedIds.size} selected</span>
            <select
              className={styles.bulkTagSelect}
              onChange={(e) => {
                if (e.target.value) handleBulkTag(e.target.value);
                e.target.value = '';
              }}
              defaultValue=""
            >
              <option value="" disabled>
                Assign Tag...
              </option>
              {(tags || []).map((t: KeywordTag) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className={styles.bulkDeleteBtn} onClick={handleBulkDelete}>
              Delete Selected
            </button>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className={styles.loadingState}>Loading keywords...</div>
        ) : keywords.length === 0 ? (
          <div className={styles.emptyState}>
            <h2>No tracked keywords</h2>
            <p>Add keywords to start tracking their Google rankings.</p>
            <button className={styles.primaryBtn} onClick={() => setShowAddModal(true)}>
              + Add Keywords
            </button>
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.checkCol}>
                      <input
                        type="checkbox"
                        checked={selectedIds.size === keywords.length && keywords.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className={styles.kwCol} onClick={() => handleSort('keyword')}>
                      Keyword{sortArrow('keyword')}
                    </th>
                    <th className={styles.posCol} onClick={() => handleSort('position')}>
                      Position{sortArrow('position')}
                    </th>
                    <th className={styles.changeCol} onClick={() => handleSort('change')}>
                      Change{sortArrow('change')}
                    </th>
                    <th onClick={() => handleSort('searchVolume')}>
                      Volume{sortArrow('searchVolume')}
                    </th>
                    <th>URL</th>
                    <th>Tags</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw: TrackedKeywordWithPosition) => {
                    const ch = getChangeDisplay(kw);
                    return (
                      <tr key={kw.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(kw.id)}
                            onChange={() => toggleSelect(kw.id)}
                          />
                        </td>
                        <td className={styles.kwCell}>
                          <Link
                            href={`/dashboard/projects/${projectId}/position-tracking/keywords/${kw.id}`}
                            className={styles.kwLink}
                          >
                            {kw.keyword}
                          </Link>
                        </td>
                        <td>
                          <span
                            className={styles.posBadge}
                            style={{ backgroundColor: getPositionColor(kw.currentPosition) }}
                          >
                            {kw.currentPosition !== null
                              ? Math.round(kw.currentPosition)
                              : '--'}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: ch.color, fontWeight: 600, fontSize: '13px' }}>
                            {ch.text}
                          </span>
                        </td>
                        <td>{formatVolume(kw.searchVolume)}</td>
                        <td className={styles.urlCell}>
                          {kw.rankingUrl ? (
                            <span title={kw.rankingUrl}>
                              {kw.rankingUrl.replace(/^https?:\/\/[^/]+/, '').slice(0, 40)}
                            </span>
                          ) : (
                            <span className={styles.muted}>--</span>
                          )}
                        </td>
                        <td>
                          <div className={styles.tagList}>
                            {kw.tags.map((t) => (
                              <span
                                key={t.id}
                                className={styles.tagBadge}
                                style={{ backgroundColor: t.color + '22', color: t.color, borderColor: t.color + '44' }}
                              >
                                {t.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(kw.id)}
                            title="Remove from tracking"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageBtn}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {page} of {totalPages} ({data?.total} keywords)
                </span>
                <button
                  className={styles.pageBtn}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Add Keywords Modal */}
        {showAddModal && (
          <AddKeywordsModal
            projectId={projectId}
            onClose={() => setShowAddModal(false)}
            onSuccess={invalidateAll}
          />
        )}

        {/* Tag Manager Modal */}
        {showTagManager && (
          <TagManagerModal
            projectId={projectId}
            tags={(tags || []) as KeywordTag[]}
            onClose={() => setShowTagManager(false)}
            onSuccess={invalidateAll}
          />
        )}
      </main>
    </>
  );
}

// ─── ADD KEYWORDS MODAL ──────────────────────────────────

function AddKeywordsModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tab, setTab] = useState<'manual' | 'import'>('manual');
  const [keywordsText, setKeywordsText] = useState('');
  const [device, setDevice] = useState<'DESKTOP' | 'MOBILE'>('DESKTOP');
  const [country, setCountry] = useState('US');
  const [targetUrl, setTargetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());

  const addKeywords = useAddTrackedKeywords();
  const importKeywords = useImportProjectKeywords();
  const { data: projectKws } = useProjectKeywords(projectId, 1, 200);

  const handleAdd = async () => {
    const keywords = keywordsText
      .split('\n')
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywords.length === 0) return;

    setLoading(true);
    try {
      await addKeywords.mutateAsync({
        url: `/projects/${projectId}/position-tracking/keywords`,
        body: { keywords, device, country, targetUrl: targetUrl || undefined },
      });
      showSuccessToast('Added', `${keywords.length} keywords added to tracking`);
      onSuccess();
      onClose();
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (selectedImportIds.size === 0) return;
    setLoading(true);
    try {
      await importKeywords.mutateAsync({
        url: `/projects/${projectId}/position-tracking/keywords/import-from-project`,
        body: { keywordIds: Array.from(selectedImportIds), device, country },
      });
      showSuccessToast('Imported', `${selectedImportIds.size} keywords imported`);
      onSuccess();
      onClose();
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const projectKeywordsList = (projectKws as any)?.keywords || projectKws || [];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Add Keywords to Track</h2>
          <button className={styles.modalClose} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.modalTabs}>
          <button
            className={`${styles.modalTab} ${tab === 'manual' ? styles.modalTabActive : ''}`}
            onClick={() => setTab('manual')}
          >
            Manual Entry
          </button>
          <button
            className={`${styles.modalTab} ${tab === 'import' ? styles.modalTabActive : ''}`}
            onClick={() => setTab('import')}
          >
            Import from Project
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Settings Row */}
          <div className={styles.settingsRow}>
            <div className={styles.settingGroup}>
              <label>Device</label>
              <select value={device} onChange={(e) => setDevice(e.target.value as any)}>
                <option value="DESKTOP">Desktop</option>
                <option value="MOBILE">Mobile</option>
              </select>
            </div>
            <div className={styles.settingGroup}>
              <label>Country</label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                maxLength={5}
                placeholder="US"
              />
            </div>
            {tab === 'manual' && (
              <div className={styles.settingGroup}>
                <label>Target URL (optional)</label>
                <input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}
          </div>

          {tab === 'manual' ? (
            <>
              <textarea
                className={styles.keywordsTextarea}
                placeholder="Enter keywords, one per line..."
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                rows={8}
              />
              <div className={styles.keywordCount}>
                {keywordsText.split('\n').filter((k) => k.trim()).length} keywords
              </div>
              <button
                className={styles.primaryBtn}
                onClick={handleAdd}
                disabled={loading || !keywordsText.trim()}
              >
                {loading ? 'Adding...' : 'Add Keywords'}
              </button>
            </>
          ) : (
            <>
              {Array.isArray(projectKeywordsList) && projectKeywordsList.length > 0 ? (
                <div className={styles.importList}>
                  {projectKeywordsList.map((pk: any) => (
                    <label key={pk.id} className={styles.importItem}>
                      <input
                        type="checkbox"
                        checked={selectedImportIds.has(pk.id)}
                        onChange={() => {
                          setSelectedImportIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(pk.id)) next.delete(pk.id);
                            else next.add(pk.id);
                            return next;
                          });
                        }}
                      />
                      <span>{pk.keyword}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className={styles.muted}>No project keywords found. Save keywords from Keyword Research first.</p>
              )}
              <button
                className={styles.primaryBtn}
                onClick={handleImport}
                disabled={loading || selectedImportIds.size === 0}
              >
                {loading ? 'Importing...' : `Import ${selectedImportIds.size} Keywords`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TAG MANAGER MODAL ───────────────────────────────────

function TagManagerModal({
  projectId,
  tags,
  onClose,
  onSuccess,
}: {
  projectId: string;
  tags: KeywordTag[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const createTag = useCreateKeywordTag();
  const deleteTag = useDeleteKeywordTag();

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    try {
      await createTag.mutateAsync({
        url: `/projects/${projectId}/position-tracking/tags`,
        body: { name: newTagName.trim(), color: newTagColor },
      });
      setNewTagName('');
      onSuccess();
      showSuccessToast('Created', `Tag "${newTagName}" created`);
    } catch {}
  };

  const handleDelete = async (tagId: string) => {
    try {
      await deleteTag.mutateAsync({
        url: `/projects/${projectId}/position-tracking/tags/${tagId}`,
      });
      onSuccess();
    } catch {}
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalSmall} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Manage Tags</h2>
          <button className={styles.modalClose} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.createTagRow}>
            <input
              className={styles.tagNameInput}
              placeholder="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className={styles.colorPicker}
            />
            <button className={styles.primaryBtn} onClick={handleCreate}>
              Add
            </button>
          </div>
          <div className={styles.tagsList}>
            {tags.map((t) => (
              <div key={t.id} className={styles.tagRow}>
                <span
                  className={styles.tagBadge}
                  style={{
                    backgroundColor: t.color + '22',
                    color: t.color,
                    borderColor: t.color + '44',
                  }}
                >
                  {t.name}
                </span>
                <span className={styles.tagCount}>{t.keywordCount} keywords</span>
                <button className={styles.deleteBtn} onClick={() => handleDelete(t.id)}>
                  ×
                </button>
              </div>
            ))}
            {tags.length === 0 && <p className={styles.muted}>No tags yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RankingsTablePage() {
  return (
    <AuthGuard>
      <RankingsTableContent />
    </AuthGuard>
  );
}
