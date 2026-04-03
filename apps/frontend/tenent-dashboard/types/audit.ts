export type CrawlStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type IssueSeverity = 'ERROR' | 'WARNING' | 'NOTICE';

export type IssueType =
  // Errors
  | 'MISSING_TITLE'
  | 'MISSING_H1'
  | 'BROKEN_INTERNAL_LINK'
  | 'BROKEN_EXTERNAL_LINK'
  | 'PAGE_NOT_FOUND'
  | 'SERVER_ERROR'
  | 'HAS_NOINDEX'
  | 'REDIRECT_CHAIN'
  | 'MIXED_CONTENT'
  // Warnings
  | 'MISSING_META_DESCRIPTION'
  | 'DUPLICATE_TITLE'
  | 'DUPLICATE_META_DESCRIPTION'
  | 'IMAGE_MISSING_ALT'
  | 'SLOW_PAGE'
  | 'MULTIPLE_H1'
  | 'MISSING_CANONICAL'
  | 'MISSING_VIEWPORT'
  | 'MISSING_LANG'
  | 'MISSING_OG_TAGS'
  | 'MISSING_OG_IMAGE'
  | 'MISSING_TWITTER_CARD'
  | 'NON_DESCRIPTIVE_ANCHOR'
  | 'MISSING_STRUCTURED_DATA'
  | 'LARGE_PAGE_SIZE'
  | 'TOO_MANY_LINKS'
  | 'ORPHAN_PAGE'
  // SEO Notices
  | 'TITLE_TOO_LONG'
  | 'TITLE_TOO_SHORT'
  | 'META_DESCRIPTION_TOO_LONG'
  | 'META_DESCRIPTION_TOO_SHORT'
  | 'LOW_WORD_COUNT'
  | 'LOW_INTERNAL_LINKS'
  | 'LOW_EXTERNAL_LINKS'
  | 'UNCOMPRESSED_IMAGES'
  | 'URL_NOT_CLEAN'
  | 'NO_CONTENT_DATE'
  // GEO Issues
  | 'NO_AUTHOR_INFO'
  | 'NO_ABOUT_PAGE'
  | 'NO_CONTACT_INFO'
  | 'WEAK_EEAT_SIGNALS'
  | 'NO_TRUST_SIGNALS'
  | 'NO_ORGANIZATION_SCHEMA'
  | 'MISSING_SOCIAL_PROFILES'
  | 'LOW_FACTUAL_DENSITY'
  | 'NO_SOURCE_CITATIONS'
  | 'WEAK_ENTITY_CLARITY'
  | 'NO_AUTHOR_SCHEMA'
  | 'MISSING_SAMEAS_LINKS'
  | 'AI_CRAWL_BLOCKED'
  | 'NO_ORIGINAL_DATA'
  | 'THIN_CONTENT_FOR_AI'
  | 'UNCLEAR_VALUE_PROPOSITION'
  | 'NO_CREDENTIALS_VISIBLE'
  // AEO Issues
  | 'NO_FAQ_SCHEMA'
  | 'NO_DIRECT_ANSWERS'
  | 'NO_QUESTION_HEADINGS'
  | 'NO_HOWTO_SCHEMA'
  | 'NO_SPEAKABLE_SCHEMA'
  | 'NO_DEFINITION_PATTERN'
  | 'NO_LIST_CONTENT'
  | 'NO_TABLE_CONTENT'
  | 'MISSING_FAQ_PAGE'
  | 'LOW_QUESTION_COVERAGE'
  | 'NOT_CONVERSATIONAL'
  | 'NO_LOCAL_SIGNALS'
  | 'NO_LONG_TAIL_QUESTIONS';

export type IssueDimension = 'SEO' | 'GEO' | 'AEO';

export type CrawlSchedule = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface CrawlJob {
  id: string;
  projectId: string;
  status: CrawlStatus;
  pagesCrawled: number;
  pagesTotal: number;
  pagesLimit: number;
  errorCount: number;
  warningCount: number;
  noticeCount: number;
  score: number | null;
  seoScore: number | null;
  geoScore: number | null;
  aeoScore: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CrawlJobDetail extends CrawlJob {
  issuesByType: IssueBreakdown[];
}

export interface IssueBreakdown {
  type: IssueType;
  severity: IssueSeverity;
  count: number;
}

export interface CrawlPage {
  id: string;
  crawlJobId: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h1Count: number;
  wordCount: number;
  loadTimeMs: number | null;
  contentType: string | null;
  canonicalUrl: string | null;
  hasRobotsNoindex: boolean;
  hasRobotsNofollow: boolean;
  internalLinksCount: number;
  externalLinksCount: number;
  imagesCount: number;
  imagesWithoutAlt: number;
  crawledAt: string;
  _count?: {
    issues: number;
  };
}

export interface CrawlIssue {
  id: string;
  crawlPageId: string;
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  details: any;
  suggestion: string | null;
  crawlPage: {
    url: string;
    statusCode: number | null;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

// Phase A: Crawl Comparison
export interface ComparisonIssue {
  url: string;
  type: IssueType;
  severity: IssueSeverity;
  message: string;
}

export interface CrawlComparison {
  currentCrawlId: string;
  previousCrawlId: string;
  scoreDelta: number;
  currentScore: number | null;
  previousScore: number | null;
  summary: {
    newIssues: number;
    fixedIssues: number;
    persistentIssues: number;
    errorDelta: number;
    warningDelta: number;
    noticeDelta: number;
  };
  newIssues: ComparisonIssue[];
  fixedIssues: ComparisonIssue[];
  persistentIssues: ComparisonIssue[];
}

// Phase B: Thematic Reports
export interface ThemeReport {
  theme: string;
  dimension: IssueDimension;
  themeScore: number;
  errorCount: number;
  warningCount: number;
  noticeCount: number;
  totalIssues: number;
  topIssues: { type: IssueType; severity: IssueSeverity; count: number }[];
}

export interface ThematicReports {
  crawlJobId: string;
  overallScore: number | null;
  seoScore: number | null;
  geoScore: number | null;
  aeoScore: number | null;
  themes: ThemeReport[];
}

// Phase C: Score History & Issue Trends
export interface ScoreHistoryEntry {
  id: string;
  score: number | null;
  seoScore: number | null;
  geoScore: number | null;
  aeoScore: number | null;
  errorCount: number;
  warningCount: number;
  noticeCount: number;
  pagesCrawled: number;
  completedAt: string;
}

export interface IssueTrends {
  crawls: { id: string; date: string; score: number | null }[];
  trends: Record<string, number[]>;
}
