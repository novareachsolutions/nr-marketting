import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

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

  constructor(private readonly prisma: PrismaService) {}

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
      const queue: string[] = [this.normalizeUrl(startUrl, startUrl)];
      let totalErrors = 0;
      let totalWarnings = 0;
      let totalNotices = 0;
      let pagesCrawled = 0;

      // Semaphore for concurrency control
      const concurrency = 5;
      // concurrency managed by batch processing below

      const processUrl = async (url: string): Promise<void> => {
        // Re-check job status for cancellation
        const currentJob = await this.prisma.crawlJob.findUnique({
          where: { id: crawlJobId },
          select: { status: true },
        });
        if (currentJob?.status === 'CANCELLED') return;

        try {
          const pageData = await this.fetchAndParsePage(httpClient, url, domain);
          const seoIssues = this.runSeoChecks(pageData);
          const geoIssues = this.runGeoChecks(pageData);
          const aeoIssues = this.runAeoChecks(pageData);
          const issues = [...seoIssues, ...geoIssues, ...aeoIssues];

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

          // Add internal links to queue
          for (const link of pageData.internalLinks) {
            const normalized = this.normalizeUrl(link, url);
            if (
              normalized &&
              !visited.has(normalized) &&
              this.isSameDomain(normalized, domain) &&
              !this.isBlockedByRobots(normalized, robotsRules) &&
              !this.shouldSkipUrl(normalized)
            ) {
              visited.add(normalized);
              queue.push(normalized);
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
        } catch (err) {
          this.logger.warn(`Failed to crawl ${url}: ${err}`);
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
        await Promise.all(batch.map((url) => processUrl(url)));
      }

      // ---- Post-crawl cross-page checks ----
      const postCrawlResult = await this.runPostCrawlChecks(crawlJobId);
      totalWarnings += postCrawlResult.warnings;
      totalNotices += postCrawlResult.notices;

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
    };

    // Only parse HTML
    if (!contentType.includes('text/html')) return pageData;

    const $ = cheerio.load(html);

    // ===================== SEO SIGNALS =====================

    // Title
    const titleEl = $('title');
    pageData.title = titleEl.length > 0 ? titleEl.first().text().trim() : null;

    // Meta description
    const metaDesc = $('meta[name="description"]').attr('content');
    pageData.metaDescription = metaDesc ? metaDesc.trim() : null;

    // H1
    const h1Elements = $('h1');
    pageData.h1Count = h1Elements.length;
    pageData.h1 = h1Elements.length > 0 ? h1Elements.first().text().trim() : null;

    // Word count (body text)
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    pageData.wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
    pageData.bodyText = bodyText;

    // Canonical
    const canonical = $('link[rel="canonical"]').attr('href');
    pageData.canonicalUrl = canonical ? canonical.trim() : null;

    // Meta robots
    const metaRobots = $('meta[name="robots"]').attr('content') || '';
    pageData.hasRobotsNoindex = metaRobots.toLowerCase().includes('noindex');
    pageData.hasRobotsNofollow = metaRobots.toLowerCase().includes('nofollow');

    // Viewport
    pageData.hasViewport = $('meta[name="viewport"]').length > 0;

    // Lang attribute
    const langAttr = $('html').attr('lang');
    pageData.hasLangAttr = !!langAttr && langAttr.trim().length > 0;

    // Open Graph
    pageData.hasOgTags =
      $('meta[property="og:title"]').length > 0 &&
      $('meta[property="og:description"]').length > 0;
    pageData.hasOgImage = $('meta[property="og:image"]').length > 0;

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
      let hasMixed = false;
      $('img[src], script[src], link[href], iframe[src]').each((_: number, el: any) => {
        const src = $(el).attr('src') || $(el).attr('href') || '';
        if (src.startsWith('http://')) hasMixed = true;
      });
      pageData.hasMixedContent = hasMixed;
    }

    // Images
    const images = $('img');
    pageData.imagesCount = images.length;
    let imagesWithoutAlt = 0;
    images.each((_, el) => {
      const alt = $(el).attr('alt');
      if (alt === undefined || alt === null || alt.trim() === '') imagesWithoutAlt++;
    });
    pageData.imagesWithoutAlt = imagesWithoutAlt;

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

    return pageData;
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
      issues.push({ type: 'MISSING_TITLE', severity: 'ERROR', dimension: d, message: 'Page is missing a title tag', suggestion: 'Add a unique, descriptive <title> tag between 30-60 characters.' });

    if (!page.h1 || page.h1.trim() === '')
      issues.push({ type: 'MISSING_H1', severity: 'ERROR', dimension: d, message: 'Page is missing an H1 heading', suggestion: 'Add a single, descriptive <h1> heading that includes your primary keyword.' });

    if (page.hasRobotsNoindex)
      issues.push({ type: 'HAS_NOINDEX', severity: 'ERROR', dimension: d, message: 'Page has a noindex meta robots tag', suggestion: 'Remove the noindex directive if you want this page to appear in search results.' });

    if (page.redirectCount >= 3)
      issues.push({ type: 'REDIRECT_CHAIN', severity: 'ERROR', dimension: d, message: `Page has a redirect chain of ${page.redirectCount} hops`, details: { redirectCount: page.redirectCount }, suggestion: 'Reduce redirect chains to a single redirect.' });

    if (page.hasMixedContent)
      issues.push({ type: 'MIXED_CONTENT', severity: 'ERROR', dimension: d, message: 'Page loads HTTP resources on an HTTPS page (mixed content)', suggestion: 'Update all resource URLs to use HTTPS.' });

    // --- WARNINGS ---
    if (!page.metaDescription || page.metaDescription.trim() === '')
      issues.push({ type: 'MISSING_META_DESCRIPTION', severity: 'WARNING', dimension: d, message: 'Page is missing a meta description', suggestion: 'Add a compelling meta description between 120-160 characters.' });

    if (page.imagesWithoutAlt > 0)
      issues.push({ type: 'IMAGE_MISSING_ALT', severity: 'WARNING', dimension: d, message: `${page.imagesWithoutAlt} image(s) missing alt attribute`, details: { count: page.imagesWithoutAlt }, suggestion: 'Add descriptive alt text to all images.' });

    if (page.loadTimeMs !== null && page.loadTimeMs > 5000)
      issues.push({ type: 'SLOW_PAGE', severity: 'WARNING', dimension: d, message: `Page load time is ${page.loadTimeMs}ms (over 5s)`, details: { loadTimeMs: page.loadTimeMs }, suggestion: 'Optimize page speed by compressing images, minifying resources, and using caching.' });

    if (page.h1Count > 1)
      issues.push({ type: 'MULTIPLE_H1', severity: 'WARNING', dimension: d, message: `Page has ${page.h1Count} H1 tags (should have 1)`, suggestion: 'Use only one <h1> tag per page.' });

    if (!page.canonicalUrl)
      issues.push({ type: 'MISSING_CANONICAL', severity: 'WARNING', dimension: d, message: 'Page is missing a canonical URL tag', suggestion: 'Add a <link rel="canonical"> tag to prevent duplicate content.' });

    if (!page.hasViewport)
      issues.push({ type: 'MISSING_VIEWPORT', severity: 'WARNING', dimension: d, message: 'Page is missing a viewport meta tag', suggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.' });

    if (!page.hasLangAttr)
      issues.push({ type: 'MISSING_LANG', severity: 'WARNING', dimension: d, message: 'HTML tag is missing a lang attribute', suggestion: 'Add lang="en" (or appropriate language) to the <html> tag.' });

    if (!page.hasOgTags)
      issues.push({ type: 'MISSING_OG_TAGS', severity: 'WARNING', dimension: d, message: 'Page is missing Open Graph meta tags (og:title, og:description)', suggestion: 'Add OG tags for better social media sharing previews.' });

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
      issues.push({ type: 'TITLE_TOO_LONG', severity: 'NOTICE', dimension: d, message: `Title is ${page.title.length} chars (max: 60)`, details: { length: page.title.length, title: page.title }, suggestion: 'Shorten the title to under 60 characters.' });

    if (page.title && page.title.trim() !== '' && page.title.length < 30)
      issues.push({ type: 'TITLE_TOO_SHORT', severity: 'NOTICE', dimension: d, message: `Title is ${page.title.length} chars (min: 30)`, suggestion: 'Expand the title to at least 30 characters.' });

    if (page.metaDescription && page.metaDescription.length > 160)
      issues.push({ type: 'META_DESCRIPTION_TOO_LONG', severity: 'NOTICE', dimension: d, message: `Meta description is ${page.metaDescription.length} chars (max: 160)`, suggestion: 'Shorten to under 160 characters.' });

    if (page.metaDescription && page.metaDescription.trim() !== '' && page.metaDescription.length < 120)
      issues.push({ type: 'META_DESCRIPTION_TOO_SHORT', severity: 'NOTICE', dimension: d, message: `Meta description is ${page.metaDescription.length} chars (min: 120)`, suggestion: 'Expand to at least 120 characters.' });

    if (page.wordCount < 300)
      issues.push({ type: 'LOW_WORD_COUNT', severity: 'NOTICE', dimension: d, message: `Page has only ${page.wordCount} words (min: 300)`, suggestion: 'Add more quality content. Thin content ranks poorly.' });

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
  private async runPostCrawlChecks(crawlJobId: string): Promise<{ warnings: number; notices: number }> {
    let warnings = 0;
    let notices = 0;

    const pages = await this.prisma.crawlPage.findMany({
      where: { crawlJobId, statusCode: 200 },
      select: { id: true, url: true, title: true, metaDescription: true, internalLinksCount: true },
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

    // Batch insert all post-crawl issues
    const allPostCrawlIssues = [...dupTitleIssues, ...dupDescIssues];
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

    return { warnings, notices };
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
