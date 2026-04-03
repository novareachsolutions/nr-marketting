# Module 8 — Position Tracking (Semrush-Style)

> **Status:** ✅ Complete
> **Completed:** 2026-04-03
> **Scope:** Backend (NestJS) + Frontend (Next.js)
> **External Dependencies:** OpenAI API (optional — falls back to mock data)

---

## Overview

Semrush-style position tracking module that monitors where a website ranks on Google for specific keywords over time. Supports adding/importing keywords, manual and scheduled rank checks (via OpenAI GPT-4o-mini estimation with mock fallback), keyword tagging, and comprehensive analytics including visibility score, estimated traffic, rankings distribution, and position change tracking. Includes 3 frontend pages: overview dashboard, rankings table with filters/bulk actions/modals, and per-keyword history detail.

---

## What Was Built

### Backend — 16 API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/projects/:id/position-tracking/keywords` | JWT + Owner | List tracked keywords with position, change, tags. Filters: page, perPage, sort, order, tagId, positionMin, positionMax, changeType, device, search |
| `POST` | `/projects/:id/position-tracking/keywords` | JWT + Owner | Add keywords to tracking. Body: `{ keywords[], device?, country?, targetUrl? }`. Enforces plan limits |
| `POST` | `/projects/:id/position-tracking/keywords/import-from-project` | JWT + Owner | Import keywords from ProjectKeyword. Body: `{ keywordIds?, all?, device?, country? }` |
| `PATCH` | `/projects/:id/position-tracking/keywords/:keywordId` | JWT + Owner | Update target URL |
| `DELETE` | `/projects/:id/position-tracking/keywords/:keywordId` | JWT + Owner | Remove keyword from tracking |
| `POST` | `/projects/:id/position-tracking/keywords/bulk-delete` | JWT + Owner | Bulk delete keywords |
| `GET` | `/projects/:id/position-tracking/tags` | JWT + Owner | List tags with keyword counts |
| `POST` | `/projects/:id/position-tracking/tags` | JWT + Owner | Create tag. Body: `{ name, color? }` |
| `DELETE` | `/projects/:id/position-tracking/tags/:tagId` | JWT + Owner | Delete tag |
| `POST` | `/projects/:id/position-tracking/keywords/bulk-tag` | JWT + Owner | Assign tag to keywords |
| `POST` | `/projects/:id/position-tracking/keywords/bulk-untag` | JWT + Owner | Remove tag from keywords |
| `GET` | `/projects/:id/position-tracking/overview` | JWT + Owner | Visibility score, traffic, avg position, distribution, changes |
| `GET` | `/projects/:id/position-tracking/overview/trend` | JWT + Owner | Time-series: visibility, traffic, avg position over N days |
| `GET` | `/projects/:id/position-tracking/keywords/:keywordId/history` | JWT + Owner | Position history for single keyword |
| `POST` | `/projects/:id/position-tracking/check-now` | JWT + Owner | Trigger immediate position check (rate limited: 1/hour) |
| `PATCH` | `/projects/:id/position-tracking/schedule` | JWT + Owner | Set rank check schedule: NONE/DAILY/WEEKLY/MONTHLY |
| Cron | Hourly | N/A | Scheduled rank checks (DAILY/WEEKLY/MONTHLY) |

### Key Features

#### Rank Checking (2-tier fallback)

| Tier | Source | Description |
|------|--------|-------------|
| 1 | **OpenAI GPT-4o-mini** | Estimates realistic Google ranking position (1-100), ranking URL, and SERP features for each keyword + domain. Batches of 20 keywords per API call |
| 2 | **Mock Data** | Deterministic hash-based positions for development/demo. 70% chance of ranking, position 1-95 |

#### Visibility Score (Semrush CTR Model)

```
CTR by position:
  1 → 31.7%    2 → 24.7%    3 → 18.6%
  4 → 13.3%    5 → 9.5%     6 → 6.2%
  7 → 4.5%     8 → 3.4%     9 → 2.6%    10 → 2.4%
  11-20 → ~1%  21-50 → ~0.5%  51+ → ~0.1%

Visibility = SUM(CTR[pos] × searchVolume) / SUM(searchVolume) × 100
```

#### Estimated Traffic

```
Traffic = SUM(CTR[pos] × searchVolume) for each tracked keyword
```

#### Rankings Distribution

Counts keywords in buckets: Top 3, 4-10, 11-20, 21-50, 51-100, Not Ranking

#### Position Changes

Compares latest vs previous check: **improved** (position decreased), **declined** (position increased), **new** (first ranking), **lost** (was ranking → null)

#### Keyword Tagging

- Create colored tags per project
- Bulk assign/remove tags to tracked keywords
- Filter rankings table by tag

#### Plan Limits

| Plan | Max Tracked Keywords Per Project |
|------|--------------------------------|
| FREE | 10 |
| PRO | 100 |
| AGENCY | 1,000 |

#### Scheduled Rank Checks

- Uses `@nestjs/schedule` with `@Cron(EVERY_HOUR)`
- Checks projects with `rankCheckSchedule != NONE`
- Verifies due based on `lastRankCheckAt` timestamp
- Executes via `setTimeout(() => ..., 0)` (non-blocking)
- Same pattern as `CrawlSchedulerService` from Site Audit module

### Frontend — 3 pages

| Route | Description |
|-------|-------------|
| `/dashboard/projects/[id]/position-tracking` | Overview dashboard — summary cards (visibility, traffic, avg position, total keywords), position changes (improved/declined/new/lost), rankings distribution bar, visibility trend chart, Check Now button, schedule selector |
| `/dashboard/projects/[id]/position-tracking/keywords` | Rankings table — sortable/filterable table with position badges, change indicators, volume, ranking URL, tags. Toolbar with Add Keywords modal (manual + import tabs), Tag Manager modal, bulk actions (tag, delete), search, filters (change type, tag, device). Pagination |
| `/dashboard/projects/[id]/position-tracking/keywords/[keywordId]` | Keyword detail — current position, change, volume, best/worst. Position trend chart (90 days, inverted bar chart). Full history table with date, position, change, ranking URL, SERP features, clicks, impressions, CTR |

---

## Schema Changes

### New Models

```prisma
model KeywordTag {
  id        String   @id @default(cuid())
  projectId String   @map("project_id")
  name      String
  color     String   @default("#6366f1")
  createdAt DateTime @default(now()) @map("created_at")
  project         Project             @relation(...)
  trackedKeywords TrackedKeywordTag[]
  @@unique([projectId, name])
  @@map("keyword_tags")
}

model TrackedKeywordTag {
  trackedKeywordId String @map("tracked_keyword_id")
  tagId            String @map("tag_id")
  trackedKeyword TrackedKeyword @relation(...)
  tag            KeywordTag     @relation(...)
  @@id([trackedKeywordId, tagId])
  @@map("tracked_keyword_tags")
}
```

### Fields Added to Existing Models

| Model | New Fields |
|-------|-----------|
| `TrackedKeyword` | `searchVolume Int?`, `tags TrackedKeywordTag[]` |
| `RankingHistory` | `rankingUrl String?`, `serpFeatures String?` |
| `Project` | `rankCheckSchedule CrawlSchedule @default(NONE)`, `lastRankCheckAt DateTime?`, `keywordTags KeywordTag[]` |

---

## File Inventory

```
Backend:
  src/position-tracking/position-tracking.module.ts     — Module registration
  src/position-tracking/position-tracking.controller.ts — 16 endpoints
  src/position-tracking/position-tracking.service.ts    — Keyword CRUD, tags, overview analytics
  src/position-tracking/rank-checker.service.ts         — OpenAI rank estimation + mock fallback
  src/position-tracking/rank-check-scheduler.service.ts — Cron-based scheduled checks
  src/position-tracking/dto/index.ts
  src/position-tracking/dto/add-keywords.dto.ts
  src/position-tracking/dto/update-keyword.dto.ts
  src/position-tracking/dto/bulk-tag.dto.ts             — BulkTagDto, CreateTagDto, BulkDeleteDto, ImportFromProjectDto
  src/position-tracking/dto/update-schedule.dto.ts

Frontend:
  types/positionTracking.ts                             — TypeScript interfaces
  hooks/usePositionTracking.ts                          — 14 React Query hooks
  pages/dashboard/projects/[id]/position-tracking/
    index.tsx + index.module.css                         — Overview dashboard
    keywords.tsx + keywords.module.css                   — Rankings table + Add Keywords modal + Tag Manager
  pages/dashboard/projects/[id]/position-tracking/keywords/
    [keywordId].tsx + [keywordId].module.css              — Keyword detail/history

Modified:
  packages/database/prisma/schema.prisma                — New models + fields
  apps/backend/api/src/app.module.ts                    — Import PositionTrackingModule
  components/layout/Sidebar.tsx                         — Added Position Tracking nav link
```

### Environment Variables

```
OPENAI_API_KEY=""    # Optional — falls back to mock data if not set
```

### Data Flow

```
User adds keywords to track
     │
     ▼
Backend: validate plan limits → create TrackedKeyword records
     │ (lookup KeywordCache for searchVolume)
     │
     ▼
User clicks "Check Now" or scheduled cron fires
     │
     ▼
RankCheckerService: group keywords by country+device
     │
     ▼
OpenAI GPT-4o-mini → estimate position, ranking URL, SERP features
     │ (fallback → mock data)
     │
     ▼
Upsert RankingHistory (one record per keyword per day)
     │
     ▼
Frontend: fetch overview → compute visibility, traffic, distribution, changes
     │
     ▼
Display: summary cards, distribution bar, trend chart, rankings table
```

---

## Remaining Limitations

- [ ] Uses OpenAI estimates, not real SERP data (swap in DataForSEO SERP API for production)
- [ ] No competitor position tracking yet (schema is extensible for this)
- [ ] No SERP screenshot capture
- [ ] No email/notification alerts for position changes
- [ ] No daily search limit enforcement per plan for rank checks
- [ ] No CSV/PDF export for position data

---

## How to Test

1. Restart backend: `cd apps/backend/api && pnpm dev`
2. Navigate to `/dashboard/projects/{id}/position-tracking`
3. See empty state → click "Go to Rankings Table"
4. Click "+ Add Keywords" → enter keywords (one per line) → Add
5. Click "Check Now" → wait a few seconds for background check
6. Refresh → see positions populate in the table
7. Check overview page → summary cards, distribution bar, changes
8. Click a keyword → see detail page with history
9. Create tags via "Manage Tags" → assign to keywords via bulk select
10. Filter by tag, change type, device
11. Set schedule to "Daily" → cron will auto-check hourly
