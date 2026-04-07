# Module 11 — Top Pages (Semrush-Style)

> **Status:** ✅ Complete
> **Completed:** 2026-04-06
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Semrush-style top pages analysis tool. Users enter any domain and see its top-performing pages ranked by organic traffic — with per-page metrics including keyword count, top keyword with position, backlinks, and a 6-month traffic sparkline. Uses OpenAI (gpt-4o-mini) as the sole data source. Results cached for 7 days. Global tool (not project-scoped).

---

## What Was Built

### Backend — 1 API endpoint

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/top-pages?domain=...&country=US` | JWT | Top pages data — summary + 10 pages with detailed metrics |

### Key Features

#### Data Source: OpenAI Only

Single OpenAI call (gpt-4o-mini, temperature 0.3, max_tokens 3000, JSON response format, 120s timeout). Returns 10 pages sorted by traffic descending. On failure → throws error (no mock fallback).

#### Caching (7-Day TTL)

- `TopPagesCache` Prisma model with composite unique `[domain, country]`
- Single `Json data` column stores entire response
- Cache hit → instant return, cache miss → OpenAI call → upsert cache

#### Usage Tracking

Uses `UsageRecord` with `TOP_PAGES` metric. Plan limits defined (FREE: 3/day, PRO: 50, AGENCY: unlimited) but not enforced.

### Data Returned

| Section | Fields |
|---------|--------|
| **Summary** | `totalPages`, `totalOrganicTraffic`, `avgKeywordsPerPage` |
| **Pages** (10 items) | `url`, `traffic`, `trafficPercent`, `keywords`, `topKeyword`, `topKeywordPosition`, `backlinks`, `trafficTrend` (6 monthly values) |

### Frontend — 1 page

| Route | Description |
|-------|-------------|
| `/dashboard/top-pages` | Top pages analysis with sortable table + sparklines |

#### Page Sections

1. **Search Form** — Domain input + country selector (11 countries) + Analyze button
2. **Summary Bar** (3 cards) — Total Pages, Organic Traffic, Avg Keywords/Page
3. **Filters Row** — URL search, min traffic, min keywords
4. **Sortable Table** — #, URL, Traffic, Traffic % (with inline bar), Keywords, Top Keyword + position badge, Backlinks, Trend sparkline
5. **Pagination** — 10 rows per page

#### Table Features

- **Sortable columns**: click header to toggle asc/desc (URL, traffic, traffic %, keywords, backlinks)
- **Client-side filters**: URL substring search, minimum traffic, minimum keywords
- **Traffic % bar**: inline horizontal bar visualization
- **Position badge**: color-coded (green ≤3, light green ≤10, yellow ≤20, orange ≤50, red >50)
- **Sparkline**: tiny recharts `<AreaChart>` per row (60x24px, 6 data points, no axes)

#### Navigation

Added to main sidebar after "Organic Rankings" with page icon (📄).

---

## File Inventory

```
Backend:
  src/top-pages/top-pages.service.ts        — OpenAI integration, caching, usage tracking
  src/top-pages/top-pages.controller.ts     — GET endpoint with JWT guard
  src/top-pages/top-pages.module.ts         — Module wiring
  src/top-pages/dto/top-pages-query.dto.ts  — Validation DTO
  src/top-pages/dto/index.ts                — DTO re-export

Frontend:
  types/top-pages.ts                        — TypeScript interfaces (TopPagesData, TopPage, TopPagesSummary)
  hooks/useTopPages.ts                      — React Query hook
  pages/dashboard/top-pages/index.tsx       — Full page with table, sparklines, filters, sorting
  pages/dashboard/top-pages/index.module.css — Page styles (responsive, dark mode)

Modified:
  packages/database/prisma/schema.prisma              — TopPagesCache model + TOP_PAGES enum
  apps/backend/api/src/app.module.ts                  — Registered TopPagesModule
  apps/backend/api/src/common/constants/plan-limits.ts — Added maxTopPagesPerDay
  components/layout/Sidebar.tsx                       — Added Top Pages nav link
```

### Environment Variables
```
OPENAI_API_KEY=""         # Required — no fallback
```

### Database Schema

```prisma
model TopPagesCache {
  id        String   @id @default(cuid())
  domain    String
  country   String   @default("US")
  data      Json
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([domain, country])
  @@map("top_pages_cache")
}
```

### Data Flow

```
User enters domain (e.g. "example.com")
     │
     ▼
Frontend: GET /top-pages?domain=example.com&country=AU
     │
     ▼
Backend: normalizeDomain() → "example.com"
     │
     ▼
Check TopPagesCache (7-day TTL)
     │ miss?
     ▼
OpenAI gpt-4o-mini → estimate top 10 pages with metrics
     │ fail?
     ▼
Return error: "Failed to fetch top pages data. Please try again."
     │ success?
     ▼
Upsert cache + increment usage
     │
     ▼
Return TopPagesData to frontend
     │
     ▼
Frontend renders:
  • Summary bar (3 cards)
  • Filters row (URL search, min traffic, min keywords)
  • Sortable table with sparklines per row
  • Pagination (10 per page)
```

---

## Limitations

- [ ] Data is AI-estimated, not real crawl data — accuracy varies
- [ ] No mock fallback — requires `OPENAI_API_KEY`
- [ ] Limited to 10 pages per lookup (kept small for OpenAI response speed)
- [ ] No drill-down into individual page details (keyword breakdown per page)
- [ ] No PDF/CSV export
- [ ] No comparison between domains' top pages
- [ ] Sparklines may render slowly if many rows visible (recharts per-row overhead)
- [ ] Daily usage limits defined but not enforced

---

## How to Test

1. Ensure `OPENAI_API_KEY` is set in `.env`
2. Run migration: `npx prisma migrate dev --name add-top-pages-cache`
3. Restart backend: `cd apps/backend/api && pnpm dev`
4. Restart frontend: `cd apps/frontend/tenent-dashboard && pnpm dev`
5. Navigate to `/dashboard/top-pages` (or click "Top Pages" in sidebar)
6. Enter a domain (e.g. `google.com`) and click "Analyze"
7. Verify summary bar shows 3 metric cards
8. Verify table renders with sparklines in the Trend column
9. Click column headers to sort, use filter inputs
10. Toggle dark mode — all sections theme correctly
11. Resize to mobile — layout stacks vertically
12. Try same domain again — should load instantly from cache
