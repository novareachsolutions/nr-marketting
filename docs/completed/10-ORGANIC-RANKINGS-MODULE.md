# Module 10 — Organic Rankings (Semrush-Style Organic Research)

> **Status:** ✅ Complete
> **Completed:** 2026-04-06
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Semrush-style organic research tool. Users enter any domain and discover its full organic ranking profile — what keywords it ranks for, recent position changes, organic competitors, and top-performing pages. Uses OpenAI (gpt-4o-mini) as the sole data source. Results cached for 7 days per domain+country. This is a **discovery tool** (global, not project-scoped) — distinct from Position Tracking (tracks your own keywords over time) and Domain Overview (quick domain snapshot).

---

## What Was Built

### Backend — 1 API endpoint

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/organic-rankings?domain=...&country=US` | JWT | Full organic ranking data — positions, changes, competitors, pages |

### Key Features

#### Data Source: OpenAI Only (No Mock Fallback)

Single OpenAI call (gpt-4o-mini, temperature 0.3, max_tokens 3000, JSON response format) that estimates organic ranking data. If OpenAI is not configured or the call fails, a clear error is returned to the user — no mock data.

#### Caching (7-Day TTL)

- `OrganicRankingsCache` Prisma model with composite unique key `[domain, country]`
- Single `Json` column stores the entire response (positions, changes, competitors, pages)
- On cache hit within 7 days → return cached data (zero API cost)
- On cache miss → call OpenAI → upsert cache → return data

#### Domain Normalization

Input cleaned before lookup: strip protocol, `www.`, path, query, fragment, trailing dot, lowercase.

#### Usage Tracking

Uses the existing `UsageRecord` model with `ORGANIC_RANKINGS` metric. Daily period format (`YYYY-MM-DD`). Plan limits defined but not enforced (removed by request).

### Data Returned

| Section | Fields | Count |
|---------|--------|-------|
| **Summary** | `totalOrganicKeywords`, `organicMonthlyTraffic`, `organicTrafficCost`, `brandedTrafficPercent`, `nonBrandedTrafficPercent` | 1 |
| **Positions** | `keyword`, `position`, `previousPosition`, `volume`, `trafficPercent`, `trafficCost`, `url`, `serpFeatures[]`, `intent`, `kd`, `cpc`, `lastUpdated` | 10 |
| **Position Changes** | `keyword`, `changeType` (improved/declined/new/lost), `oldPosition`, `newPosition`, `change`, `volume`, `url`, `trafficImpact` | 8 |
| **Competitors** | `domain`, `commonKeywords`, `seKeywords`, `seTraffic`, `trafficCost`, `paidKeywords` | 5 |
| **Pages** | `url`, `trafficPercent`, `keywords`, `traffic` | 5 |

### Frontend — 1 page with 4 tabs

| Route | Description |
|-------|-------------|
| `/dashboard/organic-rankings` | Full organic research dashboard with tab-based UI |

#### Page Sections

1. **Search Form** — Domain input + country selector (11 countries) + Analyze button
2. **Summary Metrics Bar** (always visible) — 4 cards: Organic Keywords, Monthly Traffic, Traffic Cost, Non-Branded %
3. **Tab Navigation** — Positions | Position Changes | Competitors | Pages
4. **Tab Content** — Conditionally rendered based on active tab

#### Tab 1: Positions (default)
- **Filters**: keyword text search, position range (min/max), min volume, intent dropdown
- **Sortable columns**: click any header to toggle asc/desc (keyword, position, volume, traffic %, cost, intent, KD, CPC)
- **Pagination**: 25 rows per page with Previous/Next + page info
- **Visual elements**: position color badges (green→red by range), intent badges (I/N/C/T), SERP feature pill tags (FS, SL, PAA, IMG, VID, etc.), KD difficulty badges

#### Tab 2: Position Changes
- **Filter**: change type dropdown (All / Improved / Declined / New / Lost)
- **Table**: keyword, change type badge (color-coded), old→new position with arrow, change value (+/-), volume, URL, traffic impact
- **Colors**: improved=green, declined=red, new=blue, lost=gray

#### Tab 3: Competitors
- **Scatter chart**: Recharts `ScatterChart` — X=SE Keywords, Y=SE Traffic, bubble size=Common Keywords
- **Table**: domain, common keywords, SE keywords, SE traffic, traffic cost, paid keywords

#### Tab 4: Pages
- **Table**: URL, traffic % (with inline horizontal bar), keywords count, traffic
- Sorted by traffic descending

#### Navigation
Added to main sidebar after "Domain Overview" with chart icon (📈). Active state matches `/dashboard/organic-rankings` prefix.

---

## File Inventory

```
Backend:
  src/organic-rankings/organic-rankings.service.ts      — OpenAI integration, caching, domain normalization,
                                                          usage tracking (no mock fallback)
  src/organic-rankings/organic-rankings.controller.ts   — GET endpoint with JWT guard
  src/organic-rankings/organic-rankings.module.ts       — Module wiring
  src/organic-rankings/dto/organic-rankings-query.dto.ts — Validation DTO
  src/organic-rankings/dto/index.ts                     — DTO re-export

Frontend:
  types/organic-rankings.ts                             — TypeScript interfaces (OrganicRankingsData,
                                                          OrganicRankingPosition, OrganicRankingChange,
                                                          OrganicRankingCompetitor, OrganicRankingPage)
  hooks/useOrganicRankings.ts                           — React Query hook
  pages/dashboard/organic-rankings/index.tsx            — Full page with 4 tabs, filters, sorting, charts
  pages/dashboard/organic-rankings/index.module.css     — Page styles (responsive, dark mode)

Modified:
  packages/database/prisma/schema.prisma                — OrganicRankingsCache model + ORGANIC_RANKINGS enum
  apps/backend/api/src/app.module.ts                    — Registered OrganicRankingsModule
  apps/backend/api/src/common/constants/plan-limits.ts  — Added maxOrganicRankingsPerDay
  components/layout/Sidebar.tsx                         — Added Organic Rankings nav link
```

### Environment Variables
```
OPENAI_API_KEY=""         # Required — no fallback, will error if not set
```

### Database Schema

```prisma
model OrganicRankingsCache {
  id        String   @id @default(cuid())
  domain    String
  country   String   @default("US")
  data      Json     // Full OrganicRankingsData response
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([domain, country])
  @@map("organic_rankings_cache")
}
```

### Data Flow

```
User enters domain (e.g. "semrush.com")
     │
     ▼
Frontend: GET /organic-rankings?domain=semrush.com&country=AU
     │
     ▼
Backend: normalizeDomain() → "semrush.com"
     │
     ▼
Check OrganicRankingsCache (7-day TTL)
     │ miss?
     ▼
OpenAI gpt-4o-mini → estimate positions, changes, competitors, pages
     │ fail?
     ▼
Return error: "Failed to fetch organic rankings. Please try again."
     │ success?
     ▼
Upsert cache (single Json column) + increment usage counter
     │
     ▼
Return OrganicRankingsData to frontend
     │
     ▼
Frontend renders:
  • Summary metrics bar (4 cards)
  • Tab 1: Positions table (sortable, filterable, paginated)
  • Tab 2: Position Changes table (with change badges)
  • Tab 3: Competitors scatter chart + table
  • Tab 4: Pages table with traffic bars
```

---

## Limitations

- [ ] Data is AI-estimated, not real SERP data — accuracy varies by domain fame
- [ ] No mock fallback — requires a valid `OPENAI_API_KEY` to function
- [ ] Limited to 10 positions, 8 changes, 5 competitors, 5 pages per lookup (kept small for OpenAI response speed)
- [ ] No historical comparison (each lookup is a snapshot, can't compare week-over-week)
- [ ] No PDF/CSV export of organic rankings data
- [ ] No integration with project system (can't auto-import discovered keywords to a project)
- [ ] Position changes are estimated by OpenAI, not tracked from real SERP history
- [ ] Daily usage limits defined in plan-limits.ts but not currently enforced

---

## How to Test

1. Ensure `OPENAI_API_KEY` is set in your `.env` file
2. Run database migration: `npx prisma migrate dev --name add-organic-rankings-cache`
3. Restart backend: `cd apps/backend/api && pnpm dev`
4. Restart frontend: `cd apps/frontend/tenent-dashboard && pnpm dev`
5. Navigate to `/dashboard/organic-rankings` (or click "Organic Rankings" in sidebar)
6. Enter a domain (e.g. `google.com`) and click "Analyze"
7. Verify summary bar shows 4 metric cards
8. **Positions tab**: verify table renders, click column headers to sort, use filters
9. **Position Changes tab**: switch tab, filter by change type
10. **Competitors tab**: verify scatter chart + table render
11. **Pages tab**: verify table with traffic % bars
12. Toggle dark mode — all sections should theme correctly
13. Resize to mobile — layout stacks vertically
14. Try same domain again — should load instantly from cache
