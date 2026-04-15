export type BacklinkAuditToxicityLevel = 'clean' | 'suspicious' | 'toxic';
export type BacklinkAuditLinkStatus = 'pending' | 'keep' | 'flag' | 'disavow';
export type BacklinkAuditLinkType = 'follow' | 'nofollow';
export type BacklinkAuditInsightSeverity = 'low' | 'medium' | 'high';

export interface BacklinkAuditInsight {
  severity: BacklinkAuditInsightSeverity;
  title: string;
  description: string;
  action: string;
}

export interface BacklinkAuditDistributionBucket {
  label: string;
  count: number;
  percentage?: number;
}

export interface BacklinkAuditDistribution {
  toxicityBuckets: BacklinkAuditDistributionBucket[];
  authorityBuckets: BacklinkAuditDistributionBucket[];
  tld: BacklinkAuditDistributionBucket[];
  anchor: BacklinkAuditDistributionBucket[];
  category: BacklinkAuditDistributionBucket[];
}

export interface BacklinkAuditLink {
  id: string;
  jobId: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceDomain: string;
  targetUrl: string;
  anchor: string;
  linkType: BacklinkAuditLinkType;
  category: string | null;
  tld: string | null;
  firstSeen: string | null;
  sourceAuthority: number;
  toxicityScore: number;
  toxicityLevel: BacklinkAuditToxicityLevel;
  riskFactors: string[] | null;
  status: BacklinkAuditLinkStatus;
  userNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BacklinkAuditJob {
  id: string;
  userId: string;
  domain: string;
  country: string;
  toxicityScore: number;
  authorityScore: number;
  totalLinks: number;
  totalDomains: number;
  toxicCount: number;
  suspiciousCount: number;
  cleanCount: number;
  insights: BacklinkAuditInsight[] | null;
  distribution: BacklinkAuditDistribution | null;
  links: BacklinkAuditLink[];
  createdAt: string;
  updatedAt: string;
}

export interface BacklinkAuditListItem {
  id: string;
  domain: string;
  country: string;
  toxicityScore: number;
  totalLinks: number;
  toxicCount: number;
  suspiciousCount: number;
  cleanCount: number;
  createdAt: string;
  updatedAt: string;
}
