export type GapType = 'shared' | 'missing' | 'weak' | 'strong' | 'untapped' | 'unique';
export type SearchIntent = 'informational' | 'navigational' | 'commercial' | 'transactional';

export interface GapKeyword {
  keyword: string;
  volume: number;
  kd: number;
  cpc: number;
  intent: SearchIntent;
  positions: Record<string, number | null>;
  gapType: GapType;
}

export interface GapSummary {
  totalKeywords: number;
  shared: number;
  missing: number;
  weak: number;
  strong: number;
  untapped: number;
  unique: number;
}

export interface KeywordGapData {
  domains: string[];
  country: string;
  summary: GapSummary;
  keywords: GapKeyword[];
}
