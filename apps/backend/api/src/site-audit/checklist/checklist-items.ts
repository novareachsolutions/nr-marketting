/**
 * Static definition of the 128-item Technical SEO Audit Checklist.
 *
 * Each item is mapped to one or more IssueType values produced by the existing
 * CrawlerService and SiteWideAuditService. When the checklist is evaluated for
 * a crawl, an item is marked as failing if ANY of its matching issue types
 * appears in the crawl results.
 *
 * Items with `matchingIssueTypes: []` represent checks not yet implemented in
 * the crawler — they will be reported as "Skipped" until detection logic is added.
 */

import { ChecklistCategory, ChecklistItemDefinition } from './checklist.types';

export const CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  { id: 1, name: 'Crawlability & Indexability' },
  { id: 2, name: 'Site Architecture & Internal Linking' },
  { id: 3, name: 'On-Page SEO' },
  { id: 4, name: 'Technical SEO' },
  { id: 5, name: 'Structured Data' },
  { id: 6, name: 'Performance & Core Web Vitals' },
  { id: 7, name: 'Security' },
  { id: 8, name: 'International SEO' },
  { id: 9, name: 'Backlink & Authority Signals' },
  { id: 10, name: 'Miscellaneous' },
];

const cat = (id: number) => CHECKLIST_CATEGORIES.find((c) => c.id === id)!;

const NEEDS_PAGESPEED_API = 'Requires Google PageSpeed Insights API integration.';
const NEEDS_GSC_API = 'Requires Google Search Console API integration.';
const NEEDS_BACKLINK_DATA = 'Requires backlink-audit module integration.';
const NEEDS_TARGET_KEYWORD = 'Requires target keyword data per project.';

export const CHECKLIST_ITEMS: ChecklistItemDefinition[] = [
  // ======================================================================
  // 1. CRAWLABILITY & INDEXABILITY (21 items)
  // ======================================================================
  { id: 1, category: cat(1), title: 'Robots.txt file is present and accessible at /robots.txt', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['ROBOTS_TXT_MISSING'] },
  { id: 2, category: cat(1), title: 'Robots.txt has no syntax errors', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['ROBOTS_TXT_SYNTAX_ERROR'], dependsOnItems: [1] },
  { id: 3, category: cat(1), title: 'Robots.txt does not block important pages or resources', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['ROBOTS_TXT_BLOCKS_IMPORTANT'], dependsOnItems: [1] },
  { id: 4, category: cat(1), title: 'XML sitemap is present (sitemap.xml or referenced path)', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['SITEMAP_MISSING'] },
  { id: 5, category: cat(1), title: 'Sitemap is valid XML and correctly formatted', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['SITEMAP_INVALID_XML'], dependsOnItems: [4] },
  { id: 6, category: cat(1), title: 'Sitemap is referenced in robots.txt', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['ROBOTS_TXT_NO_SITEMAP_REF'], dependsOnItems: [1] },
  { id: 7, category: cat(1), title: 'Sitemap URLs match the canonical versions of pages', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['SITEMAP_CANONICAL_MISMATCH'], dependsOnItems: [4] },
  { id: 8, category: cat(1), title: 'Sitemap vs indexed pages mismatch reviewed and addressed', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: NEEDS_GSC_API },
  { id: 9, category: cat(1), title: 'No pages deeper than 3 clicks from the homepage', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['PAGE_TOO_DEEP'] },
  { id: 10, category: cat(1), title: 'No broken internal links (4xx responses)', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['PAGE_NOT_FOUND'] },
  { id: 11, category: cat(1), title: 'No broken external links (4xx responses)', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: 'Detection: external link HEAD-check (planned, deferred — would add hundreds of HTTP requests per crawl).' },
  { id: 12, category: cat(1), title: 'No redirect chains (3 or more hops)', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['REDIRECT_CHAIN'] },
  { id: 13, category: cat(1), title: 'No redirect loops detected', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['REDIRECT_LOOP'] },
  { id: 14, category: cat(1), title: 'No orphan pages (pages with zero internal links)', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['ORPHAN_PAGE'] },
  { id: 15, category: cat(1), title: 'CSS, JS, and images are not blocked by robots.txt', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['ROBOTS_TXT_BLOCKS_ASSETS'], dependsOnItems: [1] },
  { id: 16, category: cat(1), title: 'Noindex tags not applied to important pages by mistake', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['HAS_NOINDEX'] },
  { id: 17, category: cat(1), title: 'Canonical tags present on all key pages', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['MISSING_CANONICAL'] },
  { id: 18, category: cat(1), title: 'No conflicting canonical tags (self-referencing where needed)', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['CANONICAL_CONFLICT'] },
  { id: 19, category: cat(1), title: 'No duplicate canonical tags pointing to incorrect URLs', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['CANONICAL_CONFLICT'] },
  { id: 20, category: cat(1), title: 'No 5xx server errors across the site', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['SERVER_ERROR'] },
  { id: 21, category: cat(1), title: 'Soft 404 pages identified and corrected', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['CUSTOM_404_MISSING'] },

  // ======================================================================
  // 2. SITE ARCHITECTURE & INTERNAL LINKING (13 items)
  // ======================================================================
  { id: 22, category: cat(2), title: 'URLs are clean, readable, and SEO-friendly', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['URL_NOT_CLEAN'] },
  { id: 23, category: cat(2), title: 'URLs use hyphens (not underscores) as word separators', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['URL_USES_UNDERSCORES'] },
  { id: 24, category: cat(2), title: 'No unnecessary dynamic parameters cluttering URLs', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['URL_HAS_EXCESS_PARAMS'] },
  { id: 25, category: cat(2), title: 'URL structure logically reflects site hierarchy', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: [], note: 'Detection: URL depth vs link depth correlation (heuristic).' },
  { id: 26, category: cat(2), title: 'Internal linking distributes PageRank to important pages', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['LOW_INTERNAL_LINKS'] },
  { id: 27, category: cat(2), title: 'No pages with only one internal link pointing to them', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['ORPHAN_PAGE'] },
  { id: 28, category: cat(2), title: 'Anchor text is descriptive and keyword-relevant', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['NON_DESCRIPTIVE_ANCHOR'] },
  { id: 29, category: cat(2), title: 'No over-optimised / exact-match-only anchor text patterns', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: [], note: 'Detection: anchor-text frequency analysis (heuristic).' },
  { id: 30, category: cat(2), title: 'Breadcrumb navigation is implemented site-wide', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['MISSING_BREADCRUMBS'] },
  { id: 31, category: cat(2), title: 'Breadcrumbs use BreadcrumbList JSON-LD schema markup', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['MISSING_BREADCRUMB_SCHEMA'], dependsOnItems: [30] },
  { id: 32, category: cat(2), title: 'Pagination uses correct rel=next/prev or canonical handling', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: 'Detection: pagination link analysis (planned).' },
  { id: 33, category: cat(2), title: 'No duplicate pages leading to the same content', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['DUPLICATE_TITLE', 'DUPLICATE_META_DESCRIPTION'] },
  { id: 34, category: cat(2), title: 'Navigation links are crawlable HTML (not JS-only)', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: 'Detection: requires JS-rendering vs raw-HTML diff (browser engine).' },

  // ======================================================================
  // 3. ON-PAGE SEO (19 items)
  // ======================================================================
  { id: 35, category: cat(3), title: 'Every page has a unique, descriptive title tag', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['MISSING_TITLE', 'DUPLICATE_TITLE'] },
  { id: 36, category: cat(3), title: 'Title tags are between 50-60 characters long', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['TITLE_TOO_LONG', 'TITLE_TOO_SHORT'], dependsOnItems: [38] },
  { id: 37, category: cat(3), title: 'Title tags contain the primary keyword near the beginning', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: NEEDS_TARGET_KEYWORD },
  { id: 38, category: cat(3), title: 'No missing title tags across the site', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['MISSING_TITLE'] },
  { id: 39, category: cat(3), title: 'Every page has a unique, compelling meta description', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['MISSING_META_DESCRIPTION', 'DUPLICATE_META_DESCRIPTION'] },
  { id: 40, category: cat(3), title: 'Meta descriptions are between 150-160 characters', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['META_DESCRIPTION_TOO_LONG', 'META_DESCRIPTION_TOO_SHORT'], dependsOnItems: [39] },
  { id: 41, category: cat(3), title: 'Each page has exactly one H1 tag', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['MISSING_H1', 'MULTIPLE_H1'] },
  { id: 42, category: cat(3), title: 'H1 contains the primary target keyword', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: NEEDS_TARGET_KEYWORD },
  { id: 43, category: cat(3), title: 'Header tags H2-H6 used in logical hierarchical order', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['HEADING_HIERARCHY_BROKEN'] },
  { id: 44, category: cat(3), title: 'Primary keyword appears in first 100 words of body content', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: NEEDS_TARGET_KEYWORD },
  { id: 45, category: cat(3), title: 'No keyword stuffing detected on any page', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: NEEDS_TARGET_KEYWORD },
  { id: 46, category: cat(3), title: 'No thin content pages (under 300 words for content pages)', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['LOW_WORD_COUNT', 'THIN_CONTENT_FOR_AI'] },
  { id: 47, category: cat(3), title: 'No substantial duplicate content across pages', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['DUPLICATE_TITLE', 'DUPLICATE_META_DESCRIPTION'] },
  { id: 48, category: cat(3), title: 'Content readability score appropriate for target audience', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: [], note: 'Detection: Flesch reading ease calculation (planned).' },
  { id: 49, category: cat(3), title: 'All meaningful images have descriptive alt attributes', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['IMAGE_MISSING_ALT'] },
  { id: 50, category: cat(3), title: 'Alt text is not stuffed with keywords', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: [], note: 'Detection: alt-text keyword density check (planned).' },
  { id: 51, category: cat(3), title: 'Images compressed appropriately (under 200 KB where possible)', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: 'Detection: image byte-size inspection (planned).' },
  { id: 52, category: cat(3), title: 'Images use next-gen formats (WebP or AVIF preferred)', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['MISSING_NEXT_GEN_IMAGE_FORMAT'] },
  { id: 53, category: cat(3), title: 'Images have descriptive, keyword-relevant file names', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['IMAGE_FILENAME_NOT_DESCRIPTIVE'] },

  // ======================================================================
  // 4. TECHNICAL SEO (16 items)
  // ======================================================================
  { id: 54, category: cat(4), title: 'Largest Contentful Paint (LCP) is under 2.5 seconds', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: NEEDS_PAGESPEED_API },
  { id: 55, category: cat(4), title: 'Cumulative Layout Shift (CLS) score is below 0.1', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: NEEDS_PAGESPEED_API },
  { id: 56, category: cat(4), title: 'Interaction to Next Paint (INP) is under 200ms', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: NEEDS_PAGESPEED_API },
  { id: 57, category: cat(4), title: 'Site is fully mobile-responsive', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['MISSING_VIEWPORT'] },
  { id: 58, category: cat(4), title: 'No mobile usability errors in Google Search Console', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: NEEDS_GSC_API },
  { id: 59, category: cat(4), title: 'Site is served entirely over HTTPS', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['MIXED_CONTENT', 'HTTP_NOT_REDIRECTING_TO_HTTPS'] },
  { id: 60, category: cat(4), title: 'No mixed content (HTTP resources on HTTPS pages)', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['MIXED_CONTENT'] },
  { id: 61, category: cat(4), title: 'JS rendering does not block key content from crawlers', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: 'Detection: requires headless rendering (planned).' },
  { id: 62, category: cat(4), title: 'Important SEO content not locked behind JS execution', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: 'Detection: requires headless rendering (planned).' },
  { id: 63, category: cat(4), title: 'HTML page size is under 100 KB per page', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['LARGE_PAGE_SIZE'] },
  { id: 64, category: cat(4), title: 'DOM node count is under 1,500 nodes per page', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['EXCESSIVE_DOM_NODES'] },
  { id: 65, category: cat(4), title: 'Lazy loading implemented for images below the fold', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['MISSING_LAZY_LOADING'] },
  { id: 66, category: cat(4), title: 'CDN is used to serve static assets globally', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: [], note: 'Detection: asset hostname analysis (planned).' },
  { id: 67, category: cat(4), title: 'Server response time (TTFB) is under 600ms', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['SLOW_PAGE'] },
  { id: 68, category: cat(4), title: 'Browser caching and cache-control headers configured', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['MISSING_CACHE_HEADERS'] },
  { id: 69, category: cat(4), title: 'Gzip or Brotli compression is enabled on the server', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['MISSING_COMPRESSION'] },

  // ======================================================================
  // 5. STRUCTURED DATA (11 items)
  // ======================================================================
  { id: 70, category: cat(5), title: 'Schema markup implemented on all key page types', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['MISSING_STRUCTURED_DATA'] },
  { id: 71, category: cat(5), title: 'All schema validated — no critical errors in Rich Results Test', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: 'Requires Google Rich Results Test API.' },
  { id: 72, category: cat(5), title: 'Organization or LocalBusiness schema on homepage', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['NO_ORGANIZATION_SCHEMA'] },
  { id: 73, category: cat(5), title: 'Article / BlogPosting schema on blog or news pages', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: [], note: 'Detection: blog-URL targeted Article schema scan (planned).' },
  { id: 74, category: cat(5), title: 'Product schema on product pages (price, availability, rating)', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: 'Detection: product-URL targeted Product schema scan (planned).' },
  { id: 75, category: cat(5), title: 'FAQ schema implemented on FAQ or support pages', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['NO_FAQ_SCHEMA'] },
  { id: 76, category: cat(5), title: 'Breadcrumb schema matches visible breadcrumb navigation', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['MISSING_BREADCRUMB_SCHEMA'], dependsOnItems: [30] },
  { id: 77, category: cat(5), title: 'Open Graph tags present on all pages', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['MISSING_OG_TAGS', 'MISSING_OG_IMAGE'] },
  { id: 78, category: cat(5), title: 'Twitter Card tags present on all pages', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['MISSING_TWITTER_CARD'] },
  { id: 79, category: cat(5), title: 'og:image meets minimum size requirements (1200x630px)', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['OG_IMAGE_TOO_SMALL'], dependsOnItems: [77] },
  { id: 80, category: cat(5), title: 'No schema type mismatch with visible page content', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: 'Detection: schema/content semantic comparison (planned).' },

  // ======================================================================
  // 6. PERFORMANCE & CORE WEB VITALS (11 items)
  // ======================================================================
  { id: 81, category: cat(6), title: 'Render-blocking CSS moved to non-blocking or inlined', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: NEEDS_PAGESPEED_API },
  { id: 82, category: cat(6), title: 'Render-blocking JS deferred or loaded asynchronously', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: NEEDS_PAGESPEED_API },
  { id: 83, category: cat(6), title: 'Unused CSS removed or tree-shaken at build time', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: NEEDS_PAGESPEED_API },
  { id: 84, category: cat(6), title: 'Unused JavaScript removed or code-split into bundles', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: NEEDS_PAGESPEED_API },
  { id: 85, category: cat(6), title: 'Web fonts use font-display: swap', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['MISSING_FONT_DISPLAY_SWAP'] },
  { id: 86, category: cat(6), title: 'Third-party scripts audited, non-critical ones deferred', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: 'Detection: third-party script inventory (planned).' },
  { id: 87, category: cat(6), title: 'Total page weight is under 2 MB', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: 'Detection: total page weight (HTML + CSS + JS + images) requires fetching all sub-resources (planned).' },
  { id: 88, category: cat(6), title: 'Preconnect / dns-prefetch hints added for key origins', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['MISSING_PRECONNECT_HINTS'] },
  { id: 89, category: cat(6), title: 'LCP image or key font preloaded via <link rel="preload">', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: [], note: NEEDS_PAGESPEED_API },
  { id: 90, category: cat(6), title: 'No layout shifts caused by ads, embeds, or late images', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: NEEDS_PAGESPEED_API },
  { id: 91, category: cat(6), title: 'All images have explicit width and height attributes set', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['MISSING_IMG_DIMENSIONS'] },

  // ======================================================================
  // 7. SECURITY (11 items)
  // ======================================================================
  { id: 92, category: cat(7), title: 'Site fully served over HTTPS with valid SSL certificate', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['MIXED_CONTENT', 'SSL_CERT_INVALID'] },
  { id: 93, category: cat(7), title: 'SSL certificate is not expired or expiring within 30 days', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['SSL_CERT_EXPIRING_SOON', 'SSL_CERT_INVALID'] },
  { id: 94, category: cat(7), title: 'HSTS (Strict-Transport-Security) header implemented', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['MISSING_HSTS_HEADER'], dependsOnItems: [92] },
  { id: 95, category: cat(7), title: 'Content-Security-Policy (CSP) header present', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['MISSING_CSP_HEADER'], dependsOnItems: [92] },
  { id: 96, category: cat(7), title: 'X-Frame-Options header set to prevent clickjacking', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['MISSING_X_FRAME_OPTIONS'], dependsOnItems: [92] },
  { id: 97, category: cat(7), title: 'Referrer-Policy header configured appropriately', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['MISSING_REFERRER_POLICY'], dependsOnItems: [92] },
  { id: 98, category: cat(7), title: 'X-Content-Type-Options: nosniff header present', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['MISSING_X_CONTENT_TYPE_OPTIONS'], dependsOnItems: [92] },
  { id: 99, category: cat(7), title: 'Permissions-Policy header configured', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['MISSING_PERMISSIONS_POLICY'], dependsOnItems: [92] },
  { id: 100, category: cat(7), title: 'No flagged malware / unsafe scripts (GSC Security Issues)', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: NEEDS_GSC_API },
  { id: 101, category: cat(7), title: 'Forms use CSRF protection and submit over HTTPS only', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: 'Detection: form action + CSRF token scan (planned).' },
  { id: 102, category: cat(7), title: 'No sensitive data exposed in source code or URL parameters', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['SENSITIVE_DATA_EXPOSED'] },

  // ======================================================================
  // 8. INTERNATIONAL SEO (8 items)
  // ======================================================================
  { id: 103, category: cat(8), title: 'Hreflang tags implemented for all multilingual pages', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: 'Detection: cannot determine intent (single-language sites would false-positive). Manual review.' },
  { id: 104, category: cat(8), title: 'Hreflang values use correct BCP 47 codes (e.g. en-US)', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['HREFLANG_INVALID_CODE'], dependsOnItems: [103] },
  { id: 105, category: cat(8), title: 'Every hreflang set includes a self-referencing annotation', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['HREFLANG_MISSING_SELF'], dependsOnItems: [103] },
  { id: 106, category: cat(8), title: 'Hreflang tags are fully reciprocal across all versions', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: 'Detection: cross-page hreflang reciprocity check (planned).', dependsOnItems: [103] },
  { id: 107, category: cat(8), title: 'x-default hreflang set for language selector / fallback', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['HREFLANG_MISSING_X_DEFAULT'], dependsOnItems: [103] },
  { id: 108, category: cat(8), title: 'Each language version has a unique URL (not cookie-only)', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: 'Detection: language vs URL correlation (planned).' },
  { id: 109, category: cat(8), title: 'Country/language targeting configured in GSC', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: NEEDS_GSC_API },
  { id: 110, category: cat(8), title: 'No unintentional duplicate content across geo-versions', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: 'Detection: cross-locale content similarity (planned).' },

  // ======================================================================
  // 9. BACKLINK & AUTHORITY SIGNALS (7 items)
  // ======================================================================
  { id: 111, category: cat(9), title: 'Backlink profile reviewed for toxic or spammy links', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: NEEDS_BACKLINK_DATA },
  { id: 112, category: cat(9), title: 'Disavow file created if toxic links cannot be removed', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: NEEDS_BACKLINK_DATA },
  { id: 113, category: cat(9), title: 'Referring domains are diverse and topically relevant', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: [], note: NEEDS_BACKLINK_DATA },
  { id: 114, category: cat(9), title: 'No large sudden loss of referring domains (penalty risk)', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: NEEDS_BACKLINK_DATA },
  { id: 115, category: cat(9), title: 'Broken backlinks (to 404 pages) identified and redirected', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: NEEDS_BACKLINK_DATA },
  { id: 116, category: cat(9), title: 'Top linked pages are the strategically most important ones', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: [], note: NEEDS_BACKLINK_DATA },
  { id: 117, category: cat(9), title: 'Unlinked brand mentions identified for outreach', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: [], note: NEEDS_BACKLINK_DATA },

  // ======================================================================
  // 10. MISCELLANEOUS (11 items)
  // ======================================================================
  { id: 118, category: cat(10), title: 'Favicon present and displays correctly in browser tabs', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: ['FAVICON_MISSING'] },
  { id: 119, category: cat(10), title: 'Custom 404 page is informative and includes navigation', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['CUSTOM_404_MISSING'] },
  { id: 120, category: cat(10), title: 'All HTTP URLs redirect to HTTPS with a 301 status', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['HTTP_NOT_REDIRECTING_TO_HTTPS'] },
  { id: 121, category: cat(10), title: 'www and non-www versions redirect to one canonical version', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: ['WWW_REDIRECT_INCONSISTENT'] },
  { id: 122, category: cat(10), title: 'Trailing slash usage is consistent across all URLs', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['TRAILING_SLASH_INCONSISTENT'] },
  { id: 123, category: cat(10), title: 'Google Search Console verified, no manual actions pending', severityWhenFailing: 'High', failureStatus: 'Error', matchingIssueTypes: [], note: NEEDS_GSC_API },
  { id: 124, category: cat(10), title: 'Google Analytics / tracking correctly implemented', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['GA_TRACKING_MISSING'] },
  { id: 125, category: cat(10), title: 'GA / GTM tags firing on every page', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: [], note: 'Detection: cross-page GA/GTM consistency check (planned).' },
  { id: 126, category: cat(10), title: 'AMP pages (if used) are valid with correct canonical tags', severityWhenFailing: 'Medium', failureStatus: 'Warning', matchingIssueTypes: ['AMP_INVALID'] },
  { id: 127, category: cat(10), title: 'Site registered in Bing Webmaster Tools', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: [], note: 'Requires Bing Webmaster Tools API integration.' },
  { id: 128, category: cat(10), title: 'Page Experience signals reviewed regularly in GSC', severityWhenFailing: 'Low', failureStatus: 'Notice', matchingIssueTypes: [], note: NEEDS_GSC_API },
];

// Sanity check at module load — surfaces ID gaps/duplicates immediately during tests.
const seenIds = new Set<number>();
for (const item of CHECKLIST_ITEMS) {
  if (seenIds.has(item.id)) {
    throw new Error(`Duplicate checklist item id: ${item.id}`);
  }
  seenIds.add(item.id);
}
if (CHECKLIST_ITEMS.length !== 128) {
  throw new Error(`Expected 128 checklist items, got ${CHECKLIST_ITEMS.length}`);
}
