export interface TopPagesSummary {
  totalPages: number;
  totalOrganicTraffic: number;
  avgKeywordsPerPage: number;
}

export interface TopPage {
  url: string;
  traffic: number;
  trafficPercent: number;
  keywords: number;
  topKeyword: string;
  topKeywordPosition: number;
  backlinks: number;
  trafficTrend: number[];
}

export interface TopPagesData {
  domain: string;
  country: string;
  summary: TopPagesSummary;
  pages: TopPage[];
}
