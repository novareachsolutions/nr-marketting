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
  /** Distinct sourceSnippet values pulled from CrawlIssue.details (max 5). */
  sourceSnippets: string[];
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

    // Topologically sort items so each item is evaluated only AFTER all of its
    // declared dependencies have been resolved. Some dependencies point to
    // higher-numbered items (e.g. #36 depends on #38), so a plain ID sort
    // would evaluate the dependent before its dependency.
    const ordered = this.topoSort(CHECKLIST_ITEMS);
    const resolved = new Map<number, ChecklistItemResult>();
    for (const def of ordered) {
      resolved.set(def.id, this.evaluateItem(def, issueAggregates, resolved));
    }

    // Restore the original definition order in the output.
    const items = CHECKLIST_ITEMS.map((def) => resolved.get(def.id)!);

    return this.buildReport(crawlJobId, items);
  }

  /**
   * Depth-first topological sort over the dependency graph defined by
   * `dependsOnItems`. Falls back gracefully on cycles by returning items
   * encountered first; we don't expect cycles in the checklist definition.
   */
  private topoSort(items: ChecklistItemDefinition[]): ChecklistItemDefinition[] {
    const byId = new Map<number, ChecklistItemDefinition>();
    for (const item of items) byId.set(item.id, item);

    const sorted: ChecklistItemDefinition[] = [];
    const visited = new Set<number>();
    const visiting = new Set<number>();

    const visit = (def: ChecklistItemDefinition): void => {
      if (visited.has(def.id) || visiting.has(def.id)) return;
      visiting.add(def.id);
      if (def.dependsOnItems) {
        for (const depId of def.dependsOnItems) {
          const dep = byId.get(depId);
          if (dep) visit(dep);
        }
      }
      visiting.delete(def.id);
      visited.add(def.id);
      sorted.push(def);
    };

    for (const item of items) visit(item);
    return sorted;
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
        details: true,
        crawlPage: { select: { url: true } },
      },
    });

    const aggregates = new Map<string, IssueAggregate>();

    for (const issue of issues) {
      const snippet = this.extractSnippet(issue.details);
      const existing = aggregates.get(issue.type);
      if (existing) {
        existing.count += 1;
        if (existing.urls.length < 5) existing.urls.push(issue.crawlPage.url);
        if (snippet && existing.sourceSnippets.length < 5 && !existing.sourceSnippets.includes(snippet)) {
          existing.sourceSnippets.push(snippet);
        }
      } else {
        aggregates.set(issue.type, {
          count: 1,
          urls: [issue.crawlPage.url],
          message: issue.message,
          suggestion: issue.suggestion ?? undefined,
          sourceSnippets: snippet ? [snippet] : [],
        });
      }
    }

    return aggregates;
  }

  /** Pull a `sourceSnippet` (or fall back to a stringified slice of details). */
  private extractSnippet(details: unknown): string | null {
    if (!details || typeof details !== 'object') return null;
    const d = details as Record<string, unknown>;
    if (typeof d.sourceSnippet === 'string' && d.sourceSnippet.trim()) {
      return d.sourceSnippet.trim().slice(0, 400);
    }
    return null;
  }

  private evaluateItem(
    def: ChecklistItemDefinition,
    aggregates: Map<string, IssueAggregate>,
    resolved: Map<number, ChecklistItemResult>,
  ): ChecklistItemResult {
    // First, honour logical dependencies: if a parent check has not passed,
    // this item cannot meaningfully be evaluated. Example: items #2/#3
    // ("robots.txt syntax / blocking") cannot be Pass when item #1
    // ("robots.txt is present") has failed — there is no file to inspect.
    if (def.dependsOnItems && def.dependsOnItems.length > 0) {
      for (const depId of def.dependsOnItems) {
        const dep = resolved.get(depId);
        if (!dep) continue; // dep wasn't resolved yet — defensive, shouldn't happen
        if (dep.status !== 'Pass') {
          return {
            id: def.id,
            category: def.category.name,
            title: def.title,
            status: 'Skipped',
            severity: def.severityWhenFailing,
            done: false,
            affectedCount: 0,
            affectedUrls: [],
            message: `Cannot check — depends on item #${depId} (${dep.title}) which is ${dep.status.toLowerCase()}.`,
          };
        }
      }
    }

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
    const sampleSnippets: string[] = [];
    let firstMatchMessage: string | undefined;
    let firstMatchSuggestion: string | undefined;

    for (const issueType of def.matchingIssueTypes) {
      const agg = aggregates.get(issueType);
      if (!agg) continue;

      totalCount += agg.count;
      for (const url of agg.urls) {
        if (sampleUrls.length >= 5) break;
        const cleaned = this.formatAffectedUrl(url);
        if (!sampleUrls.includes(cleaned)) sampleUrls.push(cleaned);
      }
      for (const snip of agg.sourceSnippets) {
        if (sampleSnippets.length >= 5) break;
        if (!sampleSnippets.includes(snip)) sampleSnippets.push(snip);
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
      sourceSnippets: failed && sampleSnippets.length > 0 ? sampleSnippets : undefined,
    };
  }

  /**
   * The site-wide audit anchors its findings against a synthetic CrawlPage
   * with the URL ".../__site-wide__". That string is meaningless to end users,
   * so we replace it with a friendly label.
   */
  private formatAffectedUrl(url: string): string {
    if (url.includes('/__site-wide__')) return 'Site-wide check (one-time)';
    return url;
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
