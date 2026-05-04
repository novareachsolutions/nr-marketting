/**
 * Types for the Technical SEO Audit Checklist (128 items across 10 categories).
 * Projects existing CrawlIssue records into a structured checklist format.
 */

export type ChecklistSeverity = 'High' | 'Medium' | 'Low';

export type ChecklistStatus = 'Error' | 'Warning' | 'Notice' | 'Pass' | 'Skipped';

export interface ChecklistItemDefinition {
  id: number;                       // 1-128
  category: ChecklistCategory;
  title: string;
  /** Severity if this check fails. Pass items always have severity = severity but status = Pass. */
  severityWhenFailing: ChecklistSeverity;
  /** When failing, what status to assign — Error vs Warning vs Notice. */
  failureStatus: 'Error' | 'Warning' | 'Notice';
  /**
   * IssueType values from the existing CrawlIssue enum that, when present in the crawl,
   * indicate this checklist item has FAILED. Empty array = item not yet implemented in crawler.
   */
  matchingIssueTypes: string[];
  /** Free-form notes shown in the UI (e.g., "Needs PageSpeed Insights API"). */
  note?: string;
}

export interface ChecklistCategory {
  id: number;                       // 1-10
  name: string;                     // e.g. "Crawlability & Indexability"
}

export interface ChecklistItemResult {
  id: number;
  category: string;
  title: string;
  status: ChecklistStatus;
  severity: ChecklistSeverity;
  done: boolean;                    // true when status === 'Pass'
  /** Number of pages where this issue was detected. 0 if check is passing. */
  affectedCount: number;
  /** Up to 5 example URLs where the issue was found. */
  affectedUrls: string[];
  /** Aggregated message from underlying issues. */
  message?: string;
  /** Suggestion text from the matching CrawlIssue. */
  suggestion?: string;
}

export interface ChecklistReport {
  crawlJobId: string;
  generatedAt: Date;
  totals: {
    items: number;
    passed: number;
    errors: number;
    warnings: number;
    notices: number;
    skipped: number;
  };
  categories: Array<{
    id: number;
    name: string;
    items: ChecklistItemResult[];
    summary: {
      total: number;
      passed: number;
      errors: number;
      warnings: number;
      notices: number;
      skipped: number;
    };
  }>;
}
