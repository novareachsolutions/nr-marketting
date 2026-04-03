import { useGet, usePost, useDelete, usePatch } from '@repo/shared-frontend';
import type {
  PositionTrackingOverview,
  PositionTrendPoint,
  TrackedKeywordsResponse,
  TrackedKeywordsFilters,
  KeywordHistoryResponse,
  KeywordTag,
} from '@/types/positionTracking';

// ─── OVERVIEW ─────────────────────────────────────────────

export function usePositionTrackingOverview(
  projectId: string,
  device?: string,
) {
  const params = device ? `?device=${device}` : '';
  return useGet<PositionTrackingOverview>(
    `/projects/${projectId}/position-tracking/overview${params}`,
    ['pt-overview', projectId, device || ''],
    { enabled: !!projectId },
  );
}

export function usePositionTrackingTrend(
  projectId: string,
  days: number = 30,
  device?: string,
) {
  const params = new URLSearchParams();
  params.set('days', String(days));
  if (device) params.set('device', device);

  return useGet<PositionTrendPoint[]>(
    `/projects/${projectId}/position-tracking/overview/trend?${params.toString()}`,
    ['pt-trend', projectId, String(days), device || ''],
    { enabled: !!projectId },
  );
}

// ─── TRACKED KEYWORDS ─────────────────────────────────────

export function useTrackedKeywords(
  projectId: string,
  page: number = 1,
  perPage: number = 50,
  filters?: TrackedKeywordsFilters,
) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('perPage', String(perPage));

  if (filters) {
    if (filters.tagId) params.set('tagId', filters.tagId);
    if (filters.positionMin !== undefined) params.set('positionMin', String(filters.positionMin));
    if (filters.positionMax !== undefined) params.set('positionMax', String(filters.positionMax));
    if (filters.changeType) params.set('changeType', filters.changeType);
    if (filters.device) params.set('device', filters.device);
    if (filters.search) params.set('search', filters.search);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.order) params.set('order', filters.order);
  }

  const filterKey = filters ? JSON.stringify(filters) : '';

  return useGet<TrackedKeywordsResponse>(
    `/projects/${projectId}/position-tracking/keywords?${params.toString()}`,
    ['pt-keywords', projectId, String(page), String(perPage), filterKey],
    { enabled: !!projectId },
  );
}

export function useTrackedKeywordHistory(
  projectId: string,
  keywordId: string,
  days: number = 30,
) {
  return useGet<KeywordHistoryResponse>(
    `/projects/${projectId}/position-tracking/keywords/${keywordId}/history?days=${days}`,
    ['pt-keyword-history', projectId, keywordId, String(days)],
    { enabled: !!projectId && !!keywordId },
  );
}

// ─── TAGS ─────────────────────────────────────────────────

export function useKeywordTags(projectId: string) {
  return useGet<KeywordTag[]>(
    `/projects/${projectId}/position-tracking/tags`,
    ['pt-tags', projectId],
    { enabled: !!projectId },
  );
}

// ─── MUTATIONS ────────────────────────────────────────────

export function useAddTrackedKeywords() {
  return usePost<any>(['pt-keywords', 'pt-overview']);
}

export function useImportProjectKeywords() {
  return usePost<any>(['pt-keywords', 'pt-overview']);
}

export function useUpdateTrackedKeyword() {
  return usePatch<any>(['pt-keywords']);
}

export function useDeleteTrackedKeyword() {
  return useDelete<any>(['pt-keywords', 'pt-overview']);
}

export function useBulkDeleteTrackedKeywords() {
  return usePost<any>(['pt-keywords', 'pt-overview']);
}

export function useBulkTagKeywords() {
  return usePost<any>(['pt-keywords', 'pt-tags']);
}

export function useBulkUntagKeywords() {
  return usePost<any>(['pt-keywords', 'pt-tags']);
}

export function useCreateKeywordTag() {
  return usePost<any>(['pt-tags']);
}

export function useDeleteKeywordTag() {
  return useDelete<any>(['pt-tags']);
}

export function useTriggerRankCheck() {
  return usePost<any>(['pt-keywords', 'pt-overview']);
}

export function useUpdateRankSchedule() {
  return usePatch<any>(['pt-overview']);
}
