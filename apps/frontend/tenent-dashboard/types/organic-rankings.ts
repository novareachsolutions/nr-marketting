export type ChangeType = 'improved' | 'declined' | 'new' | 'lost';
export type SearchIntent = 'informational' | 'navigational' | 'commercial' | 'transactional';

export interface OrganicRankingsSummary {
  totalOrganicKeywords: number;
  organicMonthlyTraffic: number;
  organicTrafficCost: number;
  brandedTrafficPercent: number;
  nonBrandedTrafficPercent: number;
}

export interface OrganicRankingPosition {
  keyword: string;
  position: number;
  previousPosition: number | null;
  volume: number;
  trafficPercent: number;
  trafficCost: number;
  url: string;
  serpFeatures: string[];
  intent: SearchIntent;
  kd: number;
  cpc: number;
  lastUpdated: string;
}

export interface OrganicRankingChange {
  keyword: string;
  changeType: ChangeType;
  oldPosition: number | null;
  newPosition: number | null;
  change: number;
  volume: number;
  url: string;
  trafficImpact: number;
}

export interface OrganicRankingCompetitor {
  domain: string;
  commonKeywords: number;
  seKeywords: number;
  seTraffic: number;
  trafficCost: number;
  paidKeywords: number;
}

export interface OrganicRankingPage {
  url: string;
  trafficPercent: number;
  keywords: number;
  traffic: number;
}

export interface OrganicRankingsData {
  domain: string;
  country: string;
  summary: OrganicRankingsSummary;
  positions: OrganicRankingPosition[];
  positionChanges: OrganicRankingChange[];
  competitors: OrganicRankingCompetitor[];
  pages: OrganicRankingPage[];
}
