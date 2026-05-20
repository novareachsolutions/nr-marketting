import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { SiteWideAuditService } from './site-wide-audit.service';

interface RobotsRules {
  disallowedPaths: string[];
  allowedPaths: string[];
}

interface PageData {
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
  internalLinks: string[];
  htmlSize: number;
  hasViewport: boolean;
  hasLangAttr: boolean;
  hasOgTags: boolean;
  hasOgImage: boolean;
  hasTwitterCard: boolean;
  hasStructuredData: boolean;
  redirectCount: number;
  hasMixedContent: boolean;
  externalLinks: string[];
  // SEO extras
  urlClean: boolean;
  hasContentDate: boolean;
  anchorTexts: string[];
  // GEO signals
  hasAuthorInfo: boolean;
  hasContactInfo: boolean;
  hasTrustSignals: boolean;
  hasOrgSchema: boolean;
  hasAuthorSchema: boolean;
  hasSameAsLinks: boolean;
  hasCitations: boolean;
  hasOriginalData: boolean;
  socialProfileCount: number;
  schemaTypes: string[];
  bodyText: string;
  // AEO signals
  hasFaqSchema: boolean;
  hasHowToSchema: boolean;
  hasSpeakableSchema: boolean;
  questionHeadingsCount: number;
  hasDefinitionPattern: boolean;
  hasListContent: boolean;
  hasTableContent: boolean;
  directAnswerCount: number;
  // Checklist signals (response headers + DOM details)
  responseHeaders: Record<string, string>;
  domNodeCount: number;
  imagesLazyLoaded: number;
  imagesWithoutDimensions: number;
  imagesNonNextGen: number;
  imagesPoorFilenames: number;
  hasPreconnectHints: boolean;
  hasFontDisplaySwap: boolean;
  hreflangTags: { hreflang: string; href: string }[];
  isAmpPage: boolean;
  ampHtml: string | null;
  hasGoogleAnalytics: boolean;
  hasGoogleTagManager: boolean;
  hasProductSchema: boolean;
  hasArticleSchema: boolean;
  underscoresInUrl: boolean;
  hasExcessUrlParams: boolean;
  ogImageDimensions: { width: number; height: number } | null;
  headingHierarchyBroken: boolean;
  hasBreadcrumbs: boolean;
  hasBreadcrumbSchema: boolean;
  sensitiveDataExposed: string[];
  depth: number;
  // Source snippets captured during parsing — used by checks to include the
  // actual offending HTML/text in their `details.sourceSnippet` so the UI
  // can show "the line that caused the issue".
  titleHtml: string | null;
  metaDescriptionHtml: string | null;
  metaRobotsHtml: string | null;
  viewportHtml: string | null;
  htmlLangAttr: string | null;
  canonicalHtml: string | null;
  ogTagsHtml: string | null;
  firstImgMissingAlt: string | null;
  mixedContentResources: string[];
  headingSequence: string;
  /** Actual <head> inner HTML (truncated) — used as the source snippet for
   *  missing-X-in-head issues, so users see what IS there. */
  headHtmlSnippet: string | null;
  /** Actual <html ...> opening tag — used for missing-lang etc. */
  htmlOpenTag: string | null;
}

interface CrawlIssueData {
  type: string;
  severity: string;
  dimension: 'SEO' | 'GEO' | 'AEO';
  message: string;
  details?: any;
  suggestion?: string;
}

const SKIP_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
  '.pdf', '.zip', '.tar', '.gz', '.rar',
  '.mp4', '.mp3', '.avi', '.mov', '.wmv',
  '.css', '.js', '.woff', '.woff2', '.ttf', '.eot',
  '.xml', '.json', '.rss',
];

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly siteWideAudit: SiteWideAuditService,
  ) {}

  async executeCrawl(crawlJobId: string): Promise<void> {
    let crawlJob = await this.prisma.crawlJob.findUnique({
      where: { id: crawlJobId },
      include: { project: true },
    });

    if (!crawlJob) {
      this.logger.error(`CrawlJob ${crawlJobId} not found`);
      return;
    }

    const domain = crawlJob.project.domain;
    const pagesLimit = crawlJob.pagesLimit;
    const startUrl = `https://${domain}/`;

    // Update status to RUNNING
    await this.prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    const httpClient = axios.create({
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'NR-SEO-Crawler/1.0 (+https://nrseo.com/bot)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      validateStatus: () => true, // Don't throw on any status
    });

    try {
      // Parse robots.txt
      const robotsRules = await this.fetchRobotsTxt(httpClient, domain);

      // BFS crawl
      const visited = new Set<string>();
      const queue: Array<{ url: string; depth: number }> = [
        { url: this.normalizeUrl(startUrl, startUrl), depth: 0 },
      ];
      // Per-URL crawl metadata used by post-crawl checks (orphan detection,
      // depth checks, etc.). Keyed by normalised URL.
      const depthMap = new Map<string, number>();
      const inboundLinks = new Map<string, Set<string>>();
      depthMap.set(this.normalizeUrl(startUrl, startUrl), 0);

      let totalErrors = 0;
      let totalWarnings = 0;
      let totalNotices = 0;
      let pagesCrawled = 0;

      // Semaphore for concurrency control
      const concurrency = 5;
      // concurrency managed by batch processing below

      const processUrl = async (url: string, depth: number): Promise<void> => {
        // Re-check job status for cancellation
        const currentJob = await this.prisma.crawlJob.findUnique({
          where: { id: crawlJobId },
          select: { status: true },
        });
        if (currentJob?.status === 'CANCELLED') return;

        try {
          const pageData = await this.fetchAndParsePage(httpClient, url, domain);
          pageData.depth = depth;
          const seoIssues = this.runSeoChecks(pageData);
          const geoIssues = this.runGeoChecks(pageData);
          const aeoIssues = this.runAeoChecks(pageData);
          const checklistIssues = this.runChecklistChecks(pageData);
          const issues = [...seoIssues, ...geoIssues, ...aeoIssues, ...checklistIssues];

          // Create CrawlPage record
          const crawlPage = await this.prisma.crawlPage.create({
            data: {
              crawlJobId,
              url: pageData.url,
              statusCode: pageData.statusCode,
              title: pageData.title,
              metaDescription: pageData.metaDescription,
              h1: pageData.h1,
              h1Count: pageData.h1Count,
              wordCount: pageData.wordCount,
              loadTimeMs: pageData.loadTimeMs,
              contentType: pageData.contentType,
              canonicalUrl: pageData.canonicalUrl,
              hasRobotsNoindex: pageData.hasRobotsNoindex,
              hasRobotsNofollow: pageData.hasRobotsNofollow,
              internalLinksCount: pageData.internalLinksCount,
              externalLinksCount: pageData.externalLinksCount,
              imagesCount: pageData.imagesCount,
              imagesWithoutAlt: pageData.imagesWithoutAlt,
              htmlSize: pageData.htmlSize,
              hasViewport: pageData.hasViewport,
              hasLangAttr: pageData.hasLangAttr,
              hasOgTags: pageData.hasOgTags,
              hasOgImage: pageData.hasOgImage,
              hasTwitterCard: pageData.hasTwitterCard,
              hasStructuredData: pageData.hasStructuredData,
              redirectCount: pageData.redirectCount,
              // GEO fields
              hasAuthorInfo: pageData.hasAuthorInfo,
              hasContactInfo: pageData.hasContactInfo,
              hasTrustSignals: pageData.hasTrustSignals,
              hasOrgSchema: pageData.hasOrgSchema,
              hasAuthorSchema: pageData.hasAuthorSchema,
              hasSameAsLinks: pageData.hasSameAsLinks,
              hasCitations: pageData.hasCitations,
              hasOriginalData: pageData.hasOriginalData,
              hasContentDate: pageData.hasContentDate,
              socialProfileCount: pageData.socialProfileCount,
              schemaTypes: pageData.schemaTypes.join(','),
              // AEO fields
              hasFaqSchema: pageData.hasFaqSchema,
              hasHowToSchema: pageData.hasHowToSchema,
              hasSpeakableSchema: pageData.hasSpeakableSchema,
              questionHeadingsCount: pageData.questionHeadingsCount,
              hasDefinitionPattern: pageData.hasDefinitionPattern,
              hasListContent: pageData.hasListContent,
              hasTableContent: pageData.hasTableContent,
              directAnswerCount: pageData.directAnswerCount,
            },
          });

          // Create CrawlIssue records
          if (issues.length > 0) {
            await this.prisma.crawlIssue.createMany({
              data: issues.map((issue) => ({
                crawlPageId: crawlPage.id,
                type: issue.type as any,
                severity: issue.severity as any,
                dimension: issue.dimension as any,
                message: issue.message,
                details: issue.details || undefined,
                suggestion: issue.suggestion || undefined,
              })),
            });
          }

          // Count issues
          for (const issue of issues) {
            if (issue.severity === 'ERROR') totalErrors++;
            else if (issue.severity === 'WARNING') totalWarnings++;
            else totalNotices++;
          }

          pagesCrawled++;

          // Add internal links to queue + record inbound link relationships
          // (used by post-crawl orphan detection)
          for (const link of pageData.internalLinks) {
            const normalized = this.normalizeUrl(link, url);
            if (!normalized || !this.isSameDomain(normalized, domain)) continue;

            // Always record the inbound edge — even for already-visited
            // targets, since orphan detection cares about ALL inbound links.
            if (!inboundLinks.has(normalized)) inboundLinks.set(normalized, new Set());
            inboundLinks.get(normalized)!.add(url);

            if (
              !visited.has(normalized) &&
              !this.isBlockedByRobots(normalized, robotsRules) &&
              !this.shouldSkipUrl(normalized)
            ) {
              visited.add(normalized);
              const childDepth = depth + 1;
              depthMap.set(normalized, childDepth);
              queue.push({ url: normalized, depth: childDepth });
            }
          }

          // Update progress periodically
          if (pagesCrawled % 5 === 0 || pagesCrawled === 1) {
            await this.prisma.crawlJob.update({
              where: { id: crawlJobId },
              data: {
                pagesCrawled,
                pagesTotal: visited.size,
                errorCount: totalErrors,
                warningCount: totalWarnings,
                noticeCount: totalNotices,
              },
            });
          }
        } catch (err: any) {
          // Detect redirect loops: axios reports ERR_FR_TOO_MANY_REDIRECTS or
          // a "Maximum number of redirects exceeded" error when its maxRedirects
          // is exceeded — strong signal that the URL is in a redirect cycle.
          const code = err?.code || '';
          const message = String(err?.message || '');
          const looksLikeRedirectLoop =
            code === 'ERR_FR_TOO_MANY_REDIRECTS' ||
            /maximum number of redirects/i.test(message);

          if (looksLikeRedirectLoop) {
            try {
              const loopPage = await this.prisma.crawlPage.create({
                data: { crawlJobId, url, statusCode: null },
              });
              await this.prisma.crawlIssue.create({
                data: {
                  crawlPageId: loopPage.id,
                  type: 'REDIRECT_LOOP' as any,
                  severity: 'ERROR' as any,
                  dimension: 'SEO' as any,
                  message: `URL is stuck in a redirect loop`,
                  suggestion: 'Inspect the redirect chain — a URL is redirecting back to itself or to a URL earlier in the chain.',
                },
              });
              totalErrors++;
              pagesCrawled++;
            } catch (innerErr) {
              this.logger.warn(`Failed to record redirect loop for ${url}: ${innerErr}`);
            }
          } else {
            this.logger.warn(`Failed to crawl ${url}: ${err}`);
          }
        }
      };

      // Add start URL to visited
      const normalizedStart = this.normalizeUrl(startUrl, startUrl);
      visited.add(normalizedStart);

      // Process queue with concurrency limit
      while (queue.length > 0 && pagesCrawled < pagesLimit) {
        // Check cancellation
        const currentJob = await this.prisma.crawlJob.findUnique({
          where: { id: crawlJobId },
          select: { status: true },
        });
        if (currentJob?.status === 'CANCELLED') break;

        // Take batch from queue
        const batchSize = Math.min(concurrency, queue.length, pagesLimit - pagesCrawled);
        const batch = queue.splice(0, batchSize);

        // Process batch concurrently
        await Promise.all(batch.map((entry) => processUrl(entry.url, entry.depth)));
      }

      // ---- Post-crawl cross-page checks ----
      const postCrawlResult = await this.runPostCrawlChecks(crawlJobId, inboundLinks, this.normalizeUrl(startUrl, startUrl));
      totalErrors += postCrawlResult.errors;
      totalWarnings += postCrawlResult.warnings;
      totalNotices += postCrawlResult.notices;

      // ---- Site-wide checks (robots.txt, sitemap.xml, redirects, SSL, favicon) ----
      try {
        const siteWideResult = await this.siteWideAudit.runSiteWideChecks(crawlJobId, domain);
        totalErrors += siteWideResult.errors;
        totalWarnings += siteWideResult.warnings;
        totalNotices += siteWideResult.notices;
      } catch (err) {
        this.logger.warn(`Site-wide audit failed for ${crawlJobId}: ${err}`);
      }

      // Calculate overall health score
      // With ~55 checks per page across SEO/GEO/AEO, we scale the denominator accordingly
      const totalChecksPerformed = pagesCrawled * 55; // approximate checks per page
      // Weight: errors count 3x, warnings 1.5x, notices 0.5x
      const weightedIssues = (totalErrors * 3) + (totalWarnings * 1.5) + (totalNotices * 0.5);
      const weightedMax = totalChecksPerformed * 3; // max if every check was an error
      const score = weightedMax > 0
        ? Math.max(0, Math.round(100 * (1 - weightedIssues / weightedMax)))
        : 0;

      // Calculate 3-dimension scores (1-10 scale per SKILL.md rubric)
      const dimensionScores = await this.calculateDimensionScores(crawlJobId, pagesCrawled);

      // Update final status
      await this.prisma.crawlJob.update({
        where: { id: crawlJobId },
        data: {
          status: 'COMPLETED',
          pagesCrawled,
          pagesTotal: visited.size,
          errorCount: totalErrors,
          warningCount: totalWarnings,
          noticeCount: totalNotices,
          score,
          seoScore: dimensionScores.seo,
          geoScore: dimensionScores.geo,
          aeoScore: dimensionScores.aeo,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Crawl ${crawlJobId} completed: ${pagesCrawled} pages, score ${score}`,
      );
    } catch (error) {
      this.logger.error(`Crawl ${crawlJobId} failed: ${error}`);
      await this.prisma.crawlJob.update({
        where: { id: crawlJobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });
    }
  }

  private async fetchRobotsTxt(
    httpClient: AxiosInstance,
    domain: string,
  ): Promise<RobotsRules> {
    const rules: RobotsRules = { disallowedPaths: [], allowedPaths: [] };

    try {
      const response = await httpClient.get(`https://${domain}/robots.txt`);
      if (response.status !== 200) return rules;

      const lines = (response.data as string).split('\n');
      let isRelevantAgent = false;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const [directive, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();

        if (directive.toLowerCase() === 'user-agent') {
          isRelevantAgent = value === '*' || value.toLowerCase().includes('nr-seo');
        } else if (isRelevantAgent) {
          if (directive.toLowerCase() === 'disallow' && value) {
            rules.disallowedPaths.push(value);
          } else if (directive.toLowerCase() === 'allow' && value) {
            rules.allowedPaths.push(value);
          }
        }
      }
    } catch {
      // robots.txt not found or error — allow all
    }

    return rules;
  }

  private isBlockedByRobots(url: string, rules: RobotsRules): boolean {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;

      // Check allowed first (more specific)
      for (const allowed of rules.allowedPaths) {
        if (path.startsWith(allowed)) return false;
      }

      // Check disallowed
      for (const disallowed of rules.disallowedPaths) {
        if (path.startsWith(disallowed)) return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  private async fetchAndParsePage(
    httpClient: AxiosInstance,
    url: string,
    domain: string,
  ): Promise<PageData> {
    const startTime = Date.now();
    const response = await httpClient.get(url);
    const loadTimeMs = Date.now() - startTime;

    const contentType = response.headers['content-type'] || '';
    const statusCode = response.status;

    // Count redirects from response
    const redirectCount = response.request?._redirectable?._redirectCount || 0;

    const html = typeof response.data === 'string' ? response.data : String(response.data);

    const pageData: PageData = {
      url,
      statusCode,
      title: null,
      metaDescription: null,
      h1: null,
      h1Count: 0,
      wordCount: 0,
      loadTimeMs,
      contentType: contentType.split(';')[0].trim(),
      canonicalUrl: null,
      hasRobotsNoindex: false,
      hasRobotsNofollow: false,
      internalLinksCount: 0,
      externalLinksCount: 0,
      imagesCount: 0,
      imagesWithoutAlt: 0,
      internalLinks: [],
      htmlSize: Buffer.byteLength(html, 'utf8'),
      hasViewport: false,
      hasLangAttr: false,
      hasOgTags: false,
      hasOgImage: false,
      hasTwitterCard: false,
      hasStructuredData: false,
      redirectCount,
      hasMixedContent: false,
      externalLinks: [],
      urlClean: false,
      hasContentDate: false,
      anchorTexts: [],
      // GEO defaults
      hasAuthorInfo: false,
      hasContactInfo: false,
      hasTrustSignals: false,
      hasOrgSchema: false,
      hasAuthorSchema: false,
      hasSameAsLinks: false,
      hasCitations: false,
      hasOriginalData: false,
      socialProfileCount: 0,
      schemaTypes: [],
      bodyText: '',
      // AEO defaults
      hasFaqSchema: false,
      hasHowToSchema: false,
      hasSpeakableSchema: false,
      questionHeadingsCount: 0,
      hasDefinitionPattern: false,
      hasListContent: false,
      hasTableContent: false,
      directAnswerCount: 0,
      // Checklist defaults
      responseHeaders: this.normaliseHeaders(response.headers),
      domNodeCount: 0,
      imagesLazyLoaded: 0,
      imagesWithoutDimensions: 0,
      imagesNonNextGen: 0,
      imagesPoorFilenames: 0,
      hasPreconnectHints: false,
      hasFontDisplaySwap: false,
      hreflangTags: [],
      isAmpPage: false,
      ampHtml: null,
      hasGoogleAnalytics: false,
      hasGoogleTagManager: false,
      hasProductSchema: false,
      hasArticleSchema: false,
      underscoresInUrl: /_/.test(new URL(url).pathname),
      hasExcessUrlParams: false,
      ogImageDimensions: null,
      headingHierarchyBroken: false,
      hasBreadcrumbs: false,
      hasBreadcrumbSchema: false,
      sensitiveDataExposed: [],
      depth: 0,
      titleHtml: null,
      metaDescriptionHtml: null,
      metaRobotsHtml: null,
      viewportHtml: null,
      htmlLangAttr: null,
      canonicalHtml: null,
      ogTagsHtml: null,
      firstImgMissingAlt: null,
      mixedContentResources: [],
      headingSequence: '',
      headHtmlSnippet: null,
      htmlOpenTag: null,
    };

    try {
      const u = new URL(url);
      pageData.hasExcessUrlParams = u.searchParams.toString().length > 80;
    } catch { /* ignore */ }

    // Only parse HTML
    if (!contentType.includes('text/html')) return pageData;

    const $ = cheerio.load(html);

    // Capture the actual <html> opening tag and <head> inner HTML so that
    // "missing X" issues can show the surrounding source code (what IS there)
    // instead of a hardcoded "<head> contains no <X>" placeholder.
    const htmlOpenMatch = html.match(/<html[^>]*>/i);
    pageData.htmlOpenTag = htmlOpenMatch ? htmlOpenMatch[0] : null;

    const headEl = $('head');
    if (headEl.length > 0) {
      const headInner = headEl.html() || '';
      pageData.headHtmlSnippet = this.snippet(headInner, 800);
    }

    // ===================== SEO SIGNALS =====================

    // Title
    const titleEl = $('title');
    pageData.title = titleEl.length > 0 ? titleEl.first().text().trim() : null;
    pageData.titleHtml = titleEl.length > 0 ? this.snippet($.html(titleEl.first())) : null;

    // Meta description
    const metaDescEl = $('meta[name="description"]').first();
    const metaDesc = metaDescEl.attr('content');
    pageData.metaDescription = metaDesc ? metaDesc.trim() : null;
    pageData.metaDescriptionHtml = metaDescEl.length > 0 ? this.snippet($.html(metaDescEl)) : null;

    // H1
    const h1Elements = $('h1');
    pageData.h1Count = h1Elements.length;
    pageData.h1 = h1Elements.length > 0 ? h1Elements.first().text().trim() : null;
    // Capture a sample of all H1 texts for the multiple-H1 message.
    const h1Texts: string[] = [];
    h1Elements.each((_, el) => {
      const txt = $(el).text().trim();
      if (txt && h1Texts.length < 5) h1Texts.push(txt);
    });
    if (h1Texts.length > 1) {
      pageData.headingSequence = `H1 ×${h1Elements.length}: ${h1Texts.map((t) => `"${t}"`).join(', ')}`;
    }

    // Word count (body text)
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    pageData.wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
    pageData.bodyText = bodyText;

    // Canonical
    const canonicalEl = $('link[rel="canonical"]').first();
    const canonical = canonicalEl.attr('href');
    pageData.canonicalUrl = canonical ? canonical.trim() : null;
    pageData.canonicalHtml = canonicalEl.length > 0 ? this.snippet($.html(canonicalEl)) : null;

    // Meta robots
    const metaRobotsEl = $('meta[name="robots"]').first();
    const metaRobots = metaRobotsEl.attr('content') || '';
    pageData.hasRobotsNoindex = metaRobots.toLowerCase().includes('noindex');
    pageData.hasRobotsNofollow = metaRobots.toLowerCase().includes('nofollow');
    pageData.metaRobotsHtml = metaRobotsEl.length > 0 ? this.snippet($.html(metaRobotsEl)) : null;

    // Viewport
    const viewportEl = $('meta[name="viewport"]').first();
    pageData.hasViewport = viewportEl.length > 0;
    pageData.viewportHtml = viewportEl.length > 0 ? this.snippet($.html(viewportEl)) : null;

    // Lang attribute
    const langAttr = $('html').attr('lang');
    pageData.hasLangAttr = !!langAttr && langAttr.trim().length > 0;
    pageData.htmlLangAttr = langAttr ? langAttr.trim() : null;

    // Open Graph — capture all og:* tags as a snippet
    pageData.hasOgTags =
      $('meta[property="og:title"]').length > 0 &&
      $('meta[property="og:description"]').length > 0;
    pageData.hasOgImage = $('meta[property="og:image"]').length > 0;
    const ogTagSnippets: string[] = [];
    $('meta[property^="og:"]').each((_, el) => {
      ogTagSnippets.push($.html(el));
    });
    pageData.ogTagsHtml = ogTagSnippets.length > 0 ? this.snippet(ogTagSnippets.join('\n')) : null;

    // Twitter Card
    pageData.hasTwitterCard =
      $('meta[name="twitter:card"]').length > 0 ||
      $('meta[property="twitter:card"]').length > 0;

    // URL cleanliness
    try {
      const parsed = new URL(url);
      const pathSegments = parsed.pathname.split('/').filter(Boolean);
      const hasStopWords = /\b(and|the|of|in|to|for|a|an)\b/i.test(parsed.pathname);
      const hasExcessiveParams = parsed.searchParams.toString().length > 50;
      pageData.urlClean = !hasStopWords && !hasExcessiveParams && pathSegments.every(s => /^[a-z0-9-]+$/i.test(s));
    } catch { pageData.urlClean = false; }

    // Content date
    pageData.hasContentDate =
      $('time[datetime]').length > 0 ||
      $('meta[property="article:published_time"]').length > 0 ||
      $('meta[property="article:modified_time"]').length > 0;

    // Mixed content
    if (url.startsWith('https://')) {
      const mixedResources: string[] = [];
      $('img[src], script[src], link[href], iframe[src]').each((_: number, el: any) => {
        const src = $(el).attr('src') || $(el).attr('href') || '';
        if (src.startsWith('http://') && mixedResources.length < 5) {
          mixedResources.push(this.snippet($.html(el)));
        }
      });
      pageData.hasMixedContent = mixedResources.length > 0;
      pageData.mixedContentResources = mixedResources;
    }

    // Images
    const images = $('img');
    pageData.imagesCount = images.length;
    let imagesWithoutAlt = 0;
    let firstMissingAltHtml: string | null = null;
    images.each((_, el) => {
      const alt = $(el).attr('alt');
      if (alt === undefined || alt === null || alt.trim() === '') {
        imagesWithoutAlt++;
        if (!firstMissingAltHtml) firstMissingAltHtml = this.snippet($.html(el));
      }
    });
    pageData.imagesWithoutAlt = imagesWithoutAlt;
    pageData.firstImgMissingAlt = firstMissingAltHtml;

    // Links + anchor texts
    const internalLinks: string[] = [];
    const externalLinks: string[] = [];
    const anchorTexts: string[] = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const text = $(el).text().trim();
      if (text) anchorTexts.push(text);

      const resolved = this.resolveUrl(href, url);
      if (!resolved) return;

      if (this.isSameDomain(resolved, domain)) {
        const normalized = this.normalizeUrl(resolved, url);
        if (normalized && !this.shouldSkipUrl(normalized)) internalLinks.push(normalized);
      } else {
        externalLinks.push(resolved);
      }
    });

    pageData.internalLinks = internalLinks;
    pageData.internalLinksCount = internalLinks.length;
    pageData.externalLinks = externalLinks;
    pageData.externalLinksCount = externalLinks.length;
    pageData.anchorTexts = anchorTexts;

    // ===================== STRUCTURED DATA (shared by SEO/GEO/AEO) =====================

    const schemaTypes: string[] = [];
    const jsonLdScripts = $('script[type="application/ld+json"]');
    let allSchemaData: any[] = [];

    jsonLdScripts.each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() || '{}');
        const items = Array.isArray(parsed) ? parsed : [parsed];
        allSchemaData = allSchemaData.concat(items);
        for (const item of items) {
          if (item['@type']) {
            const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
            schemaTypes.push(...types);
          }
        }
      } catch { /* invalid JSON-LD */ }
    });

    // Also check microdata
    if ($('[itemscope]').length > 0) {
      $('[itemscope]').each((_, el) => {
        const itemtype = $(el).attr('itemtype');
        if (itemtype) {
          const typeName = itemtype.split('/').pop();
          if (typeName) schemaTypes.push(typeName);
        }
      });
    }

    pageData.hasStructuredData = schemaTypes.length > 0;
    pageData.schemaTypes = [...new Set(schemaTypes)];

    // ===================== GEO SIGNALS =====================

    // Organization schema
    pageData.hasOrgSchema = schemaTypes.some(t =>
      ['Organization', 'LocalBusiness', 'Corporation', 'NGO'].includes(t));

    // Author schema
    pageData.hasAuthorSchema = schemaTypes.some(t => t === 'Person') ||
      allSchemaData.some(d => d.author && typeof d.author === 'object');

    // sameAs links (social profiles in schema)
    const sameAsLinks: string[] = [];
    for (const item of allSchemaData) {
      if (item.sameAs) {
        const links = Array.isArray(item.sameAs) ? item.sameAs : [item.sameAs];
        sameAsLinks.push(...links);
      }
    }
    pageData.hasSameAsLinks = sameAsLinks.length > 0;

    // Social profile links (from HTML)
    const socialDomains = ['twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'instagram.com', 'youtube.com', 'github.com', 'tiktok.com'];
    let socialCount = 0;
    for (const link of externalLinks) {
      try {
        const host = new URL(link).hostname.toLowerCase();
        if (socialDomains.some(d => host.includes(d))) socialCount++;
      } catch { /* ignore */ }
    }
    pageData.socialProfileCount = socialCount;

    // Author info detection
    pageData.hasAuthorInfo =
      pageData.hasAuthorSchema ||
      $('[rel="author"]').length > 0 ||
      $('[class*="author"]').length > 0 ||
      $('[itemprop="author"]').length > 0 ||
      /\b(written by|author|by\s+[A-Z][a-z]+\s+[A-Z])/i.test(bodyText);

    // Contact info detection
    const htmlLower = html.toLowerCase();
    pageData.hasContactInfo =
      $('a[href^="tel:"]').length > 0 ||
      $('a[href^="mailto:"]').length > 0 ||
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(bodyText) || // phone pattern
      $('[itemtype*="PostalAddress"]').length > 0 ||
      htmlLower.includes('contact us') ||
      htmlLower.includes('get in touch');

    // Trust signals (testimonials, awards, certifications)
    pageData.hasTrustSignals =
      /\b(testimonial|review|award|certified|accredited|featured in|as seen in|trusted by|client|partner)\b/i.test(bodyText) ||
      $('[class*="testimonial"]').length > 0 ||
      $('[class*="review"]').length > 0 ||
      $('[class*="trust"]').length > 0 ||
      $('[class*="award"]').length > 0;

    // Citation detection (outbound references to authoritative sources)
    const citationPatterns = /\b(according to|source:|study by|research from|data from|reported by|published in)\b/i;
    pageData.hasCitations = citationPatterns.test(bodyText) || externalLinks.length >= 3;

    // Original data (statistics, percentages, data points)
    const dataPatterns = /\b(\d+%|\d+\.\d+%|\$[\d,]+|\d+ (million|billion|thousand)|survey of \d+|study of \d+|our (data|research|analysis) shows)\b/i;
    pageData.hasOriginalData = dataPatterns.test(bodyText);

    // ===================== AEO SIGNALS =====================

    // FAQ schema
    pageData.hasFaqSchema = schemaTypes.includes('FAQPage') ||
      allSchemaData.some(d => d['@type'] === 'FAQPage' || (d.mainEntity && Array.isArray(d.mainEntity)));

    // HowTo schema
    pageData.hasHowToSchema = schemaTypes.includes('HowTo');

    // Speakable schema
    pageData.hasSpeakableSchema = allSchemaData.some(d => d.speakable) ||
      schemaTypes.includes('SpeakableSpecification');

    // Question-phrased headings
    let questionHeadings = 0;
    $('h2, h3, h4').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (/^(how|what|why|when|where|who|which|can|does|do|is|are|should|will)\b/.test(text) ||
          text.endsWith('?')) {
        questionHeadings++;
      }
    });
    pageData.questionHeadingsCount = questionHeadings;

    // Definition pattern ("X is..." or "X refers to...")
    pageData.hasDefinitionPattern =
      /\b(is a|is an|refers to|is defined as|means|is the process of)\b/i.test(bodyText.slice(0, 2000));

    // List content (ordered/unordered lists)
    pageData.hasListContent = $('ol li').length >= 3 || $('ul li').length >= 3;

    // Table content
    pageData.hasTableContent = $('table').length > 0 && $('table tr').length >= 3;

    // Direct answer paragraphs (concise paragraph after a question heading, 20-80 words)
    let directAnswers = 0;
    $('h2, h3').each((_, el) => {
      const headingText = $(el).text().trim();
      if (/\?$|^(how|what|why|when|where|who|which)\b/i.test(headingText)) {
        const nextP = $(el).next('p');
        if (nextP.length > 0) {
          const pWords = nextP.text().trim().split(/\s+/).length;
          if (pWords >= 20 && pWords <= 80) directAnswers++;
        }
      }
    });
    pageData.directAnswerCount = directAnswers;

    // ===================== CHECKLIST SIGNALS =====================

    // DOM node count
    pageData.domNodeCount = $('*').length;

    // Image-level checks
    let lazyLoaded = 0;
    let withoutDims = 0;
    let nonNextGen = 0;
    let poorFilenames = 0;
    images.each((_: number, el: any) => {
      const $img = $(el);
      const loading = ($img.attr('loading') || '').toLowerCase();
      if (loading === 'lazy') lazyLoaded++;
      const w = $img.attr('width');
      const h = $img.attr('height');
      if (!w || !h) withoutDims++;
      const src = ($img.attr('src') || '').toLowerCase();
      if (src && !/(webp|avif)(\?|$)/.test(src) && /\.(jpe?g|png)(\?|$)/.test(src)) nonNextGen++;
      if (src) {
        const filename = src.split('/').pop()?.split('?')[0] || '';
        if (/^(img|image|photo|pic|dsc|screenshot|untitled)?[-_]?\d{2,}/i.test(filename)) poorFilenames++;
      }
    });
    pageData.imagesLazyLoaded = lazyLoaded;
    pageData.imagesWithoutDimensions = withoutDims;
    pageData.imagesNonNextGen = nonNextGen;
    pageData.imagesPoorFilenames = poorFilenames;

    // Performance hints
    pageData.hasPreconnectHints =
      $('link[rel="preconnect"], link[rel="dns-prefetch"]').length > 0;

    // Font-display: swap detection.
    // Strategy: only check pages that actually use web fonts (otherwise this
    // would false-positive every plain-system-font page). A page uses web
    // fonts if it links Google Fonts, has @font-face in inline CSS, or links
    // an external stylesheet that mentions "fonts".
    let fontDisplaySwap = false;
    let usesWebFonts = false;

    // Check inline <style> blocks
    $('style').each((_: number, el: any) => {
      const css = $(el).html() || '';
      if (/@font-face/i.test(css)) usesWebFonts = true;
      if (/font-display\s*:\s*swap/i.test(css)) fontDisplaySwap = true;
    });

    // Check <link rel="stylesheet"> hrefs for Google Fonts (which always need
    // a `&display=swap` query param to enable swap)
    $('link[rel="stylesheet"]').each((_: number, el: any) => {
      const href = ($(el).attr('href') || '').toLowerCase();
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(href)) {
        usesWebFonts = true;
        if (/display=swap/.test(href)) fontDisplaySwap = true;
      }
    });

    // If page uses web fonts but no swap declaration found, that's the issue.
    pageData.hasFontDisplaySwap = !usesWebFonts || fontDisplaySwap;

    // Hreflang tags
    const hreflangs: { hreflang: string; href: string }[] = [];
    $('link[rel="alternate"][hreflang]').each((_: number, el: any) => {
      const hreflang = ($(el).attr('hreflang') || '').trim();
      const href = ($(el).attr('href') || '').trim();
      if (hreflang && href) hreflangs.push({ hreflang, href });
    });
    pageData.hreflangTags = hreflangs;

    // AMP detection — match either the literal `amp` boolean attribute or the
    // ⚡ shorthand on <html>. Cheerio's CSS-selector parser doesn't handle
    // non-ASCII attribute names cleanly, so we sniff the raw HTML instead.
    const htmlOpenTag = (html.match(/<html[^>]*>/i) || [''])[0];
    pageData.isAmpPage =
      /<html[^>]*\samp(\s|=|>)/i.test(htmlOpenTag) ||
      /<html[^>]*⚡/.test(htmlOpenTag);
    pageData.ampHtml = pageData.isAmpPage ? html : null;

    // Analytics / GTM
    const lowerHtml = html.toLowerCase();
    pageData.hasGoogleAnalytics =
      lowerHtml.includes('googletagmanager.com/gtag/js') ||
      lowerHtml.includes('google-analytics.com/analytics.js') ||
      /gtag\(\s*['"]config['"]\s*,/.test(html) ||
      lowerHtml.includes('ga(\'create\'');
    // GTM container IDs are formatted GTM-XXXXXX (uppercase, dash, 5-9 alnum).
    // Match the exact pattern with a word boundary to avoid catching "gtmaster" etc.
    pageData.hasGoogleTagManager =
      lowerHtml.includes('googletagmanager.com/gtm.js') ||
      /\bGTM-[A-Z0-9]{5,9}\b/.test(html);

    // Schema-type-specific flags
    pageData.hasProductSchema = schemaTypes.includes('Product');
    pageData.hasArticleSchema =
      schemaTypes.includes('Article') ||
      schemaTypes.includes('BlogPosting') ||
      schemaTypes.includes('NewsArticle');

    // OG image dimensions (declared via meta tags)
    const ogImgW = parseInt($('meta[property="og:image:width"]').attr('content') || '0', 10);
    const ogImgH = parseInt($('meta[property="og:image:height"]').attr('content') || '0', 10);
    pageData.ogImageDimensions = ogImgW > 0 && ogImgH > 0 ? { width: ogImgW, height: ogImgH } : null;

    // Heading hierarchy: no skipped levels (e.g. H1 → H4 with no H2/H3 in between)
    const headingLevels: number[] = [];
    const headingPreview: string[] = [];
    $('h1, h2, h3, h4, h5, h6').each((_: number, el: any) => {
      const tag = (el as any).tagName?.toLowerCase?.() || (el as any).name;
      const m = /^h([1-6])$/i.exec(tag || '');
      if (m) {
        headingLevels.push(parseInt(m[1], 10));
        if (headingPreview.length < 8) {
          const text = $(el).text().trim().slice(0, 40);
          headingPreview.push(`<${tag}>${text}</${tag}>`);
        }
      }
    });
    let hierarchyBroken = false;
    let firstSkip: { from: number; to: number } | null = null;
    for (let i = 1; i < headingLevels.length; i++) {
      if (headingLevels[i] > headingLevels[i - 1] + 1) {
        hierarchyBroken = true;
        firstSkip = { from: headingLevels[i - 1], to: headingLevels[i] };
        break;
      }
    }
    pageData.headingHierarchyBroken = hierarchyBroken;
    if (hierarchyBroken && firstSkip) {
      pageData.headingSequence = `H${firstSkip.from} → H${firstSkip.to} (skipped levels). Sequence: ${headingPreview.join(' ')}`;
    } else if (!pageData.headingSequence) {
      pageData.headingSequence = headingPreview.join(' ');
    }

    // Breadcrumbs: detect via aria-label, common class names, or BreadcrumbList schema.
    pageData.hasBreadcrumbs =
      $('[aria-label*="breadcrumb" i]').length > 0 ||
      $('nav[class*="breadcrumb" i], ol[class*="breadcrumb" i], ul[class*="breadcrumb" i]').length > 0 ||
      $('[itemtype*="BreadcrumbList" i]').length > 0;
    pageData.hasBreadcrumbSchema = schemaTypes.includes('BreadcrumbList');

    // Sensitive data exposure scan (#102) — look for accidentally-leaked secrets
    // in HTML source. Patterns are deliberately conservative to limit false
    // positives; we match well-known secret formats only.
    const sensitiveMatches: string[] = [];
    const sensitivePatterns: { name: string; rx: RegExp }[] = [
      { name: 'AWS Access Key', rx: /\bAKIA[0-9A-Z]{16}\b/g },
      { name: 'AWS Secret Key', rx: /\b[A-Za-z0-9/+=]{40}\b(?=[^A-Za-z0-9/+=])/g }, // weak — keep off by default
      { name: 'Stripe key', rx: /\bsk_(live|test)_[A-Za-z0-9]{24,}/g },
      { name: 'Slack token', rx: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
      { name: 'Google API key', rx: /\bAIza[0-9A-Za-z_-]{35}\b/g },
      { name: 'GitHub PAT', rx: /\bghp_[A-Za-z0-9]{36,}\b/g },
      { name: 'Private key block', rx: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
      { name: 'Generic api_key', rx: /["']?api[_-]?(?:key|secret|token)["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{24,}["']/gi },
    ];
    for (const { name, rx } of sensitivePatterns) {
      // Skip the AWS-secret-shaped 40-char heuristic — too noisy on minified JS.
      if (name === 'AWS Secret Key') continue;
      if (rx.test(html)) sensitiveMatches.push(name);
    }
    pageData.sensitiveDataExposed = sensitiveMatches;

    return pageData;
  }

  /**
   * Truncate an HTML/text snippet to a safe length so we can attach it to
   * issue details without bloating CrawlIssue rows. Collapses whitespace and
   * caps the length to ~300 chars. Used by checks that want to show "the
   * line that caused the issue" in the report.
   */
  private snippet(raw: string | null | undefined, max: number = 300): string {
    if (!raw) return '';
    const collapsed = String(raw).replace(/\s+/g, ' ').trim();
    if (collapsed.length <= max) return collapsed;
    return collapsed.slice(0, max - 1) + '…';
  }

  /** Lower-case header keys so we can do case-insensitive lookups later. */
  private normaliseHeaders(headers: any): Record<string, string> {
    const out: Record<string, string> = {};
    if (!headers || typeof headers !== 'object') return out;
    for (const [k, v] of Object.entries(headers)) {
      if (typeof v === 'string') out[k.toLowerCase()] = v;
      else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) out[k.toLowerCase()] = v.join(', ');
    }
    return out;
  }

  // ============================================================
  // SEO CHECKS (Traditional Search Engine Optimization)
  // ============================================================
  private runSeoChecks(page: PageData): CrawlIssueData[] {
    const issues: CrawlIssueData[] = [];
    const d = 'SEO' as const;

    // --- ERRORS ---
    if (page.statusCode === 404)
      issues.push({ type: 'PAGE_NOT_FOUND', severity: 'ERROR', dimension: d, message: 'Page returns 404 Not Found', suggestion: 'Fix or redirect this URL to a valid page, or remove links pointing to it.' });

    if (page.statusCode !== null && page.statusCode >= 500)
      issues.push({ type: 'SERVER_ERROR', severity: 'ERROR', dimension: d, message: `Page returns server error (${page.statusCode})`, details: { statusCode: page.statusCode }, suggestion: 'Investigate server logs for the cause of this error.' });

    if (!page.title || page.title.trim() === '')
      issues.push({ type: 'MISSING_TITLE', severity: 'ERROR', dimension: d, message: 'Page is missing a title tag', details: { sourceSnippet: page.headHtmlSnippet || undefined }, suggestion: 'Add a unique, descriptive <title> tag between 30-60 characters.' });

    if (!page.h1 || page.h1.trim() === '')
      issues.push({ type: 'MISSING_H1', severity: 'ERROR', dimension: d, message: 'Page is missing an H1 heading', details: { sourceSnippet: page.headingSequence ? `Headings found: ${page.headingSequence}` : 'No heading elements found in <body>' }, suggestion: 'Add a single, descriptive <h1> heading that includes your primary keyword.' });

    if (page.hasRobotsNoindex)
      issues.push({ type: 'HAS_NOINDEX', severity: 'ERROR', dimension: d, message: 'Page has a noindex meta robots tag', details: { sourceSnippet: page.metaRobotsHtml || undefined }, suggestion: 'Remove the noindex directive if you want this page to appear in search results.' });

    if (page.redirectCount >= 3)
      issues.push({ type: 'REDIRECT_CHAIN', severity: 'ERROR', dimension: d, message: `Page has a redirect chain of ${page.redirectCount} hops`, details: { redirectCount: page.redirectCount, sourceSnippet: `Final URL after ${page.redirectCount} hops: ${page.url}` }, suggestion: 'Reduce redirect chains to a single redirect.' });

    if (page.hasMixedContent)
      issues.push({ type: 'MIXED_CONTENT', severity: 'ERROR', dimension: d, message: 'Page loads HTTP resources on an HTTPS page (mixed content)', details: { sourceSnippet: page.mixedContentResources.join('\n') || undefined, mixedResources: page.mixedContentResources }, suggestion: 'Update all resource URLs to use HTTPS.' });

    // --- WARNINGS ---
    if (!page.metaDescription || page.metaDescription.trim() === '')
      issues.push({ type: 'MISSING_META_DESCRIPTION', severity: 'WARNING', dimension: d, message: 'Page is missing a meta description', details: { sourceSnippet: page.headHtmlSnippet || undefined }, suggestion: 'Add a compelling meta description between 120-160 characters.' });

    if (page.imagesWithoutAlt > 0)
      issues.push({ type: 'IMAGE_MISSING_ALT', severity: 'WARNING', dimension: d, message: `${page.imagesWithoutAlt} image(s) missing alt attribute`, details: { count: page.imagesWithoutAlt, sourceSnippet: page.firstImgMissingAlt || undefined }, suggestion: 'Add descriptive alt text to all images.' });

    if (page.loadTimeMs !== null && page.loadTimeMs > 5000)
      issues.push({ type: 'SLOW_PAGE', severity: 'WARNING', dimension: d, message: `Page load time is ${page.loadTimeMs}ms (over 5s)`, details: { loadTimeMs: page.loadTimeMs, sourceSnippet: `${page.url} took ${page.loadTimeMs}ms to respond` }, suggestion: 'Optimize page speed by compressing images, minifying resources, and using caching.' });

    if (page.h1Count > 1)
      issues.push({ type: 'MULTIPLE_H1', severity: 'WARNING', dimension: d, message: `Page has ${page.h1Count} H1 tags (should have 1)`, details: { sourceSnippet: page.headingSequence || undefined, h1Count: page.h1Count }, suggestion: 'Use only one <h1> tag per page.' });

    if (!page.canonicalUrl)
      issues.push({ type: 'MISSING_CANONICAL', severity: 'WARNING', dimension: d, message: 'Page is missing a canonical URL tag', details: { sourceSnippet: page.headHtmlSnippet || undefined }, suggestion: 'Add a <link rel="canonical"> tag to prevent duplicate content.' });

    if (!page.hasViewport)
      issues.push({ type: 'MISSING_VIEWPORT', severity: 'WARNING', dimension: d, message: 'Page is missing a viewport meta tag', details: { sourceSnippet: page.headHtmlSnippet || undefined }, suggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.' });

    if (!page.hasLangAttr)
      issues.push({ type: 'MISSING_LANG', severity: 'WARNING', dimension: d, message: 'HTML tag is missing a lang attribute', details: { sourceSnippet: page.htmlOpenTag || undefined }, suggestion: 'Add lang="en" (or appropriate language) to the <html> tag.' });

    if (!page.hasOgTags)
      issues.push({ type: 'MISSING_OG_TAGS', severity: 'WARNING', dimension: d, message: 'Page is missing Open Graph meta tags (og:title, og:description)', details: { sourceSnippet: page.ogTagsHtml || page.headHtmlSnippet || undefined }, suggestion: 'Add OG tags for better social media sharing previews.' });

    if (page.hasOgTags && !page.hasOgImage)
      issues.push({ type: 'MISSING_OG_IMAGE', severity: 'WARNING', dimension: d, message: 'Page has OG tags but is missing og:image', suggestion: 'Add an og:image tag (1200x630px) for social sharing thumbnails.' });

    if (!page.hasTwitterCard)
      issues.push({ type: 'MISSING_TWITTER_CARD', severity: 'WARNING', dimension: d, message: 'Page is missing Twitter Card meta tags', suggestion: 'Add <meta name="twitter:card" content="summary_large_image"> for rich Twitter previews.' });

    if (!page.hasStructuredData)
      issues.push({ type: 'MISSING_STRUCTURED_DATA', severity: 'WARNING', dimension: d, message: 'Page has no structured data (JSON-LD or microdata)', suggestion: 'Add JSON-LD structured data for rich results in search.' });

    if (page.htmlSize > 500000)
      issues.push({ type: 'LARGE_PAGE_SIZE', severity: 'WARNING', dimension: d, message: `Page HTML is ${Math.round(page.htmlSize / 1024)}KB (max: 500KB)`, details: { htmlSizeBytes: page.htmlSize }, suggestion: 'Reduce page size by removing unnecessary code.' });

    const totalLinks = page.internalLinksCount + page.externalLinksCount;
    if (totalLinks > 200)
      issues.push({ type: 'TOO_MANY_LINKS', severity: 'WARNING', dimension: d, message: `Page has ${totalLinks} links (max: 200)`, suggestion: 'Reduce links to avoid diluting PageRank.' });

    // Non-descriptive anchor texts
    const genericAnchors = page.anchorTexts.filter(t => /^(click here|read more|learn more|here|link|more|this)$/i.test(t));
    if (genericAnchors.length >= 3)
      issues.push({ type: 'NON_DESCRIPTIVE_ANCHOR', severity: 'WARNING', dimension: d, message: `${genericAnchors.length} links use generic anchor text ("click here", "read more")`, suggestion: 'Use descriptive anchor text that tells users and search engines what the linked page is about.' });

    // --- NOTICES ---
    if (page.title && page.title.length > 60)
      issues.push({ type: 'TITLE_TOO_LONG', severity: 'NOTICE', dimension: d, message: `Title is ${page.title.length} chars (max: 60)`, details: { length: page.title.length, title: page.title, sourceSnippet: page.titleHtml || undefined }, suggestion: 'Shorten the title to under 60 characters.' });

    if (page.title && page.title.trim() !== '' && page.title.length < 30)
      issues.push({ type: 'TITLE_TOO_SHORT', severity: 'NOTICE', dimension: d, message: `Title is ${page.title.length} chars (min: 30)`, details: { length: page.title.length, sourceSnippet: page.titleHtml || undefined }, suggestion: 'Expand the title to at least 30 characters.' });

    if (page.metaDescription && page.metaDescription.length > 160)
      issues.push({ type: 'META_DESCRIPTION_TOO_LONG', severity: 'NOTICE', dimension: d, message: `Meta description is ${page.metaDescription.length} chars (max: 160)`, details: { length: page.metaDescription.length, sourceSnippet: page.metaDescriptionHtml || undefined }, suggestion: 'Shorten to under 160 characters.' });

    if (page.metaDescription && page.metaDescription.trim() !== '' && page.metaDescription.length < 120)
      issues.push({ type: 'META_DESCRIPTION_TOO_SHORT', severity: 'NOTICE', dimension: d, message: `Meta description is ${page.metaDescription.length} chars (min: 120)`, details: { length: page.metaDescription.length, sourceSnippet: page.metaDescriptionHtml || undefined }, suggestion: 'Expand to at least 120 characters.' });

    if (page.wordCount < 300)
      issues.push({ type: 'LOW_WORD_COUNT', severity: 'NOTICE', dimension: d, message: `Page has only ${page.wordCount} words (min: 300)`, details: { wordCount: page.wordCount, sourceSnippet: `Body word count: ${page.wordCount}` }, suggestion: 'Add more quality content. Thin content ranks poorly.' });

    if (page.internalLinksCount < 3 && page.statusCode === 200)
      issues.push({ type: 'LOW_INTERNAL_LINKS', severity: 'NOTICE', dimension: d, message: `Only ${page.internalLinksCount} internal links (min: 3)`, suggestion: 'Add more internal links for discovery and PageRank.' });

    if (page.externalLinksCount === 0 && page.statusCode === 200 && page.wordCount > 300)
      issues.push({ type: 'LOW_EXTERNAL_LINKS', severity: 'NOTICE', dimension: d, message: 'No outbound external links', suggestion: 'Link to authoritative external sources.' });

    if (!page.urlClean)
      issues.push({ type: 'URL_NOT_CLEAN', severity: 'NOTICE', dimension: d, message: 'URL contains stop words, special characters, or excessive parameters', suggestion: 'Use clean, keyword-rich, hyphenated URLs.' });

    if (!page.hasContentDate && page.wordCount > 500)
      issues.push({ type: 'NO_CONTENT_DATE', severity: 'NOTICE', dimension: d, message: 'No publication or modification date visible', suggestion: 'Add a visible date and article:published_time meta tag for content freshness signals.' });

    return issues;
  }

  // ============================================================
  // GEO CHECKS (Generative Engine Optimization)
  // ============================================================
  private runGeoChecks(page: PageData): CrawlIssueData[] {
    const issues: CrawlIssueData[] = [];
    const d = 'GEO' as const;

    // Only check HTML pages with content
    if (page.statusCode !== 200) return issues;

    // --- ERRORS ---
    if (!page.hasAuthorInfo && page.wordCount > 500)
      issues.push({ type: 'NO_AUTHOR_INFO', severity: 'ERROR', dimension: d, message: 'No author information found on content page', suggestion: 'Add visible author name with credentials. Use rel="author" or schema.org Person markup.' });

    // --- WARNINGS ---

    // E-E-A-T signals
    if (!page.hasTrustSignals)
      issues.push({ type: 'WEAK_EEAT_SIGNALS', severity: 'WARNING', dimension: d, message: 'Page lacks E-E-A-T trust signals (testimonials, awards, certifications)', suggestion: 'Add testimonials, client logos, awards, or certifications to demonstrate authority.' });

    if (!page.hasOrgSchema)
      issues.push({ type: 'NO_ORGANIZATION_SCHEMA', severity: 'WARNING', dimension: d, message: 'No Organization/LocalBusiness schema markup found', suggestion: 'Add Organization JSON-LD with name, logo, URL, and sameAs social links.' });

    if (page.socialProfileCount === 0 && !page.hasSameAsLinks)
      issues.push({ type: 'MISSING_SOCIAL_PROFILES', severity: 'WARNING', dimension: d, message: 'No social media profile links found on page', suggestion: 'Link to your social profiles (LinkedIn, Twitter, etc.) to strengthen entity recognition.' });

    if (!page.hasSameAsLinks)
      issues.push({ type: 'MISSING_SAMEAS_LINKS', severity: 'WARNING', dimension: d, message: 'No sameAs links in schema (social profiles, Wikipedia, etc.)', suggestion: 'Add sameAs property to your Organization schema linking to social profiles and authority pages.' });

    if (!page.hasAuthorSchema && page.wordCount > 500)
      issues.push({ type: 'NO_AUTHOR_SCHEMA', severity: 'WARNING', dimension: d, message: 'Content page lacks Author/Person schema', suggestion: 'Add Person schema for the content author with name, credentials, and sameAs links.' });

    // Content for AI synthesis
    if (!page.hasCitations && page.wordCount > 300)
      issues.push({ type: 'NO_SOURCE_CITATIONS', severity: 'WARNING', dimension: d, message: 'Content does not cite external sources or references', suggestion: 'Reference authoritative sources with links. AI engines favor well-sourced content.' });

    if (page.wordCount > 300 && page.wordCount < 800)
      issues.push({ type: 'THIN_CONTENT_FOR_AI', severity: 'WARNING', dimension: d, message: `Page has ${page.wordCount} words — may be too thin for AI search to cite`, details: { wordCount: page.wordCount }, suggestion: 'AI search engines prefer comprehensive content (800+ words) that fully addresses the topic.' });

    // --- NOTICES ---
    if (!page.hasOriginalData && page.wordCount > 500)
      issues.push({ type: 'NO_ORIGINAL_DATA', severity: 'NOTICE', dimension: d, message: 'No original data, statistics, or research findings detected', suggestion: 'Include original data points, survey results, or unique statistics — AI engines prefer citing original sources.' });

    if (!page.hasContactInfo)
      issues.push({ type: 'NO_CREDENTIALS_VISIBLE', severity: 'NOTICE', dimension: d, message: 'No contact information (phone, email, address) detected', suggestion: 'Make contact info easily accessible to build trust signals for AI engines.' });

    return issues;
  }

  // ============================================================
  // AEO CHECKS (Answer Engine Optimization)
  // ============================================================
  private runAeoChecks(page: PageData): CrawlIssueData[] {
    const issues: CrawlIssueData[] = [];
    const d = 'AEO' as const;

    // Only check HTML pages with content
    if (page.statusCode !== 200) return issues;

    // --- ERRORS ---
    if (page.directAnswerCount === 0 && page.wordCount > 300)
      issues.push({ type: 'NO_DIRECT_ANSWERS', severity: 'ERROR', dimension: d, message: 'No concise answer paragraphs found after question headings', suggestion: 'Add 40-60 word answer paragraphs directly below question-phrased headings. This is critical for featured snippets.' });

    // --- WARNINGS ---
    if (page.questionHeadingsCount === 0 && page.wordCount > 300)
      issues.push({ type: 'NO_QUESTION_HEADINGS', severity: 'WARNING', dimension: d, message: 'No question-phrased headings (H2/H3) found', suggestion: 'Use headings like "How does X work?" or "What is Y?" — these trigger People Also Ask and featured snippets.' });

    if (!page.hasFaqSchema && page.questionHeadingsCount >= 2)
      issues.push({ type: 'NO_FAQ_SCHEMA', severity: 'WARNING', dimension: d, message: 'Page has question headings but no FAQPage schema', suggestion: 'Add FAQPage JSON-LD markup to make Q&A content eligible for rich FAQ results.' });

    if (!page.hasHowToSchema && /\b(how to|step[s]?\s+\d|step-by-step)\b/i.test(page.bodyText))
      issues.push({ type: 'NO_HOWTO_SCHEMA', severity: 'WARNING', dimension: d, message: 'Page has how-to content but no HowTo schema', suggestion: 'Add HowTo JSON-LD markup for step-by-step content to enable rich results.' });

    if (!page.hasSpeakableSchema && page.wordCount > 300)
      issues.push({ type: 'NO_SPEAKABLE_SCHEMA', severity: 'WARNING', dimension: d, message: 'No SpeakableSpecification schema for voice search', suggestion: 'Add speakable property to your schema to mark sections optimized for text-to-speech (voice assistants).' });

    if (!page.hasDefinitionPattern && page.wordCount > 300)
      issues.push({ type: 'NO_DEFINITION_PATTERN', severity: 'WARNING', dimension: d, message: 'No clear definition pattern ("X is..." or "X refers to...") found', suggestion: 'Define your core topic in a clear "X is..." sentence near the top. This helps capture definition featured snippets.' });

    if (!page.hasListContent && page.wordCount > 500)
      issues.push({ type: 'NO_LIST_CONTENT', severity: 'WARNING', dimension: d, message: 'No structured list content (numbered or bulleted lists)', suggestion: 'Add ordered/unordered lists for key points. List content is frequently shown as featured snippets.' });

    if (!page.hasTableContent && page.wordCount > 500)
      issues.push({ type: 'NO_TABLE_CONTENT', severity: 'WARNING', dimension: d, message: 'No comparison tables found', suggestion: 'Add data tables for comparisons — Google shows table featured snippets for comparison queries.' });

    // --- NOTICES ---
    if (page.questionHeadingsCount < 3 && page.wordCount > 500)
      issues.push({ type: 'LOW_QUESTION_COVERAGE', severity: 'NOTICE', dimension: d, message: `Only ${page.questionHeadingsCount} question heading(s) — more would improve PAA coverage`, suggestion: 'Add more who/what/when/where/why/how headings to address common user questions.' });

    return issues;
  }

  // ============================================================
  // CHECKLIST CHECKS (Technical SEO Audit Checklist - per page)
  // ============================================================
  private runChecklistChecks(page: PageData): CrawlIssueData[] {
    const issues: CrawlIssueData[] = [];
    const d = 'SEO' as const;
    if (page.statusCode !== 200) return issues;

    // Security headers, cache headers, and compression are server-level concerns
    // and are checked ONCE in SiteWideAuditService against the homepage. They
    // intentionally do NOT fire per-page here to avoid inflating issue counts
    // by N (where N = pages crawled).

    // ----- Performance / DOM -----
    if (page.domNodeCount > 1500) {
      issues.push({ type: 'EXCESSIVE_DOM_NODES', severity: 'WARNING', dimension: d, message: `Page has ${page.domNodeCount} DOM nodes (recommended: under 1,500)`, details: { nodeCount: page.domNodeCount }, suggestion: 'Simplify the DOM tree — too many nodes slow rendering.' });
    }
    if (page.imagesCount > 0 && page.imagesLazyLoaded === 0) {
      issues.push({ type: 'MISSING_LAZY_LOADING', severity: 'WARNING', dimension: d, message: 'No images use loading="lazy"', suggestion: 'Add loading="lazy" to below-the-fold images to defer their loading.' });
    }
    if (page.imagesWithoutDimensions > 0) {
      issues.push({ type: 'MISSING_IMG_DIMENSIONS', severity: 'WARNING', dimension: d, message: `${page.imagesWithoutDimensions} image(s) missing width/height attributes`, details: { count: page.imagesWithoutDimensions }, suggestion: 'Add explicit width and height to images to prevent CLS layout shifts.' });
    }
    if (page.imagesNonNextGen > 0) {
      issues.push({ type: 'MISSING_NEXT_GEN_IMAGE_FORMAT', severity: 'NOTICE', dimension: d, message: `${page.imagesNonNextGen} image(s) use legacy formats (jpg/png) instead of WebP/AVIF`, suggestion: 'Convert images to WebP or AVIF for smaller file sizes.' });
    }
    if (page.imagesPoorFilenames > 0) {
      issues.push({ type: 'IMAGE_FILENAME_NOT_DESCRIPTIVE', severity: 'NOTICE', dimension: d, message: `${page.imagesPoorFilenames} image(s) have non-descriptive filenames (e.g. IMG_1234.jpg)`, suggestion: 'Rename image files with descriptive, keyword-relevant names.' });
    }
    if (!page.hasPreconnectHints) {
      issues.push({ type: 'MISSING_PRECONNECT_HINTS', severity: 'NOTICE', dimension: d, message: 'No preconnect or dns-prefetch hints found', suggestion: 'Add <link rel="preconnect"> for third-party origins (fonts, analytics, etc.) used by the page.' });
    }
    // hasFontDisplaySwap is `true` for pages that don't use web fonts at all,
    // so this only fires when web fonts ARE used without a swap directive.
    if (!page.hasFontDisplaySwap) {
      issues.push({ type: 'MISSING_FONT_DISPLAY_SWAP', severity: 'NOTICE', dimension: d, message: 'Web fonts loaded without font-display: swap', suggestion: 'Add font-display: swap to @font-face rules (or &display=swap to Google Fonts URLs) so text renders while fonts load.' });
    }

    // ----- URL / architecture -----
    if (page.underscoresInUrl) {
      issues.push({ type: 'URL_USES_UNDERSCORES', severity: 'NOTICE', dimension: d, message: 'URL uses underscores instead of hyphens as word separators', details: { sourceSnippet: page.url }, suggestion: 'Use hyphens — Google treats hyphens as word separators but ignores underscores.' });
    }
    if (page.hasExcessUrlParams) {
      issues.push({ type: 'URL_HAS_EXCESS_PARAMS', severity: 'WARNING', dimension: d, message: 'URL has an unusually long query string', details: { sourceSnippet: page.url }, suggestion: 'Simplify URLs — use clean paths instead of long parameter strings.' });
    }
    if (page.headingHierarchyBroken) {
      issues.push({ type: 'HEADING_HIERARCHY_BROKEN', severity: 'WARNING', dimension: d, message: 'Heading hierarchy skips levels (e.g. H1 followed by H4)', details: { sourceSnippet: page.headingSequence || undefined }, suggestion: 'Use headings in order — H1 → H2 → H3 — without skipping levels.' });
    }

    // ----- Schema extras -----
    if (page.hasOgTags && page.ogImageDimensions) {
      const { width, height } = page.ogImageDimensions;
      if (width < 1200 || height < 630) {
        issues.push({ type: 'OG_IMAGE_TOO_SMALL', severity: 'WARNING', dimension: d, message: `og:image is ${width}x${height} (recommended: 1200x630 or larger)`, details: { width, height }, suggestion: 'Use an og:image of at least 1200x630px for proper social sharing previews.' });
      }
    }

    // ----- International SEO -----
    if (page.hreflangTags.length > 0) {
      const validBcp47 = /^([a-z]{2,3})(-[A-Z]{2,4})?$|^x-default$/i;
      const invalidCodes = page.hreflangTags.filter((t) => !validBcp47.test(t.hreflang));
      if (invalidCodes.length > 0) {
        issues.push({ type: 'HREFLANG_INVALID_CODE', severity: 'ERROR', dimension: d, message: `${invalidCodes.length} hreflang tag(s) use invalid BCP 47 codes`, details: { invalid: invalidCodes.map((t) => t.hreflang).slice(0, 5) }, suggestion: 'Use valid BCP 47 codes (e.g. "en-US", "es-MX", or "x-default").' });
      }
      const hasSelf = page.hreflangTags.some((t) => {
        try { return new URL(t.href).pathname === new URL(page.url).pathname; } catch { return false; }
      });
      if (!hasSelf) {
        issues.push({ type: 'HREFLANG_MISSING_SELF', severity: 'WARNING', dimension: d, message: 'Hreflang set does not include a self-referencing annotation', suggestion: 'Each hreflang group must list every locale, including the current page.' });
      }
      const hasXDefault = page.hreflangTags.some((t) => t.hreflang.toLowerCase() === 'x-default');
      if (!hasXDefault) {
        issues.push({ type: 'HREFLANG_MISSING_X_DEFAULT', severity: 'WARNING', dimension: d, message: 'Hreflang set does not include x-default', suggestion: 'Add a hreflang="x-default" entry pointing to your default-language page.' });
      }
    }

    // ----- Tracking / tags -----
    // Per-page GA/GTM check. Item #125 ("GA/GTM firing on every page") is a
    // cross-page consistency check — moved to a planned post-crawl analysis,
    // so we no longer emit GTM_TAG_MISSING here (the previous "ends with /"
    // filter was arbitrary and produced misleading per-page noise).
    if (!page.hasGoogleAnalytics && !page.hasGoogleTagManager) {
      issues.push({ type: 'GA_TRACKING_MISSING', severity: 'WARNING', dimension: d, message: 'No Google Analytics or GTM tags detected on the page', suggestion: 'Install GA4 or Tag Manager to measure traffic and conversions.' });
    }

    // ----- AMP -----
    if (page.isAmpPage && page.ampHtml) {
      const html = page.ampHtml;
      const hasAmpScript = /<script[^>]+src=["'][^"']*cdn\.ampproject\.org/i.test(html);
      const hasCanonical = !!page.canonicalUrl;
      if (!hasAmpScript || !hasCanonical) {
        issues.push({ type: 'AMP_INVALID', severity: 'WARNING', dimension: d, message: 'AMP page is missing required boilerplate (AMP script or canonical link)', suggestion: 'Validate AMP pages with the AMP validator and ensure each has a canonical link.' });
      }
    }

    // ----- Breadcrumbs -----
    if (!page.hasBreadcrumbs) {
      issues.push({ type: 'MISSING_BREADCRUMBS', severity: 'NOTICE', dimension: d, message: 'No breadcrumb navigation detected on this page', suggestion: 'Add breadcrumb navigation (with aria-label="breadcrumb") to help users and crawlers understand site hierarchy.' });
    }
    if (page.hasBreadcrumbs && !page.hasBreadcrumbSchema) {
      issues.push({ type: 'MISSING_BREADCRUMB_SCHEMA', severity: 'WARNING', dimension: d, message: 'Breadcrumb navigation present but no BreadcrumbList JSON-LD schema', suggestion: 'Add BreadcrumbList structured data so Google can show the breadcrumb in search results.' });
    }

    // ----- Sensitive data -----
    if (page.sensitiveDataExposed.length > 0) {
      issues.push({
        type: 'SENSITIVE_DATA_EXPOSED',
        severity: 'ERROR',
        dimension: d,
        message: `Possible sensitive data found in HTML source: ${page.sensitiveDataExposed.join(', ')}`,
        details: { matches: page.sensitiveDataExposed },
        suggestion: 'Remove API keys, secrets, and private keys from public HTML. Rotate any leaked credentials immediately.',
      });
    }

    // ----- Page depth -----
    if (page.depth > 3) {
      issues.push({
        type: 'PAGE_TOO_DEEP',
        severity: 'WARNING',
        dimension: d,
        message: `Page is ${page.depth} clicks from the homepage (recommended: max 3)`,
        details: { depth: page.depth },
        suggestion: 'Restructure internal linking so important pages are within 3 clicks of the homepage.',
      });
    }

    return issues;
  }

  // ============================================================
  // DIMENSION SCORING (1-10 scale per SKILL.md rubric)
  // ============================================================
  private async calculateDimensionScores(crawlJobId: string, pagesCrawled: number): Promise<{ seo: number; geo: number; aeo: number }> {
    if (pagesCrawled === 0) return { seo: 0, geo: 0, aeo: 0 };

    const issueCounts = await this.prisma.crawlIssue.groupBy({
      by: ['dimension', 'severity'],
      where: { crawlPage: { crawlJobId } },
      _count: { id: true },
    });

    const countMap: Record<string, { errors: number; warnings: number; notices: number }> = {
      SEO: { errors: 0, warnings: 0, notices: 0 },
      GEO: { errors: 0, warnings: 0, notices: 0 },
      AEO: { errors: 0, warnings: 0, notices: 0 },
    };

    for (const row of issueCounts) {
      const dim = row.dimension || 'SEO';
      if (!countMap[dim]) countMap[dim] = { errors: 0, warnings: 0, notices: 0 };
      if (row.severity === 'ERROR') countMap[dim].errors += row._count.id;
      else if (row.severity === 'WARNING') countMap[dim].warnings += row._count.id;
      else countMap[dim].notices += row._count.id;
    }

    // Score formula: start at 10, deduct based on issue density per page
    // Errors: -0.5 per error per page, Warnings: -0.2, Notices: -0.05
    const calcScore = (counts: { errors: number; warnings: number; notices: number }) => {
      const deduction =
        (counts.errors / pagesCrawled) * 3 +
        (counts.warnings / pagesCrawled) * 1 +
        (counts.notices / pagesCrawled) * 0.2;
      return Math.max(1, Math.min(10, Math.round(10 - deduction)));
    };

    return {
      seo: calcScore(countMap.SEO),
      geo: calcScore(countMap.GEO),
      aeo: calcScore(countMap.AEO),
    };
  }

  /**
   * Post-crawl checks that require cross-page comparison:
   * - Duplicate titles
   * - Duplicate meta descriptions
   * - Orphan pages (no internal links pointing to them)
   */
  private async runPostCrawlChecks(
    crawlJobId: string,
    inboundLinks: Map<string, Set<string>>,
    homepageUrl: string,
  ): Promise<{ errors: number; warnings: number; notices: number }> {
    let errors = 0;
    let warnings = 0;
    let notices = 0;

    const pages = await this.prisma.crawlPage.findMany({
      where: { crawlJobId, statusCode: 200 },
      select: { id: true, url: true, title: true, metaDescription: true, internalLinksCount: true, canonicalUrl: true },
    });

    // --- Duplicate titles ---
    const titleMap = new Map<string, { id: string; url: string }[]>();
    for (const page of pages) {
      if (page.title && page.title.trim()) {
        const key = page.title.trim().toLowerCase();
        if (!titleMap.has(key)) titleMap.set(key, []);
        titleMap.get(key)!.push({ id: page.id, url: page.url });
      }
    }

    const dupTitleIssues: { crawlPageId: string; type: string; severity: string; message: string; details?: any; suggestion?: string }[] = [];
    for (const [title, dupes] of titleMap) {
      if (dupes.length > 1) {
        for (const dupe of dupes) {
          dupTitleIssues.push({
            crawlPageId: dupe.id,
            type: 'DUPLICATE_TITLE',
            severity: 'WARNING',
            message: `Title "${title}" is shared with ${dupes.length - 1} other page(s)`,
            details: { duplicateUrls: dupes.filter((d) => d.id !== dupe.id).map((d) => d.url) },
            suggestion: 'Each page should have a unique title tag that accurately describes its content.',
          });
          warnings++;
        }
      }
    }

    // --- Duplicate meta descriptions ---
    const descMap = new Map<string, { id: string; url: string }[]>();
    for (const page of pages) {
      if (page.metaDescription && page.metaDescription.trim()) {
        const key = page.metaDescription.trim().toLowerCase();
        if (!descMap.has(key)) descMap.set(key, []);
        descMap.get(key)!.push({ id: page.id, url: page.url });
      }
    }

    const dupDescIssues: typeof dupTitleIssues = [];
    for (const [desc, dupes] of descMap) {
      if (dupes.length > 1) {
        for (const dupe of dupes) {
          dupDescIssues.push({
            crawlPageId: dupe.id,
            type: 'DUPLICATE_META_DESCRIPTION',
            severity: 'WARNING',
            message: `Meta description is shared with ${dupes.length - 1} other page(s)`,
            details: { duplicateUrls: dupes.filter((d) => d.id !== dupe.id).map((d) => d.url), description: desc.substring(0, 100) },
            suggestion: 'Each page should have a unique meta description tailored to its content.',
          });
          warnings++;
        }
      }
    }

    // --- Orphan pages (#14, #27) ---
    // A page is an orphan when no OTHER crawled page links to it. The homepage
    // is excluded since it's the entry point and naturally has no inbound
    // internal links from above.
    const orphanIssues: typeof dupTitleIssues = [];
    for (const page of pages) {
      if (page.url === homepageUrl) continue;
      const inbound = inboundLinks.get(page.url);
      const inboundFromOthers = inbound ? new Set([...inbound].filter((u) => u !== page.url)) : null;
      if (!inboundFromOthers || inboundFromOthers.size === 0) {
        orphanIssues.push({
          crawlPageId: page.id,
          type: 'ORPHAN_PAGE',
          severity: 'WARNING',
          message: 'Page has zero internal links pointing to it from other crawled pages',
          suggestion: 'Add internal links from related pages so this URL is discoverable through navigation.',
        });
        warnings++;
      }
    }

    // --- Canonical conflicts (#18, #19) ---
    // Group pages by their canonical URL. When multiple pages canonicalize to
    // a target that is NOT itself in the group (i.e. they all point to a
    // single different URL), that's a strong signal of a misconfigured
    // template — emit CANONICAL_CONFLICT for each affected page.
    const canonicalGroups = new Map<string, { id: string; url: string }[]>();
    for (const page of pages) {
      if (!page.canonicalUrl) continue;
      const canonical = this.normalizeUrl(page.canonicalUrl, page.url);
      if (!canonical) continue;
      // Skip self-canonical (the healthy default)
      if (canonical === this.normalizeUrl(page.url, page.url)) continue;
      if (!canonicalGroups.has(canonical)) canonicalGroups.set(canonical, []);
      canonicalGroups.get(canonical)!.push({ id: page.id, url: page.url });
    }

    const canonicalIssues: typeof dupTitleIssues = [];
    for (const [target, group] of canonicalGroups) {
      if (group.length >= 3) {
        // Three or more pages canonicalising to the same external target — likely a bug.
        for (const member of group) {
          canonicalIssues.push({
            crawlPageId: member.id,
            type: 'CANONICAL_CONFLICT',
            severity: 'ERROR',
            message: `Page canonical points to ${target}, shared by ${group.length} other page(s)`,
            details: {
              canonicalTarget: target,
              groupSize: group.length,
              sampleSiblings: group.filter((g) => g.id !== member.id).slice(0, 3).map((g) => g.url),
            },
            suggestion: 'Verify that each page should canonicalise to this target. Most pages should self-reference.',
          });
          errors++;
        }
      }
    }

    // --- Trailing slash inconsistency (#122) ---
    // If two crawled URLs differ only by a trailing slash (e.g. /about and
    // /about/), the site is serving the same content under two URLs — pick
    // one and 301-redirect the other.
    const slashGroups = new Map<string, { id: string; url: string }[]>();
    for (const page of pages) {
      try {
        const u = new URL(page.url);
        const stripped = (u.origin + u.pathname.replace(/\/+$/, '') + u.search).toLowerCase();
        if (!slashGroups.has(stripped)) slashGroups.set(stripped, []);
        slashGroups.get(stripped)!.push({ id: page.id, url: page.url });
      } catch { /* ignore */ }
    }

    const slashIssues: typeof dupTitleIssues = [];
    for (const [, members] of slashGroups) {
      if (members.length < 2) continue;
      const hasSlash = members.some((m) => /\/(?:\?|$)/.test(m.url));
      const hasNoSlash = members.some((m) => !/\/(?:\?|$)/.test(m.url));
      if (!(hasSlash && hasNoSlash)) continue;
      for (const member of members) {
        slashIssues.push({
          crawlPageId: member.id,
          type: 'TRAILING_SLASH_INCONSISTENT',
          severity: 'WARNING',
          message: `Both with and without trailing slash variants of this URL are accessible`,
          details: { variants: members.map((m) => m.url) },
          suggestion: 'Pick one form (with or without trailing slash) and 301-redirect the other to it.',
        });
        warnings++;
      }
    }

    // Batch insert all post-crawl issues
    const allPostCrawlIssues = [
      ...dupTitleIssues,
      ...dupDescIssues,
      ...orphanIssues,
      ...canonicalIssues,
      ...slashIssues,
    ];
    if (allPostCrawlIssues.length > 0) {
      await this.prisma.crawlIssue.createMany({
        data: allPostCrawlIssues.map((issue) => ({
          crawlPageId: issue.crawlPageId,
          type: issue.type as any,
          severity: issue.severity as any,
          message: issue.message,
          details: issue.details || undefined,
          suggestion: issue.suggestion || undefined,
        })),
      });
    }

    return { errors, warnings, notices };
  }

  private normalizeUrl(url: string, baseUrl: string): string {
    try {
      const resolved = new URL(url, baseUrl);

      // Skip non-http schemes
      if (!resolved.protocol.startsWith('http')) return '';

      // Remove fragment
      resolved.hash = '';

      // Normalize hostname: strip www. prefix
      if (resolved.hostname.startsWith('www.')) {
        resolved.hostname = resolved.hostname.substring(4);
      }

      // Remove tracking params (utm_*, fbclid, gclid, etc.)
      const TRACKING_PARAMS = new Set([
        'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
        'dclid', 'yclid', '_ga', '_gl', '_hsenc', '_hsmi',
        'ref', 'source', 'campaign_id', 'ad_id',
      ]);
      const params = resolved.searchParams;
      const keysToDelete: string[] = [];
      params.forEach((_, key) => {
        if (key.startsWith('utm_') || TRACKING_PARAMS.has(key)) keysToDelete.push(key);
      });
      keysToDelete.forEach((key) => params.delete(key));

      // Lowercase
      let normalized = resolved.toString().toLowerCase();

      // Remove trailing slash (but keep root /)
      if (normalized.endsWith('/') && resolved.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }

      return normalized;
    } catch {
      return '';
    }
  }

  private resolveUrl(href: string, baseUrl: string): string | null {
    try {
      // Skip javascript:, mailto:, tel: schemes
      const trimmed = href.trim();
      if (
        trimmed.startsWith('javascript:') ||
        trimmed.startsWith('mailto:') ||
        trimmed.startsWith('tel:') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('data:')
      ) {
        return null;
      }

      const resolved = new URL(trimmed, baseUrl);
      if (!resolved.protocol.startsWith('http')) return null;

      return resolved.toString();
    } catch {
      return null;
    }
  }

  private isSameDomain(url: string, domain: string): boolean {
    try {
      const parsed = new URL(url);
      const urlHost = parsed.hostname.toLowerCase();
      const targetDomain = domain.toLowerCase();
      return urlHost === targetDomain || urlHost === `www.${targetDomain}` || `www.${urlHost}` === targetDomain;
    } catch {
      return false;
    }
  }

  private shouldSkipUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.toLowerCase();
      return SKIP_EXTENSIONS.some((ext) => pathname.endsWith(ext));
    } catch {
      return true;
    }
  }
}
