# Module 6 — Site Audit (Crawler) — SEO/GEO/AEO

> **Status:** ✅ Complete (v2 — 3-Dimension Audit)
> **Completed:** 2026-04-03
> **Scope:** Backend (NestJS) + Frontend (Next.js)
> **External Dependencies:** None (fully self-contained, zero API cost)

---

## Overview

BFS web crawler that audits a website across **3 dimensions** — SEO (Search Engine Optimization), GEO (Generative Engine Optimization for AI search), and AEO (Answer Engine Optimization for featured snippets/voice). Fetches pages with axios, parses HTML with cheerio, runs **55+ checks**, calculates a health score (0-100) plus per-dimension scores (1-10 each), and stores results per page. Includes crawl comparison, thematic reports, issue trends, scheduled re-crawls, and PDF export.

---

## What Was Built

### Backend — 12 API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/projects/:id/crawls` | JWT + Owner | Start new crawl (plan limits enforced) |
| `GET` | `/projects/:id/crawls` | JWT + Owner | List crawl jobs (paginated) |
| `GET` | `/projects/:id/crawls/:crawlId` | JWT + Owner | Get crawl detail + issue breakdown by type |
| `GET` | `/projects/:id/crawls/:crawlId/issues` | JWT + Owner | List issues (filterable by severity/type, paginated) |
| `GET` | `/projects/:id/crawls/:crawlId/pages` | JWT + Owner | List crawled pages (filterable by status code, paginated) |
| `DELETE` | `/projects/:id/crawls/:crawlId` | JWT + Owner | Cancel running crawl |
| `GET` | `/projects/:id/crawls/:crawlId/compare` | JWT + Owner | Compare crawl with previous (new/fixed/persistent issues) |
| `GET` | `/projects/:id/crawls/:crawlId/themes` | JWT + Owner | Thematic reports (12 themes across SEO/GEO/AEO) |
| `GET` | `/projects/:id/crawls/:crawlId/export` | JWT + Owner | Export all issues for PDF generation |
| `GET` | `/projects/:id/audit-analytics/score-history` | JWT + Owner | Score trend across last N crawls |
| `GET` | `/projects/:id/audit-analytics/issue-trends` | JWT + Owner | Per-issue-type counts across crawls |
| Cron | Hourly | N/A | Scheduled re-crawls (DAILY/WEEKLY/MONTHLY) |

### Crawler Features
- **BFS crawl** starting from `https://{domain}/`
- **Concurrency:** 5 URLs processed at a time
- **robots.txt** parsed and respected
- **URL normalization:** lowercase, remove fragments/tracking params, resolve relative URLs
- **Skip rules:** external domains, media files, mailto/tel/javascript schemes
- **Plan limits:** FREE 10K pages/999 crawls/mo (dev), PRO 10K/10, AGENCY 100K/50
- **Background execution:** crawl runs async via `setTimeout`
- **Cancellation support:** checks job status between batches
- **Post-crawl checks:** Duplicate title/description detection (cross-page comparison)

### 3-Dimension Scoring

| Dimension | Score Range | What It Measures |
|-----------|------------|-----------------|
| **SEO** | 1-10 | Traditional search engine ranking signals |
| **GEO** | 1-10 | AI search engine visibility (Perplexity, ChatGPT Search, Gemini) |
| **AEO** | 1-10 | Featured snippets, voice search, People Also Ask readiness |
| **Health** | 0-100 | Overall weighted score across all dimensions |

Health score formula:
```
weightedIssues = (errors × 3) + (warnings × 1.5) + (notices × 0.5)
weightedMax = totalChecks × 3
score = round(100 × (1 - weightedIssues / weightedMax))
```

Dimension score formula (per dimension):
```
deduction = (errors/pages × 3) + (warnings/pages × 1) + (notices/pages × 0.2)
score = clamp(1, round(10 - deduction), 10)
```

### 55+ SEO/GEO/AEO Checks

#### SEO Checks (28)

| Check | Severity | Condition |
|-------|----------|-----------|
| PAGE_NOT_FOUND | ERROR | HTTP 404 |
| SERVER_ERROR | ERROR | HTTP 5xx |
| MISSING_TITLE | ERROR | No `<title>` or empty |
| MISSING_H1 | ERROR | No `<h1>` or empty |
| HAS_NOINDEX | ERROR | Meta robots noindex |
| REDIRECT_CHAIN | ERROR | 3+ redirect hops |
| MIXED_CONTENT | ERROR | HTTP resources on HTTPS page |
| MISSING_META_DESCRIPTION | WARNING | No meta description |
| IMAGE_MISSING_ALT | WARNING | Images without alt |
| SLOW_PAGE | WARNING | Load time > 5s |
| MULTIPLE_H1 | WARNING | More than one H1 |
| MISSING_CANONICAL | WARNING | No canonical tag |
| MISSING_VIEWPORT | WARNING | No viewport meta |
| MISSING_LANG | WARNING | No lang attribute |
| MISSING_OG_TAGS | WARNING | No og:title + og:description |
| MISSING_OG_IMAGE | WARNING | Has OG tags but no og:image |
| MISSING_TWITTER_CARD | WARNING | No twitter:card meta |
| MISSING_STRUCTURED_DATA | WARNING | No JSON-LD or microdata |
| LARGE_PAGE_SIZE | WARNING | HTML > 500KB |
| TOO_MANY_LINKS | WARNING | 200+ links |
| NON_DESCRIPTIVE_ANCHOR | WARNING | 3+ "click here" / "read more" links |
| DUPLICATE_TITLE | WARNING | Post-crawl: shared title across pages |
| DUPLICATE_META_DESCRIPTION | WARNING | Post-crawl: shared meta description |
| TITLE_TOO_LONG | NOTICE | Title > 60 chars |
| TITLE_TOO_SHORT | NOTICE | Title < 30 chars |
| META_DESCRIPTION_TOO_LONG | NOTICE | Meta desc > 160 chars |
| META_DESCRIPTION_TOO_SHORT | NOTICE | Meta desc < 120 chars |
| LOW_WORD_COUNT | NOTICE | Body < 300 words |
| LOW_INTERNAL_LINKS | NOTICE | < 3 internal links |
| LOW_EXTERNAL_LINKS | NOTICE | 0 external links on 300+ word page |
| URL_NOT_CLEAN | NOTICE | Stop words / excessive params in URL |
| NO_CONTENT_DATE | NOTICE | No publication date on 500+ word page |

#### GEO Checks (14) — AI Search Readiness

| Check | Severity | Condition |
|-------|----------|-----------|
| NO_AUTHOR_INFO | ERROR | No author markup on content page (500+ words) |
| WEAK_EEAT_SIGNALS | WARNING | No testimonials, awards, certifications |
| NO_ORGANIZATION_SCHEMA | WARNING | No Organization/LocalBusiness schema |
| MISSING_SOCIAL_PROFILES | WARNING | No social media profile links |
| MISSING_SAMEAS_LINKS | WARNING | No sameAs in schema |
| NO_AUTHOR_SCHEMA | WARNING | No Person schema on content page |
| NO_SOURCE_CITATIONS | WARNING | No references to external sources |
| THIN_CONTENT_FOR_AI | WARNING | 300-800 words (too thin for AI citation) |
| NO_ORIGINAL_DATA | NOTICE | No stats/percentages/research data |
| NO_CREDENTIALS_VISIBLE | NOTICE | No contact info detected |

#### AEO Checks (11) — Answer Engine / Featured Snippets

| Check | Severity | Condition |
|-------|----------|-----------|
| NO_DIRECT_ANSWERS | ERROR | No concise answer paragraphs after question headings |
| NO_QUESTION_HEADINGS | WARNING | No "how/what/why" H2/H3 headings |
| NO_FAQ_SCHEMA | WARNING | Has question headings but no FAQPage schema |
| NO_HOWTO_SCHEMA | WARNING | Has how-to content but no HowTo schema |
| NO_SPEAKABLE_SCHEMA | WARNING | No SpeakableSpecification for voice search |
| NO_DEFINITION_PATTERN | WARNING | No "X is..." definition pattern |
| NO_LIST_CONTENT | WARNING | No ordered/unordered lists (500+ word page) |
| NO_TABLE_CONTENT | WARNING | No comparison tables (500+ word page) |
| LOW_QUESTION_COVERAGE | NOTICE | < 3 question headings on 500+ word page |

### 12 Thematic Reports (grouped by dimension)

**SEO Themes:** Crawlability, Content, Performance, Links, Technical SEO, Images
**GEO Themes:** E-E-A-T, Entity & Authority, AI Content Readiness
**AEO Themes:** Featured Snippets, Structured Answers, Voice Search

### Additional Features

- **Crawl Comparison** — side-by-side diff showing new, fixed, persistent issues + score delta
- **Score History** — trend chart across last 10 crawls on audit list page
- **Issue Trends** — per-issue-type counts across crawls for sparklines
- **Scheduled Re-crawls** — `@nestjs/schedule` cron (hourly check) for DAILY/WEEKLY/MONTHLY auto-crawls
- **PDF Export** — client-side PDF generation with cover page, dimension scores, per-dimension issue tables, full issue list (uses jspdf + jspdf-autotable)

### Frontend — 2 pages (enhanced)

| Route | Description |
|-------|-------------|
| `/dashboard/projects/[id]/audits` | Audit list — score trend bar chart, start crawl, past crawls with SEO/GEO/AEO scores |
| `/dashboard/projects/[id]/audits/[crawlId]` | Crawl detail — health circle + 3 dimension scores, 3-tab navigation (Issues / Thematic Reports / Compare), inline "How to fix" per issue, PDF download button |

---

## File Inventory

```
Backend:
  src/site-audit/crawler.service.ts         — Core BFS crawler with 55+ SEO/GEO/AEO checks
  src/site-audit/site-audit.service.ts      — Business logic, comparison, themes, trends, export
  src/site-audit/site-audit.controller.ts   — 10 endpoints + AuditAnalyticsController (2 endpoints)
  src/site-audit/site-audit.module.ts       — Module wiring
  src/site-audit/crawl-scheduler.service.ts — Cron-based scheduled re-crawls

Frontend:
  types/audit.ts                            — TypeScript interfaces (55+ issue types, dimension types)
  hooks/useAudits.ts                        — React Query hooks (9 hooks)
  utils/generateAuditPdf.ts                 — Client-side PDF generation
  pages/.../audits/index.tsx                — Audit list page with score trend chart
  pages/.../audits/index.module.css
  pages/.../audits/[crawlId].tsx            — Crawl detail with 3-tab navigation
  pages/.../audits/[crawlId].module.css
```

### Dependencies Added
| Package | Purpose |
|---------|---------|
| `cheerio` | HTML parsing (already existed) |
| `axios` | HTTP fetching (already existed) |
| `@nestjs/schedule` | Cron-based scheduled re-crawls |
| `jspdf` | Client-side PDF generation |
| `jspdf-autotable` | Table rendering in PDFs |

### Schema Changes
- `CrawlJob` — added `seoScore`, `geoScore`, `aeoScore` (Int?, 1-10)
- `CrawlPage` — added 17 new fields for GEO/AEO signals (hasAuthorInfo, hasFaqSchema, etc.)
- `CrawlIssue` — added `dimension` field (IssueDimension: SEO/GEO/AEO)
- `IssueType` enum — expanded from 19 to 55+ values
- `Project` — added `crawlSchedule` (CrawlSchedule: NONE/DAILY/WEEKLY/MONTHLY), `lastScheduledCrawlAt`

---

## Previous Limitations — Now Resolved

- [x] **Duplicate title/description detection** — implemented as post-crawl cross-page checks
- [x] **Redirect chain detection** — checks redirect count >= 3
- [x] **Crawl comparison** — full diff with new/fixed/persistent issues
- [x] **Scheduled re-crawls** — cron-based with DAILY/WEEKLY/MONTHLY options
- [x] **Thematic reports** — 12 themes across 3 dimensions
- [x] **PDF export** — full audit report with cover page and all issues

## Remaining Limitations
- [ ] **No WebSocket** — crawl progress not streamed in real-time (polling via page refresh)
- [ ] **No BullMQ** — crawl runs in NestJS process (needs queue for scale)
- [ ] **No broken external link checking** — would require fetching external URLs (expensive)
- [ ] **No JavaScript rendering** — crawler only sees server-rendered HTML

---

## How to Test

1. Restart backend: `cd apps/backend/api && pnpm dev`
2. Navigate to `/dashboard/projects/{id}/audits`
3. Click "Start New Audit" — crawl runs in background
4. Once completed, view the 3-dimension scores (SEO/GEO/AEO)
5. Switch between Issues / Thematic Reports / Compare tabs
6. Click "Download PDF Report" to export
7. Run a second crawl, then use "Compare with Previous" to see changes
