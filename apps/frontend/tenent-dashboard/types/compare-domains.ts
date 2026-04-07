export interface DomainMetrics {
  domain: string;
  authorityScore: number;
  organicKeywords: number;
  organicTraffic: number;
  organicTrafficCost: number;
  paidKeywords: number;
  paidTraffic: number;
  backlinks: number;
  referringDomains: number;
  trafficTrend: { date: string; traffic: number }[];
}

export interface CommonKeyword {
  keyword: string;
  volume: number;
  positions: Record<string, number>;
}

export interface KeywordOverlap {
  shared: number;
  unique: Record<string, number>;
  totalUniverse: number;
}

export interface CompareDomainData {
  domains: DomainMetrics[];
  keywordOverlap: KeywordOverlap;
  commonKeywords: CommonKeyword[];
  intentComparison: Record<string, {
    informational: number;
    navigational: number;
    commercial: number;
    transactional: number;
  }>;
}
