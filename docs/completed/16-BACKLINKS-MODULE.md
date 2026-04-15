# Module 16 — Backlinks Analytics (Semrush-Style)

> **Status:** ✅ Complete
> **Completed:** 2026-04-13
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Semrush-style single-domain backlink analytics tool. Users enter **any** domain or URL and see its complete backlink profile — total backlinks, referring domains, authority score, 12-month growth trend, top referring sites, anchor text distribution, new/lost backlinks (30 days), TLD breakdown, and category breakdown. Uses OpenAI (`gpt-4o-mini`) as the sole data source. Results cached for 7 days. Global tool (not project-scoped, though the sidebar entry accepts `projectId` context).

**Distinct from Backlink Gap:** Backlink Gap compares referring domains of you vs competitors to find link-building opportunities. Backlinks Analytics profiles a **single** domain's full backlink footprint.

---

## What Was Built

### Backend — 1 API endpoint

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/backlinks?domain=example.com&country=US` | JWT | Complete backlink profile for a single domain |

### Data Returned

| Section | Description |
|---------|-------------|
| **Overview** | `totalBacklinks`, `referringDomains`, `referringIps`, `authorityScore` (0-100), `followBacklinks`, `nofollowBacklinks`, `dofollowPercent`, `textBacklinks`, `imageBacklinks`, `newBacklinks30d`, `lostBacklinks30d` |
| **Trend** (12 months) | `month`, `backlinks`, `referringDomains`, `authorityScore` per point |
| **Top Referring Domains** (15) | `domain`, `authorityScore`, `backlinks`, `firstSeen`, `countryCode`, `followRatio`, `category` |
| **Anchor Distribution** (10) | `anchor`, `count`, `percentage` — branded, exact, partial, generic, naked URL |
| **Top Backlinks** (15) | `sourceUrl`, `sourceTitle`, `sourceAuthority`, `targetUrl`, `anchor`, `type` (follow/nofollow), `firstSeen` |
| **New Backlinks** (6) | Same shape as Top Backlinks — added in last 30 days |
| **Lost Backlinks** (4) | Same shape — removed in last 30 days |
| **TLD Distribution** (8) | `label` (`.com`, `.org`, …), `count`, `percentage` |
| **Category Distribution** (6) | `label` (Technology, News, …), `count`, `percentage` |

### Frontend — 1 page

| Route | Description |
|-------|-------------|
| `/dashboard/backlinks` | Full backlink profile dashboard with gauge, charts, tables |

#### Page Sections

1. **Domain Input Form** — Single text input + country selector + Analyze button
2. **Empty State** — Prompt to enter a domain before any analysis
3. **Domain Header Card** — SVG authority gauge (0-100) + domain name + country + last-checked badge
4. **4 Metric Cards** — Total Backlinks, Referring Domains, Follow/Nofollow %, 30-day Change (new/lost delta)
5. **Growth Trend Chart** — Recharts LineChart, 12 months, two lines (backlinks + referring domains)
6. **Two-column row**: **Anchor Text Distribution** (top 10 with progress bars) + **TLD Distribution** (8 TLDs)
7. **Top Referring Domains Table** — Domain, authority chip, backlinks, follow ratio, category, first seen
8. **Top Backlinks Table** — Source link + title, anchor, follow/nofollow chip, authority chip, first seen
9. **Two-column row**: **New Backlinks** + **Lost Backlinks** (last 30 days)
10. **Category Distribution** — 6 niches with progress bars

---

## File Inventory

```
Backend:
  src/backlinks/backlinks.service.ts        — OpenAI integration, cache, usage tracking
  src/backlinks/backlinks.controller.ts     — GET endpoint with JWT guard
  src/backlinks/backlinks.module.ts         — Module wiring

Frontend:
  types/backlinks.ts                        — TypeScript interfaces
  hooks/useBacklinks.ts                     — React Query hook
  pages/dashboard/backlinks/index.tsx       — Full page with gauge, charts, tables
  pages/dashboard/backlinks/index.module.css — Page styles

Modified:
  packages/database/prisma/schema.prisma    — BacklinksCache model + BACKLINKS enum value
  apps/backend/api/src/app.module.ts        — Registered BacklinksModule
  components/layout/Sidebar.tsx             — Added Backlinks nav link (Network icon)

Migrations:
  20260413085449_add_backlinks_cache
  20260413090136_add_backlinks_usage_metric
```

### Environment Variables
```
OPENAI_API_KEY=""         # Required — no fallback
```

### Database Schema

```prisma
model BacklinksCache {
  id        String   @id @default(cuid())
  cacheKey  String   @unique @map("cache_key")
  data      Json
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("backlinks_cache")
}

enum UsageMetric {
  ...
  BACKLINK_GAP
  BACKLINKS        // ← new
  AI_SUGGESTIONS
  ...
}
```

### Data Flow

```
User enters: example.com + country AU
     │
     ▼
Frontend: GET /backlinks?domain=example.com&country=AU
     │
     ▼
Backend: normalize domain (strip protocol, www, path)
     │
     ▼
Build cache key: "example.com|AU|bl-analytics"
     │
     ▼
Check BacklinksCache (7-day TTL)
     │ miss?
     ▼
OpenAI gpt-4o-mini → generate full profile (overview + trend + tables)
     │ fail?
     ▼
Return descriptive error
     │ success?
     ▼
Upsert cache + increment BACKLINKS usage
     │
     ▼
Frontend renders:
  • Authority gauge + domain header
  • 4 metric cards
  • 12-month growth line chart
  • Anchor distribution bars + TLD distribution bars
  • Top referring domains table
  • Top backlinks table
  • New / Lost backlinks side-by-side
  • Category distribution bars
```

---

## Use Cases

1. **Profile any competitor** — Enter any domain and instantly see its authority, link velocity, and anchor strategy
2. **Audit your own site** — Check who's linking to you, spot anchor over-optimization, monitor follow/nofollow ratio
3. **Monitor progress** — 30-day new/lost delta shows if link-building is trending up or down
4. **Evaluate link prospects** — Check a potential guest-post site's own backlink profile and authority before outreach
5. **Anchor text analysis** — Anchor distribution reveals if a site is over-optimized (too many exact-match anchors = penalty risk)
6. **Niche analysis** — Category distribution shows what kind of sites link to any given domain

---

## Limitations

- [ ] Data is AI-estimated, not real backlink data
- [ ] No mock fallback — requires `OPENAI_API_KEY`
- [ ] Limited to 15 top referring domains + 15 top backlinks per analysis
- [ ] Only 6 new / 4 lost backlinks shown per 30-day window
- [ ] No export (CSV/PDF)
- [ ] No historical snapshot tracking (each call is a fresh AI generation)
- [ ] No filtering inside tables (e.g., by country, by follow type)
- [ ] No pagination on referring domains / backlinks tables
- [ ] Cannot compare subdomains/URLs — domain level only
- [ ] Daily usage limits tracked but not enforced

---

## How to Test

1. Ensure `OPENAI_API_KEY` is set in `.env`
2. Migrations already applied: `20260413085449_add_backlinks_cache` + `20260413090136_add_backlinks_usage_metric`
3. Restart backend (required to regenerate Prisma Client with new `BacklinksCache` model and `BACKLINKS` enum value) + frontend
4. Navigate to `/dashboard/backlinks`
5. Enter a domain (e.g. `example.com`), select country, click **Analyze**
6. First call: ~30-60s OpenAI round-trip. Verify:
   - Authority gauge renders with score + color
   - 4 metric cards populate (total backlinks, referring domains, follow %, 30-day delta)
   - Growth chart renders 12 monthly points with two lines
   - Anchor distribution bars render top 10
   - TLD distribution bars render 8 TLDs
   - Top referring domains table (15 rows)
   - Top backlinks table (15 rows) with clickable source links
   - New / Lost sections (6 new, 4 lost)
   - Category distribution (6 bars)
7. Re-run same domain + country → instant from 7-day cache
8. Change country → new OpenAI call (different cache key)
9. Dark mode + mobile responsive (grid collapses to single column below 1024px)
