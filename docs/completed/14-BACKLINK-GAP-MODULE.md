# Module 14 — Backlink Gap (Semrush-Style)

> **Status:** ✅ Complete
> **Completed:** 2026-04-06
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Semrush-style backlink gap analysis tool. Users enter their domain + up to 4 competitors and see which referring domains link to competitors but not to them — identifying link-building opportunities. Shows a backlink growth trend chart + a referring domains table with gap types (Best/Weak/Strong/Shared/Unique). Uses OpenAI (gpt-4o-mini) as the sole data source. Results cached for 7 days. Global tool (not project-scoped).

**Distinct from Keyword Gap:** Keyword Gap compares keyword rankings; Backlink Gap compares referring domain profiles.

---

## What Was Built

### Backend — 1 API endpoint

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/backlink-gap?domains=you.com,rival.com&country=US` | JWT | Backlink gap — trend + 15 referring domains with gap types |

### Key Feature: 5 Backlink Gap Types

| Type | Meaning | Action |
|------|---------|--------|
| **Best** | Links to all competitors but NOT you | Top outreach targets |
| **Weak** | Links to you less than competitors | Strengthen relationship |
| **Strong** | Links to you but NOT competitors | Your advantage — maintain |
| **Shared** | Links to you AND competitors | Common in niche |
| **Unique** | Links to only one specific domain | Exclusive relationship |

### Data Returned

| Section | Description |
|---------|-------------|
| **Summary** | `totalReferringDomains`, `best`, `weak`, `strong`, `shared`, `unique` (counts) |
| **Backlink Trend** | 6-month trend data with backlink count per domain per month |
| **Referring Domains** (15 items) | `domain`, `authorityScore` (0-100), `monthlyVisits`, `matches` (how many analyzed domains it links to), `backlinksPerDomain` (map), `gapType` |

### Frontend — 1 page

| Route | Description |
|-------|-------------|
| `/dashboard/backlink-gap` | Backlink gap analysis with trend chart + gap tabs + table |

#### Page Sections

1. **Domain Inputs** — "Your Domain" + up to 4 competitors, add/remove buttons, country selector, "Find Prospects" button
2. **Summary Cards** (5 clickable) — Best, Weak, Strong, Shared, Unique with counts
3. **Backlink Growth Trend Chart** — recharts LineChart, one line per domain (6 months)
4. **Gap Type Tabs** — [All] [Best] [Weak] [Strong] [Shared] [Unique] with counts
5. **Referring Domains Table** (sortable, paginated 15/page):
   - Domain, Authority (color badge), Monthly Visits, Matches (X/N)
   - Backlink count per analyzed domain (highest highlighted green)
   - Gap type badge
6. **Pagination**

---

## File Inventory

```
Backend:
  src/backlink-gap/backlink-gap.service.ts        — OpenAI integration, cache, usage tracking
  src/backlink-gap/backlink-gap.controller.ts     — GET endpoint with JWT guard
  src/backlink-gap/backlink-gap.module.ts         — Module wiring
  src/backlink-gap/dto/backlink-gap-query.dto.ts  — Validation DTO
  src/backlink-gap/dto/index.ts                   — DTO re-export

Frontend:
  types/backlink-gap.ts                           — TypeScript interfaces
  hooks/useBacklinkGap.ts                         — React Query hook
  pages/dashboard/backlink-gap/index.tsx          — Full page with chart, tabs, table
  pages/dashboard/backlink-gap/index.module.css   — Page styles

Modified:
  packages/database/prisma/schema.prisma                — BacklinkGapCache model + BACKLINK_GAP enum
  apps/backend/api/src/app.module.ts                    — Registered BacklinkGapModule
  apps/backend/api/src/common/constants/plan-limits.ts  — Added maxBacklinkGapPerDay
  components/layout/Sidebar.tsx                         — Added Backlink Gap nav link
```

### Environment Variables
```
OPENAI_API_KEY=""         # Required — no fallback
```

### Database Schema

```prisma
model BacklinkGapCache {
  id        String   @id @default(cuid())
  cacheKey  String   @unique @map("cache_key")
  data      Json
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("backlink_gap_cache")
}
```

### Data Flow

```
User enters: yourdomain.com + competitor1.com, competitor2.com
     │
     ▼
Frontend: GET /backlink-gap?domains=yourdomain.com,competitor1.com,competitor2.com&country=AU
     │
     ▼
Backend: normalize domains, validate 2-5 count
     │
     ▼
Build cache key: sort → "competitor1.com|competitor2.com|yourdomain.com|AU|blgap"
     │
     ▼
Check BacklinkGapCache (7-day TTL)
     │ miss?
     ▼
OpenAI → generate referring domains with gap types + backlink trend
     │ fail?
     ▼
Return descriptive error
     │ success?
     ▼
Upsert cache + increment usage
     │
     ▼
Frontend renders:
  • 5 clickable summary cards
  • Backlink growth trend line chart
  • Gap type tabs with counts
  • Referring domains table with per-domain backlink counts
```

---

## Use Cases

1. **Find link-building targets** — "Best" referring domains link to all competitors but not you → top outreach priorities
2. **Strengthen weak links** — "Weak" domains link to you less than competitors → request more/better links
3. **Protect advantages** — "Strong" domains only link to you → maintain these relationships
4. **Identify niche authorities** — High "Matches" count = popular link source in your niche → must-have link
5. **Monitor backlink growth** — Trend chart shows if competitors are building links faster than you

---

## Limitations

- [ ] Data is AI-estimated, not real backlink data
- [ ] No mock fallback — requires `OPENAI_API_KEY`
- [ ] Limited to 15 referring domains per analysis
- [ ] No export (CSV/PDF)
- [ ] No "Send to Link Building Tool" integration
- [ ] Cannot compare subdomains/URLs — domain level only
- [ ] No follow/nofollow link type filtering
- [ ] Daily usage limits defined but not enforced

---

## How to Test

1. Ensure `OPENAI_API_KEY` is set in `.env`
2. Run migration: `npx prisma migrate dev --name add-backlink-gap-cache`
3. Restart backend + frontend
4. Navigate to `/dashboard/backlink-gap`
5. Enter your domain + 1 competitor, click "Find Prospects"
6. Verify summary cards, trend chart, and table render
7. Click gap type tabs → table filters
8. Click column headers to sort
9. Highest backlink count per row highlighted green
10. Dark mode + mobile responsive
11. Same domains → instant from cache
