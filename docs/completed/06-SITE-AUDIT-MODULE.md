# Module 6 — Site Audit (Crawler)

> **Status:** ✅ Complete
> **Completed:** 2026-04-01
> **Scope:** Backend (NestJS) + Frontend (Next.js)
> **External Dependencies:** None (fully self-contained, zero API cost)

---

## Overview

BFS web crawler that audits a website for technical SEO issues. Fetches pages with axios, parses HTML with cheerio, runs 16 SEO checks, calculates a health score (0-100), and stores results per page. Respects robots.txt, deduplicates URLs, and enforces plan-based page limits.

---

## What Was Built

### Backend — 6 API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/projects/:id/crawls` | JWT + Owner | Start new crawl (plan limits enforced) |
| `GET` | `/api/projects/:id/crawls` | JWT + Owner | List crawl jobs (paginated) |
| `GET` | `/api/projects/:id/crawls/:crawlId` | JWT + Owner | Get crawl detail + issue breakdown by type |
| `GET` | `/api/projects/:id/crawls/:crawlId/issues` | JWT + Owner | List issues (filterable by severity/type, paginated) |
| `GET` | `/api/projects/:id/crawls/:crawlId/pages` | JWT + Owner | List crawled pages (filterable by status code, paginated) |
| `DELETE` | `/api/projects/:id/crawls/:crawlId` | JWT + Owner | Cancel running crawl |

### Crawler Features
- **BFS crawl** starting from `https://{domain}/`
- **Concurrency:** 5 URLs processed at a time
- **robots.txt** parsed and respected
- **URL normalization:** lowercase, remove fragments/tracking params, resolve relative URLs
- **Skip rules:** external domains, media files, mailto/tel/javascript schemes
- **Plan limits:** FREE 100 pages/2 crawls/mo, PRO 10K/10, AGENCY 100K/50
- **Background execution:** crawl runs async via `setTimeout`, doesn't block API response
- **Cancellation support:** checks job status between batches

### 16 SEO Checks

| Check | Severity | Condition |
|-------|----------|-----------|
| PAGE_NOT_FOUND | ERROR | HTTP 404 |
| SERVER_ERROR | ERROR | HTTP 5xx |
| MISSING_TITLE | ERROR | No `<title>` or empty |
| MISSING_H1 | ERROR | No `<h1>` or empty |
| HAS_NOINDEX | ERROR | Meta robots contains noindex |
| BROKEN_INTERNAL_LINK | ERROR | Internal link returns 404 |
| MISSING_META_DESCRIPTION | WARNING | No meta description or empty |
| IMAGE_MISSING_ALT | WARNING | Images without alt attribute |
| SLOW_PAGE | WARNING | Load time > 5 seconds |
| MULTIPLE_H1 | WARNING | More than one H1 tag |
| MISSING_CANONICAL | WARNING | No canonical link tag |
| TITLE_TOO_LONG | NOTICE | Title > 60 characters |
| TITLE_TOO_SHORT | NOTICE | Title < 30 characters |
| META_DESCRIPTION_TOO_LONG | NOTICE | Meta desc > 160 characters |
| META_DESCRIPTION_TOO_SHORT | NOTICE | Meta desc < 120 characters |
| LOW_WORD_COUNT | NOTICE | Body text < 300 words |

### Health Score
```
deductions = (errors × 10) + (warnings × 5) + (notices × 1)
maxPossible = totalPages × 50
score = max(0, round(100 - (deductions / maxPossible) × 100))
```
Color ranges: 90-100 green, 70-89 light green, 50-69 yellow, 30-49 orange, 0-29 red

### Frontend — 2 pages

| Route | Description |
|-------|-------------|
| `/dashboard/projects/[id]/audits` | Audit list — start crawl button, past crawls with status/score/counts |
| `/dashboard/projects/[id]/audits/[crawlId]` | Crawl detail — large score circle, stats, severity filter tabs, issues table |

---

## File Inventory

```
Backend:
  src/site-audit/crawler.service.ts       — Core BFS crawler with all 16 checks
  src/site-audit/site-audit.service.ts    — Business logic, plan limits, CRUD
  src/site-audit/site-audit.controller.ts — 6 endpoints
  src/site-audit/site-audit.module.ts     — Module wiring

Frontend:
  types/audit.ts                          — TypeScript interfaces
  hooks/useAudits.ts                      — React Query hooks
  pages/dashboard/projects/[id]/audits/index.tsx    — Audit list page
  pages/dashboard/projects/[id]/audits/index.module.css
  pages/dashboard/projects/[id]/audits/[crawlId].tsx  — Crawl detail page
  pages/dashboard/projects/[id]/audits/[crawlId].module.css
```

### Dependencies Added
| Package | Purpose |
|---------|---------|
| `cheerio` | HTML parsing (jQuery-like API) |
| `axios` | HTTP fetching (already existed) |

---

## Known Limitations
- [ ] **No WebSocket** — crawl progress not streamed in real-time (polling via page refresh)
- [ ] **No BullMQ** — crawl runs in NestJS process (fine for Phase 1, needs queue for scale)
- [ ] **No duplicate title/description detection** — DUPLICATE_TITLE and DUPLICATE_META_DESCRIPTION checks not implemented (require cross-page comparison after crawl)
- [ ] **No redirect chain detection** — REDIRECT_CHAIN check not implemented
- [ ] **No crawl comparison** — comparing with previous crawl (new/fixed issues) not implemented yet
- [ ] **No scheduled re-crawls** — needs cron job (Phase 1 scope: manual only)

---

## How to Test

1. Restart backend: `cd apps/backend/api && pnpm install && pnpm dev`
2. Go to a project detail page → click "Audits" or navigate to `/dashboard/projects/{id}/audits`
3. Click "Start New Audit" — crawl begins in background
4. Refresh the page to see progress updates (status changes from QUEUED → RUNNING → COMPLETED)
5. Click a completed crawl to see the score, issue breakdown, and issue table
6. Filter issues by severity (Errors/Warnings/Notices tabs)
