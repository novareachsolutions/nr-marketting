export type BacklinkGapType = 'best' | 'weak' | 'strong' | 'shared' | 'unique';

export interface ReferringDomain {
  domain: string;
  authorityScore: number;
  monthlyVisits: number;
  matches: number;
  backlinksPerDomain: Record<string, number>;
  gapType: BacklinkGapType;
}

export interface BacklinkGapSummary {
  totalReferringDomains: number;
  best: number;
  weak: number;
  strong: number;
  shared: number;
  unique: number;
}

export interface BacklinkGapData {
  domains: string[];
  country: string;
  summary: BacklinkGapSummary;
  backlinkTrend: Record<string, any>[];
  referringDomains: ReferringDomain[];
}
