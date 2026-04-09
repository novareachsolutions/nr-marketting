import { useGet, usePost, useDelete } from '@repo/shared-frontend';
import type {
  CrawlJob,
  CrawlJobDetail,
  CrawlIssue,
  CrawlPage,
  CrawlComparison,
  ThematicReports,
  ScoreHistoryEntry,
  IssueTrends,
  PaginatedResponse,
} from '@/types/audit';

export function useAudits(projectId: string, page: number = 1, perPage: number = 10) {
  return useGet<PaginatedResponse<CrawlJob>>(
    `/projects/${projectId}/crawls?page=${page}&perPage=${perPage}`,
    ['audits', projectId, String(page), String(perPage)],
    { enabled: !!projectId, staleTime: 15000 },
  );
}

export function useAudit(projectId: string, crawlId: string) {
  return useGet<CrawlJobDetail>(
    `/projects/${projectId}/crawls/${crawlId}`,
    ['audit', crawlId],
    { enabled: !!projectId && !!crawlId, staleTime: 10000 },
  );
}

export function useStartAudit() {
  return usePost<CrawlJob>(['audits']);
}

export function useCancelAudit() {
  return usePost<{ message: string }>(['audits']);
}

export function useDeleteAudit() {
  return useDelete<{ message: string }>(['audits']);
}

export function useCrawlIssues(
  projectId: string,
  crawlId: string,
  severity?: string,
  type?: string,
  page: number = 1,
  perPage: number = 20,
) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('perPage', String(perPage));
  if (severity) params.set('severity', severity);
  if (type) params.set('type', type);

  return useGet<PaginatedResponse<CrawlIssue>>(
    `/projects/${projectId}/crawls/${crawlId}/issues?${params.toString()}`,
    ['crawlIssues', crawlId, severity || '', type || '', String(page)],
    { enabled: !!projectId && !!crawlId, staleTime: 15000 },
  );
}

export function useCrawlPages(
  projectId: string,
  crawlId: string,
  statusCode?: number,
  page: number = 1,
  perPage: number = 20,
) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('perPage', String(perPage));
  if (statusCode !== undefined) params.set('statusCode', String(statusCode));

  return useGet<PaginatedResponse<CrawlPage>>(
    `/projects/${projectId}/crawls/${crawlId}/pages?${params.toString()}`,
    ['crawlPages', crawlId, String(statusCode ?? ''), String(page)],
    { enabled: !!projectId && !!crawlId, staleTime: 15000 },
  );
}

// Phase A: Crawl Comparison
export function useCrawlComparison(
  projectId: string,
  crawlId: string,
  enabled: boolean = true,
  previousCrawlId?: string,
) {
  const params = previousCrawlId ? `?previousCrawlId=${previousCrawlId}` : '';
  return useGet<CrawlComparison>(
    `/projects/${projectId}/crawls/${crawlId}/compare${params}`,
    ['crawlComparison', crawlId, previousCrawlId || 'auto'],
    { enabled: enabled && !!projectId && !!crawlId, staleTime: 30000 },
  );
}

// Phase B: Thematic Reports
export function useThematicReports(projectId: string, crawlId: string) {
  return useGet<ThematicReports>(
    `/projects/${projectId}/crawls/${crawlId}/themes`,
    ['thematicReports', crawlId],
    { enabled: !!projectId && !!crawlId, staleTime: 30000 },
  );
}

// Phase C: Score History & Issue Trends
export function useScoreHistory(projectId: string, limit: number = 10) {
  return useGet<ScoreHistoryEntry[]>(
    `/projects/${projectId}/audit-analytics/score-history?limit=${limit}`,
    ['scoreHistory', projectId, String(limit)],
    { enabled: !!projectId, staleTime: 30000 },
  );
}

export function useIssueTrends(projectId: string, limit: number = 10) {
  return useGet<IssueTrends>(
    `/projects/${projectId}/audit-analytics/issue-trends?limit=${limit}`,
    ['issueTrends', projectId, String(limit)],
    { enabled: !!projectId, staleTime: 30000 },
  );
}
