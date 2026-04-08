import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlerService } from './crawler.service';

@Injectable()
export class SiteAuditService {
  private readonly logger = new Logger(SiteAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawlerService: CrawlerService,
  ) {}

  async startCrawl(projectId: string, _userId: string, _plan: string) {
    // Check if there's already a running crawl for this project
    const runningCrawl = await this.prisma.crawlJob.findFirst({
      where: {
        projectId,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
    });

    if (runningCrawl) {
      throw new BadRequestException(
        'A crawl is already in progress for this project. Please wait for it to complete.',
      );
    }

    // Create crawl job
    const crawlJob = await this.prisma.crawlJob.create({
      data: {
        projectId,
        status: 'QUEUED',
        pagesLimit: 100_000,
      },
    });

    // Execute crawl in background (don't await)
    setTimeout(() => {
      this.crawlerService.executeCrawl(crawlJob.id).catch((err) => {
        this.logger.error(`Background crawl failed for ${crawlJob.id}: ${err}`);
      });
    }, 0);

    return {
      id: crawlJob.id,
      projectId: crawlJob.projectId,
      status: crawlJob.status,
      pagesLimit: crawlJob.pagesLimit,
      createdAt: crawlJob.createdAt,
    };
  }

  async getCrawlJobs(projectId: string, page: number = 1, perPage: number = 10) {
    const skip = (page - 1) * perPage;

    const [crawlJobs, total] = await Promise.all([
      this.prisma.crawlJob.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.crawlJob.count({ where: { projectId } }),
    ]);

    return {
      data: crawlJobs,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async getCrawlJob(crawlJobId: string) {
    const crawlJob = await this.prisma.crawlJob.findUnique({
      where: { id: crawlJobId },
    });

    if (!crawlJob) {
      throw new NotFoundException('Crawl job not found');
    }

    // Get issue breakdown by type
    const issueBreakdown = await this.prisma.crawlIssue.groupBy({
      by: ['type', 'severity'],
      where: {
        crawlPage: { crawlJobId },
      },
      _count: { id: true },
    });

    const issuesByType = issueBreakdown.map((group) => ({
      type: group.type,
      severity: group.severity,
      count: group._count.id,
    }));

    return {
      ...crawlJob,
      issuesByType,
    };
  }

  async getCrawlIssues(
    crawlJobId: string,
    severity?: string,
    type?: string,
    page: number = 1,
    perPage: number = 20,
  ) {
    const skip = (page - 1) * perPage;

    const where: any = {
      crawlPage: { crawlJobId },
    };

    if (severity) {
      where.severity = severity;
    }

    if (type) {
      where.type = type;
    }

    const [issues, total] = await Promise.all([
      this.prisma.crawlIssue.findMany({
        where,
        include: {
          crawlPage: {
            select: { url: true, statusCode: true },
          },
        },
        orderBy: [
          { severity: 'asc' }, // ERROR first
          { type: 'asc' },
        ],
        skip,
        take: perPage,
      }),
      this.prisma.crawlIssue.count({ where }),
    ]);

    return {
      data: issues,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async getCrawlPages(
    crawlJobId: string,
    statusCode?: number,
    page: number = 1,
    perPage: number = 20,
  ) {
    const skip = (page - 1) * perPage;

    const where: any = { crawlJobId };

    if (statusCode !== undefined && statusCode !== null) {
      where.statusCode = statusCode;
    }

    const [pages, total] = await Promise.all([
      this.prisma.crawlPage.findMany({
        where,
        orderBy: { crawledAt: 'desc' },
        skip,
        take: perPage,
        include: {
          _count: { select: { issues: true } },
        },
      }),
      this.prisma.crawlPage.count({ where }),
    ]);

    return {
      data: pages,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ============================================
  // PHASE A: Crawl Comparison
  // ============================================

  async getExportData(crawlJobId: string) {
    const crawlJob = await this.prisma.crawlJob.findUnique({
      where: { id: crawlJobId },
      include: { project: { select: { domain: true, name: true } } },
    });

    if (!crawlJob) throw new NotFoundException('Crawl job not found');

    const allIssues = await this.prisma.crawlIssue.findMany({
      where: { crawlPage: { crawlJobId } },
      include: {
        crawlPage: { select: { url: true, statusCode: true } },
      },
      orderBy: [{ severity: 'asc' }, { type: 'asc' }],
    });

    return {
      crawlJob: {
        id: crawlJob.id,
        status: crawlJob.status,
        score: crawlJob.score,
        seoScore: crawlJob.seoScore,
        geoScore: crawlJob.geoScore,
        aeoScore: crawlJob.aeoScore,
        pagesCrawled: crawlJob.pagesCrawled,
        errorCount: crawlJob.errorCount,
        warningCount: crawlJob.warningCount,
        noticeCount: crawlJob.noticeCount,
        completedAt: crawlJob.completedAt,
      },
      project: crawlJob.project,
      issues: allIssues.map((issue) => ({
        url: issue.crawlPage.url,
        type: issue.type,
        severity: issue.severity,
        dimension: issue.dimension,
        message: issue.message,
        suggestion: issue.suggestion,
      })),
    };
  }

  async compareCrawls(crawlJobId: string, previousCrawlId?: string) {
    // If no previous crawl specified, find the most recent completed one before this crawl
    const currentCrawl = await this.prisma.crawlJob.findUnique({
      where: { id: crawlJobId },
    });

    if (!currentCrawl) {
      throw new NotFoundException('Crawl job not found');
    }

    let prevId = previousCrawlId;
    if (!prevId) {
      const previousCrawl = await this.prisma.crawlJob.findFirst({
        where: {
          projectId: currentCrawl.projectId,
          status: 'COMPLETED',
          id: { not: crawlJobId },
          completedAt: { lt: currentCrawl.completedAt || currentCrawl.createdAt },
        },
        orderBy: { completedAt: 'desc' },
        select: { id: true },
      });

      if (!previousCrawl) {
        return {
          currentCrawlId: crawlJobId,
          previousCrawlId: null,
          scoreDelta: 0,
          currentScore: currentCrawl.score,
          previousScore: null,
          summary: { newIssues: 0, fixedIssues: 0, persistentIssues: 0, errorDelta: 0, warningDelta: 0, noticeDelta: 0 },
          newIssues: [],
          fixedIssues: [],
          persistentIssues: [],
          message: 'No previous completed crawl to compare against. Run another crawl to see changes.',
        };
      }
      prevId = previousCrawl.id;
    }

    // Get issues for both crawls, keyed by (url, issueType)
    const [currentIssues, previousIssues] = await Promise.all([
      this.prisma.crawlIssue.findMany({
        where: { crawlPage: { crawlJobId } },
        include: { crawlPage: { select: { url: true } } },
      }),
      this.prisma.crawlIssue.findMany({
        where: { crawlPage: { crawlJobId: prevId } },
        include: { crawlPage: { select: { url: true } } },
      }),
    ]);

    const makeKey = (url: string, type: string) => `${url}::${type}`;

    const currentKeys = new Map<string, typeof currentIssues[0]>();
    for (const issue of currentIssues) {
      currentKeys.set(makeKey(issue.crawlPage.url, issue.type), issue);
    }

    const previousKeys = new Map<string, typeof previousIssues[0]>();
    for (const issue of previousIssues) {
      previousKeys.set(makeKey(issue.crawlPage.url, issue.type), issue);
    }

    const newIssues: any[] = [];
    const fixedIssues: any[] = [];
    const persistentIssues: any[] = [];

    // Issues in current but not previous = NEW
    for (const [key, issue] of currentKeys) {
      if (!previousKeys.has(key)) {
        newIssues.push({
          url: issue.crawlPage.url,
          type: issue.type,
          severity: issue.severity,
          message: issue.message,
        });
      } else {
        persistentIssues.push({
          url: issue.crawlPage.url,
          type: issue.type,
          severity: issue.severity,
          message: issue.message,
        });
      }
    }

    // Issues in previous but not current = FIXED
    for (const [key, issue] of previousKeys) {
      if (!currentKeys.has(key)) {
        fixedIssues.push({
          url: issue.crawlPage.url,
          type: issue.type,
          severity: issue.severity,
          message: issue.message,
        });
      }
    }

    // Get both crawl scores
    const previousCrawlData = await this.prisma.crawlJob.findUnique({
      where: { id: prevId },
      select: { score: true, errorCount: true, warningCount: true, noticeCount: true, completedAt: true },
    });

    return {
      currentCrawlId: crawlJobId,
      previousCrawlId: prevId,
      scoreDelta: (currentCrawl.score || 0) - (previousCrawlData?.score || 0),
      currentScore: currentCrawl.score,
      previousScore: previousCrawlData?.score,
      summary: {
        newIssues: newIssues.length,
        fixedIssues: fixedIssues.length,
        persistentIssues: persistentIssues.length,
        errorDelta: currentCrawl.errorCount - (previousCrawlData?.errorCount || 0),
        warningDelta: currentCrawl.warningCount - (previousCrawlData?.warningCount || 0),
        noticeDelta: currentCrawl.noticeCount - (previousCrawlData?.noticeCount || 0),
      },
      newIssues,
      fixedIssues,
      persistentIssues,
    };
  }

  // ============================================
  // PHASE B: Thematic Reports
  // ============================================

  private static readonly THEME_MAP: Record<string, { dimension: string; issueTypes: string[] }> = {
    // SEO themes
    crawlability: { dimension: 'SEO', issueTypes: ['HAS_NOINDEX', 'PAGE_NOT_FOUND', 'SERVER_ERROR', 'REDIRECT_CHAIN'] },
    content: { dimension: 'SEO', issueTypes: [
      'MISSING_TITLE', 'MISSING_H1', 'MISSING_META_DESCRIPTION',
      'DUPLICATE_TITLE', 'DUPLICATE_META_DESCRIPTION',
      'TITLE_TOO_LONG', 'TITLE_TOO_SHORT',
      'META_DESCRIPTION_TOO_LONG', 'META_DESCRIPTION_TOO_SHORT',
      'LOW_WORD_COUNT', 'MULTIPLE_H1', 'MISSING_LANG', 'NO_CONTENT_DATE',
    ]},
    performance: { dimension: 'SEO', issueTypes: ['SLOW_PAGE', 'LARGE_PAGE_SIZE', 'UNCOMPRESSED_IMAGES'] },
    links: { dimension: 'SEO', issueTypes: ['BROKEN_INTERNAL_LINK', 'BROKEN_EXTERNAL_LINK', 'MISSING_CANONICAL', 'TOO_MANY_LINKS', 'LOW_INTERNAL_LINKS', 'LOW_EXTERNAL_LINKS', 'ORPHAN_PAGE', 'NON_DESCRIPTIVE_ANCHOR'] },
    technical_seo: { dimension: 'SEO', issueTypes: ['MISSING_VIEWPORT', 'MISSING_OG_TAGS', 'MISSING_OG_IMAGE', 'MISSING_TWITTER_CARD', 'MISSING_STRUCTURED_DATA', 'MIXED_CONTENT', 'URL_NOT_CLEAN'] },
    images: { dimension: 'SEO', issueTypes: ['IMAGE_MISSING_ALT', 'UNCOMPRESSED_IMAGES'] },
    // GEO themes
    eeat: { dimension: 'GEO', issueTypes: ['NO_AUTHOR_INFO', 'NO_ABOUT_PAGE', 'WEAK_EEAT_SIGNALS', 'NO_TRUST_SIGNALS', 'NO_CREDENTIALS_VISIBLE'] },
    entity_authority: { dimension: 'GEO', issueTypes: ['NO_ORGANIZATION_SCHEMA', 'MISSING_SOCIAL_PROFILES', 'MISSING_SAMEAS_LINKS', 'NO_AUTHOR_SCHEMA', 'WEAK_ENTITY_CLARITY'] },
    ai_content: { dimension: 'GEO', issueTypes: ['LOW_FACTUAL_DENSITY', 'NO_SOURCE_CITATIONS', 'NO_ORIGINAL_DATA', 'THIN_CONTENT_FOR_AI', 'UNCLEAR_VALUE_PROPOSITION', 'NO_CONTACT_INFO'] },
    // AEO themes
    featured_snippets: { dimension: 'AEO', issueTypes: ['NO_DIRECT_ANSWERS', 'NO_QUESTION_HEADINGS', 'NO_DEFINITION_PATTERN', 'NO_LIST_CONTENT', 'NO_TABLE_CONTENT', 'LOW_QUESTION_COVERAGE'] },
    structured_answers: { dimension: 'AEO', issueTypes: ['NO_FAQ_SCHEMA', 'NO_HOWTO_SCHEMA', 'NO_SPEAKABLE_SCHEMA', 'MISSING_FAQ_PAGE'] },
    voice_search: { dimension: 'AEO', issueTypes: ['NOT_CONVERSATIONAL', 'NO_LOCAL_SIGNALS', 'NO_LONG_TAIL_QUESTIONS'] },
  };

  async getThematicReports(crawlJobId: string) {
    const crawlJob = await this.prisma.crawlJob.findUnique({
      where: { id: crawlJobId },
    });

    if (!crawlJob) {
      throw new NotFoundException('Crawl job not found');
    }

    // Get all issues grouped by type and severity
    const issueBreakdown = await this.prisma.crawlIssue.groupBy({
      by: ['type', 'severity'],
      where: { crawlPage: { crawlJobId } },
      _count: { id: true },
    });

    // Build a lookup: type -> { severity, count }
    const issueLookup = new Map<string, { severity: string; count: number }>();
    for (const group of issueBreakdown) {
      issueLookup.set(group.type, { severity: group.severity, count: group._count.id });
    }

    const themes = Object.entries(SiteAuditService.THEME_MAP).map(([theme, config]) => {
      let errorCount = 0;
      let warningCount = 0;
      let noticeCount = 0;
      const topIssues: any[] = [];

      for (const type of config.issueTypes) {
        const data = issueLookup.get(type);
        if (!data) continue;

        if (data.severity === 'ERROR') errorCount += data.count;
        else if (data.severity === 'WARNING') warningCount += data.count;
        else noticeCount += data.count;

        topIssues.push({ type, severity: data.severity, count: data.count });
      }

      // Calculate theme score (same formula as overall but scoped to theme)
      const totalThemeIssues = errorCount + warningCount + noticeCount;
      const deductions = (errorCount * 10) + (warningCount * 5) + (noticeCount * 1);
      const checksInTheme = config.issueTypes.length * (crawlJob.pagesCrawled || 1);
      const maxPossible = checksInTheme > 0 ? checksInTheme * 5 : 1;
      const themeScore = totalThemeIssues === 0
        ? 100
        : Math.max(0, Math.round(100 - (deductions / maxPossible) * 100));

      // Sort top issues by count descending
      topIssues.sort((a: any, b: any) => b.count - a.count);

      return {
        theme,
        dimension: config.dimension,
        themeScore,
        errorCount,
        warningCount,
        noticeCount,
        totalIssues: totalThemeIssues,
        topIssues: topIssues.slice(0, 5),
      };
    });

    return {
      crawlJobId,
      overallScore: crawlJob.score,
      seoScore: crawlJob.seoScore,
      geoScore: crawlJob.geoScore,
      aeoScore: crawlJob.aeoScore,
      themes,
    };
  }

  // ============================================
  // PHASE C: Issue Trends & Score History
  // ============================================

  async getScoreHistory(projectId: string, limit: number = 10) {
    const crawls = await this.prisma.crawlJob.findMany({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        score: true,
        seoScore: true,
        geoScore: true,
        aeoScore: true,
        errorCount: true,
        warningCount: true,
        noticeCount: true,
        pagesCrawled: true,
        completedAt: true,
      },
    });

    // Return in chronological order (oldest first) for chart rendering
    return crawls.reverse();
  }

  async getIssueTrends(projectId: string, limit: number = 10) {
    // Get last N completed crawls
    const crawls = await this.prisma.crawlJob.findMany({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: limit,
      select: { id: true, completedAt: true, score: true },
    });

    if (crawls.length === 0) {
      return { crawls: [], trends: {} };
    }

    // Reverse to chronological order
    const orderedCrawls = crawls.reverse();
    const crawlIds = orderedCrawls.map((c) => c.id);

    // Get issue counts per type per crawl
    const issueCounts = await this.prisma.crawlIssue.groupBy({
      by: ['type'],
      where: {
        crawlPage: { crawlJobId: { in: crawlIds } },
      },
      _count: { id: true },
    });

    // Get unique issue types that appeared
    const issueTypes = issueCounts.map((ic) => ic.type);

    // For each crawl, get per-type counts
    const trends: Record<string, number[]> = {};
    for (const type of issueTypes) {
      trends[type] = [];
    }

    for (const crawl of orderedCrawls) {
      const crawlIssueCounts = await this.prisma.crawlIssue.groupBy({
        by: ['type'],
        where: { crawlPage: { crawlJobId: crawl.id } },
        _count: { id: true },
      });

      const countMap = new Map(crawlIssueCounts.map((c) => [c.type, c._count.id]));

      for (const type of issueTypes) {
        trends[type].push(countMap.get(type) || 0);
      }
    }

    return {
      crawls: orderedCrawls.map((c) => ({
        id: c.id,
        date: c.completedAt,
        score: c.score,
      })),
      trends,
    };
  }

  async cancelCrawl(crawlJobId: string) {
    const crawlJob = await this.prisma.crawlJob.findUnique({
      where: { id: crawlJobId },
    });

    if (!crawlJob) {
      throw new NotFoundException('Crawl job not found');
    }

    if (crawlJob.status !== 'QUEUED' && crawlJob.status !== 'RUNNING') {
      throw new BadRequestException('Only queued or running crawls can be cancelled');
    }

    await this.prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

    return { message: 'Crawl cancelled successfully' };
  }
}
