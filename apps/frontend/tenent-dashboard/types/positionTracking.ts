export type Device = 'DESKTOP' | 'MOBILE';
export type ChangeType = 'improved' | 'declined' | 'new' | 'lost' | 'unchanged';

export interface TrackedKeywordWithPosition {
  id: string;
  keyword: string;
  targetUrl: string | null;
  device: Device;
  country: string;
  searchVolume: number | null;
  isActive: boolean;
  createdAt: string;
  currentPosition: number | null;
  previousPosition: number | null;
  change: number | null;
  changeType: ChangeType;
  rankingUrl: string | null;
  serpFeatures: string | null;
  tags: KeywordTag[];
}

export interface PositionTrackingOverview {
  visibilityScore: number;
  previousVisibilityScore: number | null;
  estimatedTraffic: number;
  previousEstimatedTraffic: number | null;
  averagePosition: number | null;
  previousAveragePosition: number | null;
  totalKeywords: number;
  distribution: {
    top3: number;
    top10: number;
    top20: number;
    top50: number;
    top100: number;
    notRanking: number;
  };
  changes: {
    improved: number;
    declined: number;
    new: number;
    lost: number;
  };
  lastCheckedAt: string | null;
  rankCheckSchedule: string;
}

export interface PositionTrendPoint {
  date: string;
  visibilityScore: number;
  estimatedTraffic: number;
  averagePosition: number | null;
}

export interface RankingHistoryEntry {
  id: string;
  position: number | null;
  clicks: number;
  impressions: number;
  ctr: number;
  rankingUrl: string | null;
  serpFeatures: string | null;
  date: string;
  source: string;
}

export interface KeywordTag {
  id: string;
  name: string;
  color: string;
  keywordCount?: number;
}

export interface TrackedKeywordsResponse {
  keywords: TrackedKeywordWithPosition[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface TrackedKeywordsFilters {
  tagId?: string;
  positionMin?: number;
  positionMax?: number;
  changeType?: ChangeType;
  device?: Device;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface KeywordHistoryResponse {
  keyword: string;
  targetUrl: string | null;
  device: Device;
  country: string;
  searchVolume: number | null;
  history: RankingHistoryEntry[];
}
