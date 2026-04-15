export type BacklinkLinkType = 'follow' | 'nofollow';

export interface BacklinksOverview {
  totalBacklinks: number;
  referringDomains: number;
  referringIps: number;
  authorityScore: number;
  followBacklinks: number;
  nofollowBacklinks: number;
  dofollowPercent: number;
  textBacklinks: number;
  imageBacklinks: number;
  newBacklinks30d: number;
  lostBacklinks30d: number;
}

export interface BacklinksTrendPoint {
  month: string;
  backlinks: number;
  referringDomains: number;
  authorityScore: number;
}

export interface BacklinksReferringDomainRow {
  domain: string;
  authorityScore: number;
  backlinks: number;
  firstSeen: string;
  countryCode: string;
  followRatio: number;
  category: string;
}

export interface BacklinksAnchorRow {
  anchor: string;
  count: number;
  percentage: number;
}

export interface BacklinkRow {
  sourceUrl: string;
  sourceTitle: string;
  sourceAuthority: number;
  targetUrl: string;
  anchor: string;
  type: BacklinkLinkType;
  firstSeen: string;
}

export interface BacklinksDistributionRow {
  label: string;
  count: number;
  percentage: number;
}

export interface BacklinksData {
  domain: string;
  country: string;
  overview: BacklinksOverview;
  trend: BacklinksTrendPoint[];
  topReferringDomains: BacklinksReferringDomainRow[];
  anchorDistribution: BacklinksAnchorRow[];
  topBacklinks: BacklinkRow[];
  newBacklinks: BacklinkRow[];
  lostBacklinks: BacklinkRow[];
  tldDistribution: BacklinksDistributionRow[];
  categoryDistribution: BacklinksDistributionRow[];
}
