import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DomainOverviewService } from '../domain-overview/domain-overview.service';
import { OrganicRankingsService } from '../organic-rankings/organic-rankings.service';
import { TopPagesService } from '../top-pages/top-pages.service';
import { PositionTrackingService } from '../position-tracking/position-tracking.service';
import { normalizeDomain } from '../common/utils/domain';
import { callOpenAIJson } from '../common/utils/openai';

const ALL_MODULES = [
  'siteAudit',
  'domainOverview',
  'organicRankings',
  'positionTracking',
  'topPages',
  'keywords',
] as const;

type ModuleKey = (typeof ALL_MODULES)[number];

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly openaiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly domainOverviewService: DomainOverviewService,
    private readonly organicRankingsService: OrganicRankingsService,
    private readonly topPagesService: TopPagesService,
    private readonly positionTrackingService: PositionTrackingService,
  ) {
    this.openaiKey = this.config.get<string>('OPENAI_API_KEY') || '';
  }

  // ─── REPORT SETTINGS ─────────────────────────────────

  async getReportSettings(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        domain: true,
        reportSchedule: true,
        reportDay: true,
        reportHour: true,
        reportModules: true,
        lastWeeklyReportAt: true,
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const availableModules = await this.detectAvailableModules(
      projectId,
      project.domain,
    );

    return {
      reportSchedule: project.reportSchedule,
      reportDay: project.reportDay,
      reportHour: project.reportHour,
      reportModules: project.reportModules ?? [],
      lastWeeklyReportAt: project.lastWeeklyReportAt,
      nextReportAt: this.calculateNextReportAt(project),
      availableModules,
    };
  }

  async updateReportSettings(
    projectId: string,
    data: {
      reportSchedule: string;
      reportDay?: number | null;
      reportHour?: number;
      reportModules?: string[];
    },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        reportSchedule: data.reportSchedule as any,
        reportDay: data.reportDay ?? project.reportDay,
        reportHour: data.reportHour ?? project.reportHour,
        reportModules: data.reportModules ?? (project.reportModules as any),
      },
      select: {
        reportSchedule: true,
        reportDay: true,
        reportHour: true,
        reportModules: true,
        lastWeeklyReportAt: true,
      },
    });

    return {
      ...updated,
      nextReportAt: this.calculateNextReportAt(updated),
    };
  }

  // ─── LIST / GET / DELETE REPORTS ──────────────────────

  async listReports(projectId: string) {
    const reports = await this.prisma.report.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        dateFrom: true,
        dateTo: true,
        status: true,
        data: true,
        createdAt: true,
      },
    });

    return reports.map((r) => ({
      ...r,
      modulesAnalyzed: (r.data as any)?.modulesAnalyzed ?? [],
      data: undefined, // Don't send full data in list view
    }));
  }

  async getReport(projectId: string, reportId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, projectId },
    });

    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async deleteReport(projectId: string, reportId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, projectId },
    });
    if (!report) throw new NotFoundException('Report not found');

    await this.prisma.report.delete({ where: { id: reportId } });
    return { message: 'Report deleted' };
  }

  // ─── GENERATE REPORT ─────────────────────────────────

  async generateReport(projectId: string, modules?: string[]) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { user: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const now = new Date();
    const dateFrom = new Date(now);
    dateFrom.setDate(dateFrom.getDate() - 7);

    // Create pending report
    const report = await this.prisma.report.create({
      data: {
        projectId,
        title: `Weekly SEO Report - ${this.formatDateRange(dateFrom, now)}`,
        type: 'WEEKLY',
        dateFrom,
        dateTo: now,
        status: 'PENDING',
      },
    });

    // Run generation in background
    setTimeout(() => {
      this.executeReportGeneration(
        report.id,
        project,
        modules,
      ).catch((err) => {
        this.logger.error(
          `Report generation failed for ${report.id}: ${err}`,
        );
      });
    }, 0);

    return {
      reportId: report.id,
      status: 'PENDING',
      message: 'Report generation started. Check back shortly.',
    };
  }

  async executeReportGeneration(
    reportId: string,
    project: any,
    requestedModules?: string[],
  ) {
    try {
      // Set status to GENERATING
      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: 'GENERATING' },
      });

      const domain = normalizeDomain(project.domain);
      const userId = project.userId;

      // 1. Detect which modules have data AND user selected
      const available = await this.detectAvailableModules(project.id, domain);
      const userSelected: string[] =
        requestedModules ??
        (project.reportModules as string[]) ??
        Object.keys(available).filter(
          (k) => available[k as ModuleKey],
        );
      const modulesToRun = userSelected.filter(
        (m) => available[m as ModuleKey],
      );

      if (modulesToRun.length === 0) {
        await this.prisma.report.update({
          where: { id: reportId },
          data: { status: 'FAILED', data: { error: 'No modules with data available to analyze' } },
        });
        return;
      }

      // 2. Snapshot current data
      const previousSnapshot = await this.snapshotData(
        project.id,
        domain,
        modulesToRun,
      );

      // 3. Refresh modules (fetch fresh data)
      await this.refreshModules(domain, userId, modulesToRun);

      // 4. Read new data
      const currentSnapshot = await this.snapshotData(
        project.id,
        domain,
        modulesToRun,
      );

      // 5. Compare
      const comparison = this.compareSnapshots(
        previousSnapshot,
        currentSnapshot,
        modulesToRun,
      );

      // 6. AI Summary
      let aiSummary = '';
      if (this.openaiKey) {
        try {
          aiSummary = await this.generateAiSummary(domain, comparison);
        } catch (err) {
          this.logger.warn(`AI summary generation failed: ${err}`);
          aiSummary = 'AI summary could not be generated.';
        }
      }

      // 7. Save report
      const reportData = {
        generatedAt: new Date().toISOString(),
        projectId: project.id,
        domain,
        modulesAnalyzed: modulesToRun,
        ...comparison,
        aiSummary,
      };

      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: 'COMPLETED', data: reportData },
      });

      // 8. Update project timestamp
      await this.prisma.project.update({
        where: { id: project.id },
        data: { lastWeeklyReportAt: new Date() },
      });

      this.logger.log(
        `Report ${reportId} completed for ${domain} — modules: ${modulesToRun.join(', ')}`,
      );
    } catch (err) {
      this.logger.error(`Report generation failed for ${reportId}: ${err}`);
      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: 'FAILED', data: { error: String(err) } },
      });
    }
  }

  // ─── DETECT AVAILABLE MODULES ─────────────────────────

  async detectAvailableModules(
    projectId: string,
    domain: string,
  ): Promise<Record<ModuleKey, boolean>> {
    const normalized = normalizeDomain(domain);

    const [crawlJob, domainCache, organicCache, trackedKw, topPagesCache, projectKw] =
      await Promise.all([
        this.prisma.crawlJob.findFirst({
          where: { projectId, status: 'COMPLETED' },
        }),
        this.prisma.domainOverviewCache.findUnique({
          where: { domain_country: { domain: normalized, country: 'US' } },
        }),
        this.prisma.organicRankingsCache.findUnique({
          where: { domain_country: { domain: normalized, country: 'US' } },
        }),
        this.prisma.trackedKeyword.findFirst({
          where: { projectId, isActive: true },
        }),
        this.prisma.topPagesCache.findUnique({
          where: { domain_country: { domain: normalized, country: 'US' } },
        }),
        this.prisma.projectKeyword.findFirst({
          where: { projectId },
        }),
      ]);

    return {
      siteAudit: !!crawlJob,
      domainOverview: !!domainCache,
      organicRankings: !!organicCache,
      positionTracking: !!trackedKw,
      topPages: !!topPagesCache,
      keywords: !!projectKw,
    };
  }

  // ─── SNAPSHOT DATA ────────────────────────────────────

  private async snapshotData(
    projectId: string,
    domain: string,
    modules: string[],
  ) {
    const snapshot: any = {};

    if (modules.includes('domainOverview')) {
      const cache = await this.prisma.domainOverviewCache.findUnique({
        where: { domain_country: { domain, country: 'US' } },
      });
      if (cache) {
        snapshot.domainOverview = {
          authorityScore: cache.authorityScore,
          organicTraffic: cache.organicTraffic,
          organicKeywords: cache.organicKeywords,
          totalBacklinks: cache.totalBacklinks,
          referringDomains: cache.referringDomains,
          organicTrafficCost: cache.organicTrafficCost,
          paidKeywords: cache.paidKeywords,
          paidTraffic: cache.paidTraffic,
        };
      }
    }

    if (modules.includes('organicRankings')) {
      const cache = await this.prisma.organicRankingsCache.findUnique({
        where: { domain_country: { domain, country: 'US' } },
      });
      if (cache) {
        const data = cache.data as any;
        snapshot.organicRankings = {
          totalKeywords: data?.summary?.totalOrganicKeywords ?? 0,
          monthlyTraffic: data?.summary?.organicMonthlyTraffic ?? 0,
          topPositions: (data?.positions ?? []).slice(0, 20).map((p: any) => ({
            keyword: p.keyword,
            position: p.position,
          })),
        };
      }
    }

    if (modules.includes('siteAudit')) {
      const latestCrawl = await this.prisma.crawlJob.findFirst({
        where: { projectId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
      });
      if (latestCrawl) {
        snapshot.siteAudit = {
          healthScore: latestCrawl.score,
          errors: latestCrawl.errorCount,
          warnings: latestCrawl.warningCount,
          notices: latestCrawl.noticeCount,
          crawlJobId: latestCrawl.id,
        };
      }
    }

    if (modules.includes('positionTracking')) {
      const overview = await this.positionTrackingService.getOverview(projectId);
      snapshot.positionTracking = {
        avgPosition: overview.averagePosition,
        keywordsInTop10:
          (overview.distribution.top3 ?? 0) + (overview.distribution.top10 ?? 0),
        keywordsInTop20:
          (overview.distribution.top3 ?? 0) +
          (overview.distribution.top10 ?? 0) +
          (overview.distribution.top20 ?? 0),
        totalKeywords: overview.totalKeywords,
        visibilityScore: overview.visibilityScore,
        estimatedTraffic: overview.estimatedTraffic,
      };
    }

    if (modules.includes('topPages')) {
      const cache = await this.prisma.topPagesCache.findUnique({
        where: { domain_country: { domain, country: 'US' } },
      });
      if (cache) {
        const data = cache.data as any;
        snapshot.topPages = {
          pages: (data?.pages ?? []).slice(0, 20).map((p: any) => ({
            url: p.url,
            traffic: p.traffic,
            keywords: p.keywords,
          })),
        };
      }
    }

    if (modules.includes('keywords')) {
      const count = await this.prisma.projectKeyword.count({
        where: { projectId },
      });
      snapshot.keywords = { totalTracked: count };
    }

    return snapshot;
  }

  // ─── REFRESH MODULES ──────────────────────────────────

  private async refreshModules(
    domain: string,
    userId: string,
    modules: string[],
  ) {
    // Refresh domain overview, organic rankings, top pages (these update caches)
    // Site audit and position tracking are handled by their own schedulers,
    // so for the report we just compare existing data.

    const refreshPromises: Promise<any>[] = [];

    if (modules.includes('domainOverview')) {
      refreshPromises.push(
        this.domainOverviewService
          .getDomainOverview(domain, 'US', userId)
          .catch((err) =>
            this.logger.warn(`Domain overview refresh failed: ${err}`),
          ),
      );
    }

    if (modules.includes('organicRankings')) {
      refreshPromises.push(
        this.organicRankingsService
          .getOrganicRankings(domain, 'US', userId)
          .catch((err) =>
            this.logger.warn(`Organic rankings refresh failed: ${err}`),
          ),
      );
    }

    if (modules.includes('topPages')) {
      refreshPromises.push(
        this.topPagesService
          .getTopPages(domain, 'US', userId)
          .catch((err) =>
            this.logger.warn(`Top pages refresh failed: ${err}`),
          ),
      );
    }

    await Promise.all(refreshPromises);
  }

  // ─── COMPARE SNAPSHOTS ────────────────────────────────

  private compareSnapshots(
    previous: any,
    current: any,
    modules: string[],
  ) {
    const result: any = {};

    if (modules.includes('domainOverview') && previous.domainOverview && current.domainOverview) {
      const prev = previous.domainOverview;
      const curr = current.domainOverview;
      result.domainOverview = {
        previous: prev,
        current: curr,
        changes: {
          authorityScore: (curr.authorityScore ?? 0) - (prev.authorityScore ?? 0),
          organicTraffic: (curr.organicTraffic ?? 0) - (prev.organicTraffic ?? 0),
          organicKeywords: (curr.organicKeywords ?? 0) - (prev.organicKeywords ?? 0),
          totalBacklinks: (curr.totalBacklinks ?? 0) - (prev.totalBacklinks ?? 0),
          referringDomains: (curr.referringDomains ?? 0) - (prev.referringDomains ?? 0),
          organicTrafficCost: Number(((curr.organicTrafficCost ?? 0) - (prev.organicTrafficCost ?? 0)).toFixed(2)),
        },
      };
    }

    if (modules.includes('organicRankings') && previous.organicRankings && current.organicRankings) {
      const prev = previous.organicRankings;
      const curr = current.organicRankings;

      // Build keyword maps for comparison
      const prevMap = new Map(prev.topPositions.map((p: any) => [p.keyword, p.position]));
      const currMap = new Map(curr.topPositions.map((p: any) => [p.keyword, p.position]));

      const newKeywords: any[] = [];
      const lostKeywords: any[] = [];
      const improved: any[] = [];
      const declined: any[] = [];

      for (const [kw, pos] of currMap) {
        if (!prevMap.has(kw)) {
          newKeywords.push({ keyword: kw, position: pos });
        } else {
          const prevPos = prevMap.get(kw)!;
          if ((pos as number) < (prevPos as number)) {
            improved.push({ keyword: kw, from: prevPos, to: pos });
          } else if ((pos as number) > (prevPos as number)) {
            declined.push({ keyword: kw, from: prevPos, to: pos });
          }
        }
      }

      for (const [kw, pos] of prevMap) {
        if (!currMap.has(kw)) {
          lostKeywords.push({ keyword: kw, previousPosition: pos });
        }
      }

      result.organicRankings = {
        previous: prev,
        current: curr,
        changes: {
          totalKeywordsChange: curr.totalKeywords - prev.totalKeywords,
          monthlyTrafficChange: curr.monthlyTraffic - prev.monthlyTraffic,
          newKeywords: newKeywords.slice(0, 10),
          lostKeywords: lostKeywords.slice(0, 10),
          improved: improved.sort((a, b) => (a.from - a.to) - (b.from - b.to)).slice(0, 10),
          declined: declined.sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 10),
        },
      };
    }

    if (modules.includes('siteAudit') && previous.siteAudit && current.siteAudit) {
      const prev = previous.siteAudit;
      const curr = current.siteAudit;
      result.siteAudit = {
        previous: { healthScore: prev.healthScore, errors: prev.errors, warnings: prev.warnings, notices: prev.notices },
        current: { healthScore: curr.healthScore, errors: curr.errors, warnings: curr.warnings, notices: curr.notices },
        changes: {
          healthScoreChange: (curr.healthScore ?? 0) - (prev.healthScore ?? 0),
          errorsDelta: curr.errors - prev.errors,
          warningsDelta: curr.warnings - prev.warnings,
          noticesDelta: curr.notices - prev.notices,
        },
      };
    }

    if (modules.includes('positionTracking') && previous.positionTracking && current.positionTracking) {
      const prev = previous.positionTracking;
      const curr = current.positionTracking;
      result.positionTracking = {
        previous: prev,
        current: curr,
        changes: {
          avgPositionChange: prev.avgPosition && curr.avgPosition
            ? Number((curr.avgPosition - prev.avgPosition).toFixed(1))
            : null,
          keywordsInTop10Change: curr.keywordsInTop10 - prev.keywordsInTop10,
          keywordsInTop20Change: curr.keywordsInTop20 - prev.keywordsInTop20,
          visibilityChange: Number((curr.visibilityScore - prev.visibilityScore).toFixed(2)),
          trafficChange: curr.estimatedTraffic - prev.estimatedTraffic,
        },
      };
    }

    if (modules.includes('topPages') && previous.topPages && current.topPages) {
      const prev = previous.topPages;
      const curr = current.topPages;

      const prevUrls = new Set(prev.pages.slice(0, 10).map((p: any) => p.url));
      const currUrls = new Set(curr.pages.slice(0, 10).map((p: any) => p.url));

      const newInTop10 = curr.pages
        .slice(0, 10)
        .filter((p: any) => !prevUrls.has(p.url))
        .map((p: any) => ({ url: p.url, traffic: p.traffic }));

      const droppedFromTop10 = prev.pages
        .slice(0, 10)
        .filter((p: any) => !currUrls.has(p.url))
        .map((p: any) => ({ url: p.url, previousTraffic: p.traffic }));

      result.topPages = {
        previous: prev,
        current: curr,
        changes: { newInTop10, droppedFromTop10 },
      };
    }

    if (modules.includes('keywords') && previous.keywords && current.keywords) {
      result.keywords = {
        totalTracked: current.keywords.totalTracked,
        newKeywordsAdded: current.keywords.totalTracked - previous.keywords.totalTracked,
      };
    }

    return result;
  }

  // ─── AI SUMMARY ───────────────────────────────────────

  private async generateAiSummary(domain: string, comparison: any): Promise<string> {
    const result = await callOpenAIJson<{ summary: string }>({
      apiKey: this.openaiKey,
      systemPrompt:
        'You are an SEO analyst. Generate a concise executive summary (3-5 sentences) of the week-over-week SEO changes for a website. Focus on the most impactful changes. Be specific with numbers. Return JSON with a "summary" field.',
      userPrompt: `Domain: ${domain}\n\nWeek-over-week comparison data:\n${JSON.stringify(comparison, null, 2)}`,
      maxTokens: 500,
      temperature: 0.4,
    });

    return result.summary;
  }

  // ─── HELPERS ──────────────────────────────────────────

  private formatDateRange(from: Date, to: Date): string {
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${from.toLocaleDateString('en-US', opts)} - ${to.toLocaleDateString('en-US', opts)}`;
  }

  private calculateNextReportAt(project: any): string | null {
    if (project.reportSchedule === 'NONE') return null;

    const now = new Date();
    const hour = project.reportHour ?? 2;
    const day = project.reportDay; // 0-6 or null

    // Find the next occurrence
    const next = new Date(now);
    next.setUTCHours(hour, 0, 0, 0);

    if (project.reportSchedule === 'DAILY') {
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    } else if (project.reportSchedule === 'WEEKLY' && day !== null && day !== undefined) {
      const currentDay = next.getUTCDay();
      let daysUntil = day - currentDay;
      if (daysUntil < 0) daysUntil += 7;
      if (daysUntil === 0 && next <= now) daysUntil = 7;
      next.setUTCDate(next.getUTCDate() + daysUntil);
    } else if (project.reportSchedule === 'MONTHLY') {
      if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1);
    }

    return next.toISOString();
  }
}
