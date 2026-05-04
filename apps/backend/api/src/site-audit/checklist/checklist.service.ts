import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CHECKLIST_CATEGORIES, CHECKLIST_ITEMS } from './checklist-items';
import {
  ChecklistItemDefinition,
  ChecklistItemResult,
  ChecklistReport,
  ChecklistStatus,
} from './checklist.types';

/**
 * Aggregated information about all CrawlIssue records of a given IssueType
 * for a single crawl, indexed for fast lookup during checklist evaluation.
 */
interface IssueAggregate {
  count: number;
  urls: string[];
  message: string;
  suggestion?: string;
}

@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the full 128-item checklist report for a crawl job.
   * Each item is evaluated by checking whether any of its mapped IssueType
   * values appears in the crawl's CrawlIssue records.
   *
   * - If matchingIssueTypes is empty → item is reported as 'Skipped'
   *   (detection logic not yet implemented).
   * - If at least one matching IssueType is present → item is the failureStatus.
   * - If matchingIssueTypes are all absent (and the item IS implemented) →
   *   item is 'Pass'.
   */
  async getChecklistReport(crawlJobId: string): Promise<ChecklistReport> {
    const crawlJob = await this.prisma.crawlJob.findUnique({
      where: { id: crawlJobId },
      select: { id: true, status: true },
    });

    if (!crawlJob) {
      throw new NotFoundException(`Crawl job ${crawlJobId} not found`);
    }

    const issueAggregates = await this.aggregateIssuesByType(crawlJobId);
    const items = CHECKLIST_ITEMS.map((def) => this.evaluateItem(def, issueAggregates));

    return this.buildReport(crawlJobId, items);
  }

  /**
   * Pull every CrawlIssue for the crawl, grouped by IssueType.
   * For each type we record total count, sample URLs (max 5), and message/suggestion
   * from the first occurrence — sufficient context for the UI without sending raw data.
   */
  private async aggregateIssuesByType(
    crawlJobId: string,
  ): Promise<Map<string, IssueAggregate>> {
    const issues = await this.prisma.crawlIssue.findMany({
      where: { crawlPage: { crawlJobId } },
      select: {
        type: true,
        message: true,
        suggestion: true,
        crawlPage: { select: { url: true } },
      },
    });

    const aggregates = new Map<string, IssueAggregate>();

    for (const issue of issues) {
      const existing = aggregates.get(issue.type);
      if (existing) {
        existing.count += 1;
        if (existing.urls.length < 5) existing.urls.push(issue.crawlPage.url);
      } else {
        aggregates.set(issue.type, {
          count: 1,
          urls: [issue.crawlPage.url],
          message: issue.message,
          suggestion: issue.suggestion ?? undefined,
        });
      }
    }

    return aggregates;
  }

  private evaluateItem(
    def: ChecklistItemDefinition,
    aggregates: Map<string, IssueAggregate>,
  ): ChecklistItemResult {
    // No detection logic wired up yet for this item.
    if (def.matchingIssueTypes.length === 0) {
      return {
        id: def.id,
        category: def.category.name,
        title: def.title,
        status: 'Skipped',
        severity: def.severityWhenFailing,
        done: false,
        affectedCount: 0,
        affectedUrls: [],
        message: def.note,
      };
    }

    let totalCount = 0;
    const sampleUrls: string[] = [];
    let firstMatchMessage: string | undefined;
    let firstMatchSuggestion: string | undefined;

    for (const issueType of def.matchingIssueTypes) {
      const agg = aggregates.get(issueType);
      if (!agg) continue;

      totalCount += agg.count;
      for (const url of agg.urls) {
        if (sampleUrls.length >= 5) break;
        if (!sampleUrls.includes(url)) sampleUrls.push(url);
      }
      if (!firstMatchMessage) {
        firstMatchMessage = agg.message;
        firstMatchSuggestion = agg.suggestion;
      }
    }

    const failed = totalCount > 0;
    const status: ChecklistStatus = failed ? def.failureStatus : 'Pass';

    return {
      id: def.id,
      category: def.category.name,
      title: def.title,
      status,
      severity: def.severityWhenFailing,
      done: !failed,
      affectedCount: totalCount,
      affectedUrls: sampleUrls,
      message: failed ? firstMatchMessage : undefined,
      suggestion: failed ? firstMatchSuggestion : undefined,
    };
  }

  private buildReport(
    crawlJobId: string,
    items: ChecklistItemResult[],
  ): ChecklistReport {
    const totals = {
      items: items.length,
      passed: 0,
      errors: 0,
      warnings: 0,
      notices: 0,
      skipped: 0,
    };

    for (const item of items) {
      switch (item.status) {
        case 'Pass': totals.passed++; break;
        case 'Error': totals.errors++; break;
        case 'Warning': totals.warnings++; break;
        case 'Notice': totals.notices++; break;
        case 'Skipped': totals.skipped++; break;
      }
    }

    const categories = CHECKLIST_CATEGORIES.map((category) => {
      const categoryItems = items.filter((it) => it.category === category.name);
      const summary = {
        total: categoryItems.length,
        passed: 0,
        errors: 0,
        warnings: 0,
        notices: 0,
        skipped: 0,
      };
      for (const item of categoryItems) {
        switch (item.status) {
          case 'Pass': summary.passed++; break;
          case 'Error': summary.errors++; break;
          case 'Warning': summary.warnings++; break;
          case 'Notice': summary.notices++; break;
          case 'Skipped': summary.skipped++; break;
        }
      }
      return {
        id: category.id,
        name: category.name,
        items: categoryItems,
        summary,
      };
    });

    return {
      crawlJobId,
      generatedAt: new Date(),
      totals,
      categories,
    };
  }
}
