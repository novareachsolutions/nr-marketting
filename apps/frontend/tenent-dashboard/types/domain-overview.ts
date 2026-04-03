export interface DomainOverviewData {
  domain: string;
  country: string;

  // Authority
  authorityScore: number | null;
  authorityTrend: number[] | null;

  // Organic Search
  organicKeywords: number | null;
  organicTraffic: number | null;
  organicTrafficCost: number | null;
  organicTrafficTrend: { date: string; traffic: number }[] | null;

  // Paid Search
  paidKeywords: number | null;
  paidTraffic: number | null;
  paidTrafficCost: number | null;

  // Backlinks
  totalBacklinks: number | null;
  referringDomains: number | null;
  followBacklinks: number | null;
  nofollowBacklinks: number | null;

  // Distributions
  intentDistribution: {
    informational: number;
    navigational: number;
    commercial: number;
    transactional: number;
  } | null;

  positionDistribution: {
    top3: number;
    pos4_10: number;
    pos11_20: number;
    pos21_50: number;
    pos51_100: number;
  } | null;

  // Tables
  topOrganicKeywords: {
    keyword: string;
    position: number;
    volume: number;
    trafficPercent: number;
    url: string;
  }[] | null;

  topOrganicPages: {
    url: string;
    traffic: number;
    keywords: number;
  }[] | null;

  // Competitors
  topCompetitors: {
    domain: string;
    commonKeywords: number;
    organicKeywords: number;
    organicTraffic: number;
  }[] | null;

  // Country Distribution
  countryDistribution: {
    country: string;
    trafficShare: number;
  }[] | null;
}
