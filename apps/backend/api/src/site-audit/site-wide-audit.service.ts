import { Injectable } from '@nestjs/common';
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
  /** Status code returned for /robots.txt — useful even when we treat the
   *  response as "missing" because it was an HTML SPA fallback. */
  fetchedStatus: number | null;
  /** First few hundred characters of whatever response body we actually got
   *  for /robots.txt — shown to users so they can see what's there. */
  fetchedBodyPreview: string;
}

interface SitemapAnalysis {
  exists: boolean;
  validXml: boolean;
  url: string | null;
  urls: string[];
  raw: string;
  /** What we observed at each candidate URL — used as the source snippet
   *  when no valid sitemap was found. */
  attempts: { url: string; status: number | null; bodyPreview: string }[];
}

@Injectable()
export class SiteWideAuditService {
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

    const [redirectIssues, faviconIssue, certIssues, custom404Issue, headerIssues] = await Promise.all([
      this.checkProtocolAndHostRedirects(httpClient, domain),
      this.checkFavicon(httpClient, domain),
      this.checkSslCertificate(domain),
      this.checkCustom404(httpClient, domain),
      this.checkServerHeaders(httpClient, domain),
    ]);

    issues.push(...redirectIssues);
    if (faviconIssue) issues.push(faviconIssue);
    issues.push(...certIssues);
    if (custom404Issue) issues.push(custom404Issue);
    issues.push(...headerIssues);

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
      fetchedStatus: null,
      fetchedBodyPreview: '',
    };

    try {
      const res = await http.get(url);
      const status = res.status;
      const previewBody = typeof res.data === 'string' ? res.data : '';
      empty.fetchedStatus = status;
      empty.fetchedBodyPreview = previewBody.slice(0, 400);

      if (status !== 200 || typeof res.data !== 'string') return empty;

      // SPAs commonly return 200 + HTML for any unknown path. A real robots.txt
      // must be text/plain (or unspecified) AND must not look like HTML.
      const contentType = String(res.headers?.['content-type'] || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
        return empty;
      }
      if (this.looksLikeHtml(res.data)) {
        return empty;
      }

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
        fetchedStatus: empty.fetchedStatus,
        fetchedBodyPreview: empty.fetchedBodyPreview,
      };
    } catch {
      return empty;
    }
  }

  private checkRobotsTxt(r: RobotsTxtAnalysis): SiteWideIssue[] {
    const issues: SiteWideIssue[] = [];

    if (!r.exists) {
      const statusInfo = r.fetchedStatus !== null ? `HTTP ${r.fetchedStatus}` : 'no response';
      const body = r.fetchedBodyPreview ? `\n\n${r.fetchedBodyPreview}` : '';
      issues.push({
        type: 'ROBOTS_TXT_MISSING',
        severity: 'ERROR',
        message: 'robots.txt file is not present at /robots.txt',
        details: { sourceSnippet: `GET /robots.txt → ${statusInfo}${body}`, status: r.fetchedStatus },
        suggestion: 'Add a robots.txt file at the site root to control crawler access.',
      });
      return issues; // No further checks possible without the file.
    }

    if (!r.syntaxValid) {
      issues.push({
        type: 'ROBOTS_TXT_SYNTAX_ERROR',
        severity: 'ERROR',
        message: `robots.txt has ${r.syntaxErrors.length} syntax error(s)`,
        details: { errors: r.syntaxErrors.slice(0, 5), sourceSnippet: r.syntaxErrors.slice(0, 5).join('\n') },
        suggestion: 'Each rule must be "Field: value" — fix invalid lines so crawlers parse the file correctly.',
      });
    }

    if (r.blocksImportant) {
      // Find the offending Disallow line(s) for the snippet.
      const offendingLines = r.raw.split('\n')
        .filter((l) => /^\s*Disallow\s*:\s*(\/|\/index|\/blog|\/products|\/services|\/about|\/contact)/i.test(l))
        .slice(0, 5);
      issues.push({
        type: 'ROBOTS_TXT_BLOCKS_IMPORTANT',
        severity: 'ERROR',
        message: 'robots.txt blocks important pages from crawlers',
        details: { sourceSnippet: offendingLines.join('\n') || undefined },
        suggestion: 'Remove Disallow directives that target your homepage, blog, products, or other key URLs.',
      });
    }

    if (r.blocksAssets) {
      const offendingLines = r.raw.split('\n')
        .filter((l) => /^\s*Disallow\s*:.*\.(css|js|png|jpg|jpeg|svg|webp)|\/assets\/|\/static\/|\/css\/|\/js\//i.test(l))
        .slice(0, 5);
      issues.push({
        type: 'ROBOTS_TXT_BLOCKS_ASSETS',
        severity: 'ERROR',
        message: 'robots.txt blocks CSS, JS, or image resources',
        details: { sourceSnippet: offendingLines.join('\n') || undefined },
        suggestion: 'Allow Googlebot to load CSS/JS/images so it can render your pages correctly.',
      });
    }

    if (!r.hasSitemapDirective) {
      // Show the actual robots.txt content so the user can see what IS there
      // (and confirm there's truly no Sitemap: line).
      issues.push({
        type: 'ROBOTS_TXT_NO_SITEMAP_REF',
        severity: 'WARNING',
        message: 'robots.txt does not reference a sitemap',
        details: { sourceSnippet: r.raw.slice(0, 600) },
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

    const attempts: { url: string; status: number | null; bodyPreview: string }[] = [];
    for (const url of candidates) {
      try {
        const res = await http.get(url);
        const status = res.status;
        const body = typeof res.data === 'string' ? res.data : '';
        attempts.push({ url, status, bodyPreview: body.slice(0, 200) });

        if (status !== 200 || typeof res.data !== 'string') continue;

        // Reject SPA fallbacks: real sitemaps are XML, not HTML.
        const contentType = String(res.headers?.['content-type'] || '').toLowerCase();
        if (contentType.includes('text/html') || contentType.includes('application/xhtml')) continue;
        if (this.looksLikeHtml(res.data)) continue;

        const raw = res.data;
        const validXml = /<\?xml[^>]+\?>/i.test(raw) && (/<urlset[\s>]/i.test(raw) || /<sitemapindex[\s>]/i.test(raw));
        const urls = Array.from(raw.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)).map((m) => m[1].trim());
        return { exists: true, validXml, url, urls, raw, attempts };
      } catch (err: any) {
        attempts.push({ url, status: null, bodyPreview: String(err?.message || err).slice(0, 200) });
      }
    }

    return { exists: false, validXml: false, url: null, urls: [], raw: '', attempts };
  }

  private checkSitemap(s: SitemapAnalysis, robots: RobotsTxtAnalysis): SiteWideIssue[] {
    const issues: SiteWideIssue[] = [];

    if (!s.exists) {
      const attemptDump = s.attempts
        .map((a) => `GET ${a.url} → ${a.status ?? 'error'}${a.bodyPreview ? `\n  ${a.bodyPreview.replace(/\n/g, ' ').slice(0, 120)}` : ''}`)
        .join('\n');
      issues.push({
        type: 'SITEMAP_MISSING',
        severity: 'ERROR',
        message: 'No sitemap.xml found at the standard locations',
        details: { sourceSnippet: attemptDump || 'No candidate URLs returned a valid XML sitemap.', attempts: s.attempts },
        suggestion: 'Generate a sitemap.xml at /sitemap.xml or reference it from robots.txt.',
      });
      return issues;
    }

    if (!s.validXml) {
      issues.push({
        type: 'SITEMAP_INVALID_XML',
        severity: 'ERROR',
        message: 'Sitemap response is not valid XML',
        details: { url: s.url, sourceSnippet: `${s.url}\nFirst 200 chars: ${(s.raw || '').slice(0, 200)}` },
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
      const res = await http.get(`https://${domain}/favicon.ico`, { responseType: 'arraybuffer' });
      if (res.status !== 200) {
        return this.faviconMissingIssue();
      }
      // SPA fallback check — a real favicon is an image, not HTML.
      const contentType = String(res.headers?.['content-type'] || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
        return this.faviconMissingIssue();
      }
      // If no content-type declared, sniff the first few bytes for known image magic numbers.
      if (!contentType) {
        const buf = Buffer.isBuffer(res.data) ? res.data : Buffer.from(res.data || '');
        if (buf.length === 0 || this.looksLikeHtml(buf.toString('utf8', 0, 200))) {
          return this.faviconMissingIssue();
        }
      }
      return null;
    } catch { /* fall through */ }
    return this.faviconMissingIssue();
  }

  private faviconMissingIssue(): SiteWideIssue {
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

  // -------------------------------------------------- server-level HTTP headers

  /**
   * Inspect the response headers of the homepage once. Security/cache/compression
   * headers are typically set at the server or CDN level and apply to every page,
   * so reporting them per-page would inflate counts by N.
   */
  private async checkServerHeaders(http: AxiosInstance, domain: string): Promise<SiteWideIssue[]> {
    const issues: SiteWideIssue[] = [];
    let headers: Record<string, string> = {};

    try {
      const res = await http.get(`https://${domain}/`);
      if (res.status >= 400) return issues;
      headers = this.lowercaseHeaders(res.headers);
    } catch {
      return issues;
    }

    // Build a snippet of the ACTUAL response headers we got from the homepage,
    // so users can see exactly what the server returned. We render it as a
    // standard HTTP-header dump (`Name: value` per line) and cap to ~20 entries.
    const allHeaderLines = Object.entries(headers)
      .map(([k, v]) => `${this.titleCaseHeader(k)}: ${v}`)
      .slice(0, 20)
      .join('\n');
    const headerDump = allHeaderLines || '(server returned no response headers)';

    if (!headers['strict-transport-security']) {
      issues.push({
        type: 'MISSING_HSTS_HEADER',
        severity: 'WARNING',
        message: 'Strict-Transport-Security (HSTS) header is missing on the homepage',
        details: { sourceSnippet: headerDump, missing: 'Strict-Transport-Security' },
        suggestion: 'Add HSTS header (e.g. "max-age=31536000; includeSubDomains") to enforce HTTPS-only.',
      });
    }
    if (!headers['content-security-policy']) {
      issues.push({
        type: 'MISSING_CSP_HEADER',
        severity: 'WARNING',
        message: 'Content-Security-Policy header is missing',
        details: { sourceSnippet: headerDump, missing: 'Content-Security-Policy' },
        suggestion: 'Add a CSP header to prevent XSS and code-injection attacks.',
      });
    }
    if (!headers['x-frame-options']) {
      issues.push({
        type: 'MISSING_X_FRAME_OPTIONS',
        severity: 'WARNING',
        message: 'X-Frame-Options header is missing',
        details: { sourceSnippet: headerDump, missing: 'X-Frame-Options' },
        suggestion: 'Add "X-Frame-Options: SAMEORIGIN" or "DENY" to prevent clickjacking.',
      });
    }
    if (!headers['referrer-policy']) {
      issues.push({
        type: 'MISSING_REFERRER_POLICY',
        severity: 'NOTICE',
        message: 'Referrer-Policy header is missing',
        details: { sourceSnippet: headerDump, missing: 'Referrer-Policy' },
        suggestion: 'Set Referrer-Policy (e.g. "strict-origin-when-cross-origin") to control referrer leaks.',
      });
    }
    if (!headers['x-content-type-options']) {
      issues.push({
        type: 'MISSING_X_CONTENT_TYPE_OPTIONS',
        severity: 'NOTICE',
        message: 'X-Content-Type-Options: nosniff header is missing',
        details: { sourceSnippet: headerDump, missing: 'X-Content-Type-Options' },
        suggestion: 'Add "X-Content-Type-Options: nosniff" to prevent MIME-type sniffing.',
      });
    }
    if (!headers['permissions-policy']) {
      issues.push({
        type: 'MISSING_PERMISSIONS_POLICY',
        severity: 'NOTICE',
        message: 'Permissions-Policy header is missing',
        details: { sourceSnippet: headerDump, missing: 'Permissions-Policy' },
        suggestion: 'Add Permissions-Policy to control which browser features the page may use.',
      });
    }
    if (!headers['cache-control'] && !headers['expires']) {
      issues.push({
        type: 'MISSING_CACHE_HEADERS',
        severity: 'WARNING',
        message: 'No Cache-Control or Expires header set on homepage',
        details: { sourceSnippet: headerDump, missing: 'Cache-Control / Expires' },
        suggestion: 'Configure caching headers (Cache-Control or Expires) to improve repeat-visit performance.',
      });
    }
    const encoding = headers['content-encoding'] || '';
    if (!/gzip|br|deflate|zstd/i.test(encoding)) {
      issues.push({
        type: 'MISSING_COMPRESSION',
        severity: 'WARNING',
        message: 'Homepage response is not gzip / brotli compressed',
        details: { sourceSnippet: headerDump, contentEncoding: encoding || null },
        suggestion: 'Enable gzip or brotli compression on the server (or CDN).',
      });
    }

    return issues;
  }

  /** Convert a lowercase header name to its conventional canonical casing (Strict-Transport-Security, etc.). */
  private titleCaseHeader(name: string): string {
    return name
      .split('-')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join('-');
  }

  private lowercaseHeaders(raw: any): Record<string, string> {
    const out: Record<string, string> = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'string') out[k.toLowerCase()] = v;
      else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) out[k.toLowerCase()] = (v as string[]).join(', ');
    }
    return out;
  }

  // --------------------------------------------------------------- SSL / TLS

  private checkSslCertificate(domain: string): Promise<SiteWideIssue[]> {
    return new Promise((resolve) => {
      const issues: SiteWideIssue[] = [];
      const host = domain.replace(/^www\./, '');
      let settled = false;

      const finish = (extra?: SiteWideIssue) => {
        if (settled) return;
        settled = true;
        if (extra) issues.push(extra);
        try { socket.destroy(); } catch { /* ignore */ }
        resolve(issues);
      };

      const socket = tls.connect(
        { host, port: 443, servername: host, timeout: 8000 },
        () => {
          try {
            const cert = socket.getPeerCertificate();
            if (!cert || !cert.valid_to) {
              finish({
                type: 'SSL_CERT_INVALID',
                severity: 'ERROR',
                message: 'Could not retrieve SSL certificate details',
              });
              return;
            }
            const expiry = new Date(cert.valid_to).getTime();
            const daysUntilExpiry = Math.floor((expiry - Date.now()) / 86_400_000);
            if (daysUntilExpiry < 0) {
              finish({
                type: 'SSL_CERT_INVALID',
                severity: 'ERROR',
                message: `SSL certificate has expired (${cert.valid_to})`,
                details: { validTo: cert.valid_to },
                suggestion: 'Renew the SSL certificate immediately.',
              });
            } else if (daysUntilExpiry < 30) {
              finish({
                type: 'SSL_CERT_EXPIRING_SOON',
                severity: 'ERROR',
                message: `SSL certificate expires in ${daysUntilExpiry} day(s)`,
                details: { validTo: cert.valid_to, daysUntilExpiry },
                suggestion: 'Renew the SSL certificate before it expires.',
              });
            } else {
              finish(); // healthy cert
            }
          } catch {
            finish({
              type: 'SSL_CERT_INVALID',
              severity: 'ERROR',
              message: 'Failed to inspect SSL certificate',
            });
          }
        },
      );

      socket.on('error', () => {
        finish({
          type: 'SSL_CERT_INVALID',
          severity: 'ERROR',
          message: 'Could not establish TLS connection to inspect the SSL certificate',
          suggestion: 'Verify HTTPS is configured and the SSL certificate is valid.',
        });
      });

      socket.on('timeout', () => {
        finish({
          type: 'SSL_CERT_INVALID',
          severity: 'ERROR',
          message: 'TLS handshake timed out — could not inspect SSL certificate',
          suggestion: 'Check that the server responds quickly on port 443 with a valid certificate.',
        });
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

  /**
   * Detect SPA fallbacks: many sites return a 200 HTML "Page not found" shell
   * for unknown URLs, including /robots.txt and /sitemap.xml. We reject those
   * by sniffing the body for HTML markers.
   */
  private looksLikeHtml(body: unknown): boolean {
    if (typeof body !== 'string') return false;
    const head = body.slice(0, 500).trim().toLowerCase();
    if (!head) return false;
    return (
      head.startsWith('<!doctype html') ||
      head.startsWith('<html') ||
      /<head[\s>]/.test(head) ||
      /<body[\s>]/.test(head)
    );
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
