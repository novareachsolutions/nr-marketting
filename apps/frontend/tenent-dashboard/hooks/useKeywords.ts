import { useGet, usePost, useDelete } from '@repo/shared-frontend';
import type {
  KeywordData,
  SuggestionsResponse,
  ProjectKeywordsResponse,
  KeywordGapResponse,
  KeywordExportData,
  SuggestionFilters,
} from '@/types/keyword';

export function useKeywordSearch(q: string, country: string = 'US') {
  return useGet<KeywordData>(
    `/keywords/search?q=${encodeURIComponent(q)}&country=${country}`,
    ['keyword-search', q, country],
    { enabled: !!q },
  );
}

export function useKeywordSuggestions(
  q: string,
  country: string = 'US',
  limit: number = 50,
  page: number = 1,
  enabled: boolean = false,
  filters?: SuggestionFilters,
) {
  const params = new URLSearchParams();
  params.set('q', q);
  params.set('country', country);
  params.set('limit', String(limit));
  params.set('page', String(page));

  if (filters) {
    if (filters.minVolume !== undefined) params.set('minVolume', String(filters.minVolume));
    if (filters.maxVolume !== undefined) params.set('maxVolume', String(filters.maxVolume));
    if (filters.minKd !== undefined) params.set('minKd', String(filters.minKd));
    if (filters.maxKd !== undefined) params.set('maxKd', String(filters.maxKd));
    if (filters.intent) params.set('intent', filters.intent);
    if (filters.questionsOnly) params.set('questionsOnly', 'true');
    if (filters.minWords !== undefined) params.set('minWords', String(filters.minWords));
    if (filters.maxWords !== undefined) params.set('maxWords', String(filters.maxWords));
    if (filters.matchType) params.set('matchType', filters.matchType);
    if (filters.includeWords) params.set('includeWords', filters.includeWords);
    if (filters.excludeWords) params.set('excludeWords', filters.excludeWords);
  }

  const filterKey = filters ? JSON.stringify(filters) : '';

  return useGet<SuggestionsResponse>(
    `/keywords/suggestions?${params.toString()}`,
    ['keyword-suggestions', q, country, String(limit), String(page), filterKey],
    { enabled: enabled && !!q },
  );
}

export function useProjectKeywords(
  projectId: string,
  page: number = 1,
  perPage: number = 50,
) {
  return useGet<ProjectKeywordsResponse>(
    `/projects/${projectId}/keywords?page=${page}&perPage=${perPage}`,
    ['project-keywords', projectId, String(page)],
    { enabled: !!projectId },
  );
}

export function useKeywordGap(
  projectId: string,
  competitors: string,
  enabled: boolean = false,
) {
  return useGet<KeywordGapResponse>(
    `/projects/${projectId}/keyword-gap?competitors=${encodeURIComponent(competitors)}`,
    ['keyword-gap', projectId, competitors],
    { enabled: enabled && !!projectId && !!competitors },
  );
}

export function useKeywordExport(projectId: string, enabled: boolean = false) {
  return useGet<KeywordExportData>(
    `/projects/${projectId}/keywords/export`,
    ['keyword-export', projectId],
    { enabled: enabled && !!projectId },
  );
}

export function useSaveKeyword() {
  return usePost<any>(['project-keywords']);
}

export function useRemoveKeyword() {
  return useDelete<{ message: string }>(['project-keywords']);
}
