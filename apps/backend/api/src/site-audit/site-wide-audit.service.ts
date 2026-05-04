import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios, { AxiosInstance } from 'axios';
import * as tls from 'tls';

/**
 * Issue records emitted by the site-wide checks.
 * These are stored against a single "site-wide" CrawlPage record (the homepage)
 * so they fit the existing CrawlPage → CrawlIssue relation cleanly.
 */
interface SiteWideIssue {
  type: string;
  severity: 'ERROR' | 'WARNING' | 'NOTICE';
  message: string;
  details?: Record<string, unknown>;
  suggestion?: string;
}

interface RobotsTxtAnalysis {
  exists: boolean;
  syntaxValid: boolean;
  blocksAssets: boolean;
  blocksImportant: boolean;
  hasSitemapDirective: boolean;
  sitemapUrls: string[];
  raw: string;
  syntaxErrors: string[];
}

interface SitemapAnalysis {
  exists: boolean;
  validXml: boolean;
  url: string | null;
  urls: string[];
  raw: string;
}

@Injectable()
export class SiteWideAuditService {
  private readonly logger = new Logger(SiteWideAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run all once-per-crawl checks for a domain and persist the resulting issues
   * against a synthetic CrawlPage representing the site root.
   * Returns the issue counts so the orchestrator can roll them into job totals.
   */
  async runSiteWideChecks(
    crawlJobId: string,
    domain: string,
  ): Promise<{ errors: number; warnings: number; notices: number }> {
    const httpClient = this.makeHttpClient();
    const issues: SiteWideIssue[] = [];

    const [robots, sitemap] = await Promise.all([
      this.analyzeRobotsTxt(httpClient, domain),
      this.findAndAnalyzeSitemap(httpClient, domain),
    ]);

    issues.push(...this.checkRobotsTxt(robots));
    issues.push(...this.checkSitemap(sitemap, robots));
    issues.push(...this.checkSitemapVsCanonical(sitemap, await this.fetchCanonicals(crawlJobId)));

    const [redirectIssues, faviconIssue, certIssues, custom404Issue] = await Promise.all([
      this.checkProtocolAndHostRedirects(httpClient, domain),
      this.checkFavicon(httpClient, domain),
      this.checkSslCertificate(domain),
      this.checkCustom404(httpClient, domain),
    ]);

    issues.push(...redirectIssues);
    if (faviconIssue) issues.push(faviconIssue);
    issues.push(...certIssues);
    if (custom404Issue) issues.push(custom404Issue);

    if (issues.length === 0) {
      return { errors: 0, warnings: 0, notices: 0 };
    }

    // Anchor site-wide issues to a synthetic page record so the existing
    // CrawlPage → CrawlIssue relation handles them without schema changes.
    const sitePage = await this.prisma.crawlPage.create({
      data: {
        crawlJobId,
        url: `https://${domain}/__site-wide__`,
        statusCode: 200,
      },
    });

    await this.prisma.crawlIssue.createMany({
      data: issues.map((issue) => ({
        crawlPageId: sitePage.id,
        type: issue.type as any,
        severity: issue.severity as any,
        dimension: 'SEO' as any,
        message: issue.message,
        details: (issue.details as any) || undefined,
        suggestion: issue.suggestion || undefined,
      })),
    });

    return this.countBySeverity(issues);
  }

  // ---------------------------------------------------------------- robots.txt

  private async analyzeRobotsTxt(
    http: AxiosInstance,
    domain: string,
  ): Promise<RobotsTxtAnalysis> {
    const url = `https://${domain}/robots.txt`;
    const empty: RobotsTxtAnalysis = {
      exists: false,
      syntaxValid: true,
      blocksAssets: false,
      blocksImportant: false,
      hasSitemapDirective: false,
      sitemapUrls: [],
      raw: '',
      syntaxErrors: [],
    };

    try {
      const res = await http.get(url);
      if (res.status !== 200 || typeof res.data !== 'string') return empty;

      const raw = res.data;
      const syntaxErrors: string[] = [];
      const sitemapUrls: string[] = [];
      const validDirective =
        /^(User-agent|Disallow|Allow|Sitemap|Crawl-delay|Host|Clean-param|Comment)\s*:/i;

      let starAgent = false;
      let blocksAssets = false;
      let blocksImportant = false;
      const importantPatterns = ['/', '/index', '/blog', '/products', '/services', '/about', '/contact'];
      const assetPatterns = ['.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.webp', '/assets/', '/static/', '/css/', '/js/'];

      const lines = raw.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;
        if (!validDirective.test(line)) {
          syntaxErrors.push(`Line ${i + 1}: invalid directive "${line.slice(0, 60)}"`);
          continue;
        }

        const [directive, ...valueParts] = line.split(':');
        const dir = directive.trim().toLowerCase();
        const value = valueParts.join(':').trim();

        if (dir === 'user-agent') {
          starAgent = value === '*';
        } else if (dir === 'sitemap' && value) {
          sitemapUrls.push(value);
        } else if (dir === 'disallow' && starAgent && value) {
          if (value === '/') {
            blocksImportant = true;
          } else if (importantPatterns.some((p) => value === p || value.startsWith(p + '/'))) {
            blocksImportant = true;
          }
          if (assetPatterns.some((p) => value.includes(p))) {
            blocksAssets = true;
          }
        }
      }

      return {
        exists: true,
        syntaxValid: syntaxErrors.length === 0,
        blocksAssets,
        blocksImportant,
        hasSitemapDirective: sitemapUrls.length > 0,
        sitemapUrls,
        raw,
        syntaxErrors,
      };
    } catch {
      return empty;
    }
  }

  private checkRobotsTxt(r: RobotsTxtAnalysis): SiteWideIssue[] {
    const issues: SiteWideIssue[] = [];

    if (!r.exists) {
      issues.push({
        type: 'ROBOTS_TXT_MISSING',
        severity: 'ERROR',
        message: 'robots.txt file is not present at /robots.txt',
        suggestion: 'Add a robots.txt file at the site root to control crawler access.',
      });
      return issues; // No further checks possible without the file.
    }

    if (!r.syntaxValid) {
      issues.push({
        type: 'ROBOTS_TXT_SYNTAX_ERROR',
        severity: 'ERROR',
        message: `robots.txt has ${r.syntaxErrors.length} syntax error(s)`,
        details: { errors: r.syntaxErrors.slice(0, 5) },
        suggestion: 'Each rule must be "Field: value" — fix invalid lines so crawlers parse the file correctly.',
      });
    }

    if (r.blocksImportant) {
      issues.push({
        type: 'ROBOTS_TXT_BLOCKS_IMPORTANT',
        severity: 'ERROR',
        message: 'robots.txt blocks important pages from crawlers',
        suggestion: 'Remove Disallow directives that target your homepage, blog, products, or other key URLs.',
      });
    }

    if (r.blocksAssets) {
      issues.push({
        type: 'ROBOTS_TXT_BLOCKS_ASSETS',
        severity: 'ERROR',
        message: 'robots.txt blocks CSS, JS, or image resources',
        suggestion: 'Allow Googlebot to load CSS/JS/images so it can render your pages correctly.',
      });
    }

    if (!r.hasSitemapDirective) {
      issues.push({
        type: 'ROBOTS_TXT_NO_SITEMAP_REF',
        severity: 'WARNING',
        message: 'robots.txt does not reference a sitemap',
        suggestion: 'Add a "Sitemap: https://yourdomain.com/sitemap.xml" line to robots.txt.',
      });
    }

    return issues;
  }

  // --------------------------------------------------------------- sitemap.xml

  private async findAndAnalyzeSitemap(
    http: AxiosInstance,
    domain: string,
  ): Promise<SitemapAnalysis> {
    const candidates = [
      `https://${domain}/sitemap.xml`,
      `https://${domain}/sitemap_index.xml`,
      `https://${domain}/wp-sitemap.xml`,
    ];

    for (const url of candidates) {
      try {
        const res = await http.get(url);
        if (res.status !== 200 || typeof res.data !== 'string') continue;
        const raw = res.data;
        const validXml = /<\?xml[^>]+\?>/i.test(raw) && (/<urlset[\s>]/i.test(raw) || /<sitemapindex[\s>]/i.test(raw));
        const urls = Array.from(raw.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)).map((m) => m[1].trim());
        return { exists: true, validXml, url, urls, raw };
      } catch { /* try next */ }
    }

    return { exists: false, validXml: false, url: null, urls: [], raw: '' };
  }

  private checkSitemap(s: SitemapAnalysis, robots: RobotsTxtAnalysis): SiteWideIssue[] {
    const issues: SiteWideIssue[] = [];

    if (!s.exists) {
      issues.push({
        type: 'SITEMAP_MISSING',
        severity: 'ERROR',
        message: 'No sitemap.xml found at the standard locations',
        suggestion: 'Generate a sitemap.xml at /sitemap.xml or reference it from robots.txt.',
      });
      return issues;
    }

    if (!s.validXml) {
      issues.push({
        type: 'SITEMAP_INVALID_XML',
        severity: 'ERROR',
        message: 'Sitemap response is not valid XML',
        details: { url: s.url },
        suggestion: 'Validate your sitemap with the sitemaps.org schema and fix XML errors.',
      });
    }

    // Sitemap referenced in robots.txt? — (already partially covered by robots check;
    // this one fires only when sitemap exists but robots doesn't reference it)
    if (s.exists && robots.exists && !robots.hasSitemapDirective) {
      // duplicate of ROBOTS_TXT_NO_SITEMAP_REF; skip to avoid double-counting.
    }

    return issues;
  }

  private async fetchCanonicals(crawlJobId: string): Promise<Map<string, string | null>> {
    const pages = await this.prisma.crawlPage.findMany({
      where: { crawlJobId },
      select: { url: true, canonicalUrl: true },
    });
    return new Map(pages.map((p) => [this.canonicalize(p.url), p.canonicalUrl ? this.canonicalize(p.canonicalUrl) : null]));
  }

  private checkSitemapVsCanonical(
    s: SitemapAnalysis,
    canonicalsByUrl: Map<string, string | null>,
  ): SiteWideIssue[] {
    if (!s.exists || s.urls.length === 0) return [];

    const mismatches: { sitemapUrl: string; canonical: string }[] = [];
    for (const sitemapUrl of s.urls) {
      const key = this.canonicalize(sitemapUrl);
      const canonical = canonicalsByUrl.get(key);
      if (canonical && canonical !== key) {
        mismatches.push({ sitemapUrl, canonical });
        if (mismatches.length >= 10) break;
      }
    }

    if (mismatches.length === 0) return [];
    return [
      {
        type: 'SITEMAP_CANONICAL_MISMATCH',
        severity: 'ERROR',
        message: `${mismatches.length} sitemap URL(s) do not match the page canonical`,
        details: { samples: mismatches.slice(0, 5) },
        suggestion: 'Make sure each URL in sitemap.xml is the canonical version of the page.',
      },
    ];
  }

  // ------------------------------------------------------- redirects + favicon

  private async checkProtocolAndHostRedirects(
    http: AxiosInstance,
    domain: string,
  ): Promise<SiteWideIssue[]> {
    const issues: SiteWideIssue[] = [];

    // HTTP → HTTPS redirect
    try {
      const res = await http.get(`http://${domain}/`, { maxRedirects: 0 });
      const location = (res.headers as any)?.location || '';
      const status = res.status;
      const redirectedToHttps =
        (status === 301 || status === 308) && /^https:\/\//i.test(location);
      if (!redirectedToHttps) {
        issues.push({
          type: 'HTTP_NOT_REDIRECTING_TO_HTTPS',
          severity: 'ERROR',
          message: 'HTTP version of the site does not 301-redirect to HTTPS',
          details: { status, location },
          suggestion: 'Add a server-level 301 redirect from http:// to https:// for SEO and security.',
        });
      }
    } catch {
      // network failure on http:// usually means it's just not configured, treat as missing redirect
      issues.push({
        type: 'HTTP_NOT_REDIRECTING_TO_HTTPS',
        severity: 'ERROR',
        message: 'HTTP version of the site is unreachable or not redirecting to HTTPS',
        suggestion: 'Configure HTTP → HTTPS 301 redirects at the server level.',
      });
    }

    // www <-> non-www consistency
    try {
      const wwwUrl = `https://www.${domain.replace(/^www\./, '')}/`;
      const nonWwwUrl = `https://${domain.replace(/^www\./, '')}/`;
      const [wwwRes, nonWwwRes] = await Promise.all([
        http.get(wwwUrl, { maxRedirects: 0 }).catch(() => null),
        http.get(nonWwwUrl, { maxRedirects: 0 }).catch(() => null),
      ]);

      const wwwIs200 = wwwRes?.status === 200;
      const nonWwwIs200 = nonWwwRes?.status === 200;

      if (wwwIs200 && nonWwwIs200) {
        issues.push({
          type: 'WWW_REDIRECT_INCONSISTENT',
          severity: 'ERROR',
          message: 'Both www and non-www versions return 200 — pick one canonical host',
          suggestion: 'Configure the non-canonical host to 301-redirect to the canonical one.',
        });
      }
    } catch { /* ignore */ }

    return issues;
  }

  private async checkFavicon(http: AxiosInstance, domain: string): Promise<SiteWideIssue | null> {
    try {
      const res = await http.get(`https://${domain}/favicon.ico`);
      if (res.status === 200) return null;
    } catch { /* fall through */ }
    return {
      type: 'FAVICON_MISSING',
      severity: 'NOTICE',
      message: 'Favicon not found at /favicon.ico',
      suggestion: 'Add a favicon.ico (or <link rel="icon"> in HTML) for browser tabs and bookmarks.',
    };
  }

  private async checkCustom404(http: AxiosInstance, domain: string): Promise<SiteWideIssue | null> {
    const probeUrl = `https://${domain}/__definitely-not-a-real-page__-${Date.now()}`;
    try {
      const res = await http.get(probeUrl);
      // If server returns 200 for unknown URLs that's a soft 404 — but here we want
      // to confirm a 404 page exists AND has substantive content.
      if (res.status !== 404) {
        return {
          type: 'CUSTOM_404_MISSING',
          severity: 'WARNING',
          message: `Unknown URL returned status ${res.status} instead of 404`,
          suggestion: 'Make missing pages return real HTTP 404 status with a useful 404 page.',
        };
      }
      // We have a 404 — check that the body has at least some helpful content
      const body = typeof res.data === 'string' ? res.data : '';
      if (body.length < 200) {
        return {
          type: 'CUSTOM_404_MISSING',
          severity: 'WARNING',
          message: '404 page returns minimal content — consider a custom 404 with navigation',
          suggestion: 'Create a friendly 404 page that includes site navigation, search, and links to popular content.',
        };
      }
      return null;
    } catch {
      return {
        type: 'CUSTOM_404_MISSING',
        severity: 'WARNING',
        message: 'Could not test 404 page behaviour',
      };
    }
  }

  // --------------------------------------------------------------- SSL / TLS

  private checkSslCertificate(domain: string): Promise<SiteWideIssue[]> {
    return new Promise((resolve) => {
      const issues: SiteWideIssue[] = [];
      const host = domain.replace(/^www\./, '');
      const socket = tls.connect(
        { host, port: 443, servername: host, timeout: 8000 },
        () => {
          try {
            const cert = socket.getPeerCertificate();
            if (!cert || !cert.valid_to) {
              issues.push({
                type: 'SSL_CERT_INVALID',
                severity: 'ERROR',
                message: 'Could not retrieve SSL certificate details',
              });
            } else {
              const expiry = new Date(cert.valid_to).getTime();
              const daysUntilExpiry = Math.floor((expiry - Date.now()) / 86_400_000);
              if (daysUntilExpiry < 0) {
                issues.push({
                  type: 'SSL_CERT_INVALID',
                  severity: 'ERROR',
                  message: `SSL certificate has expired (${cert.valid_to})`,
                  details: { validTo: cert.valid_to },
                  suggestion: 'Renew the SSL certificate immediately.',
                });
              } else if (daysUntilExpiry < 30) {
                issues.push({
                  type: 'SSL_CERT_EXPIRING_SOON',
                  severity: 'ERROR',
                  message: `SSL certificate expires in ${daysUntilExpiry} day(s)`,
                  details: { validTo: cert.valid_to, daysUntilExpiry },
                  suggestion: 'Renew the SSL certificate before it expires.',
                });
              }
            }
          } catch {
            issues.push({
              type: 'SSL_CERT_INVALID',
              severity: 'ERROR',
              message: 'Failed to inspect SSL certificate',
            });
          } finally {
            socket.end();
            resolve(issues);
          }
        },
      );

      socket.on('error', () => {
        issues.push({
          type: 'SSL_CERT_INVALID',
          severity: 'ERROR',
          message: 'Could not establish TLS connection',
          suggestion: 'Verify HTTPS is configured and the SSL certificate is valid.',
        });
        resolve(issues);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(issues);
      });
    });
  }

  // -------------------------------------------------------------------- utils

  private makeHttpClient(): AxiosInstance {
    return axios.create({
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'NR-SEO-Crawler/1.0 (+https://nrseo.com/bot)',
        Accept: '*/*',
      },
      validateStatus: () => true,
    });
  }

  private canonicalize(rawUrl: string): string {
    try {
      const u = new URL(rawUrl);
      u.hash = '';
      u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
      let str = u.toString().toLowerCase();
      if (str.endsWith('/') && u.pathname !== '/') str = str.slice(0, -1);
      return str;
    } catch {
      return rawUrl.toLowerCase();
    }
  }

  private countBySeverity(issues: SiteWideIssue[]): { errors: number; warnings: number; notices: number } {
    let errors = 0, warnings = 0, notices = 0;
    for (const issue of issues) {
      if (issue.severity === 'ERROR') errors++;
      else if (issue.severity === 'WARNING') warnings++;
      else notices++;
    }
    return { errors, warnings, notices };
  }
}
