# Module 12 — Compare Domains (Semrush-Style)

> **Status:** ✅ Complete
> **Completed:** 2026-04-06
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Semrush-style domain comparison tool. Users enter 2-5 domains and see them compared side-by-side across key SEO metrics — authority score, organic traffic, keywords, backlinks, traffic cost — plus visual charts showing traffic trends, intent distribution, keyword overlap, and common keywords with per-domain position badges. Uses OpenAI (gpt-4o-mini) as the sole data source. Results cached for 7 days. Global tool (not project-scoped).

---

## What Was Built

### Backend — 1 API endpoint

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/compare-domains?domains=a.com,b.com&country=US` | JWT | Side-by-side comparison of 2-5 domains |

### Key Features

#### Multi-Domain Input

Accepts 2-5 comma-separated domains. Each domain is normalized (strip protocol, www, path, lowercase). Validates minimum 2, maximum 5.

#### Data Source: OpenAI Only

Single OpenAI call (gpt-4o-mini, temperature 0.3, max_tokens 4000, JSON response format, 120s timeout). Returns metrics for each domain, keyword overlap, common keywords, and intent comparison. On failure → throws error (no mock fallback).

#### Smart Cache Key

Cache key = sorted domains alphabetically + country, joined with `|`. Example: `"a.com|b.com|US"`. This ensures `a.com,b.com` and `b.com,a.com` hit the same cache entry. Uses `CompareDomainCache` model with a single `cacheKey` unique field instead of the composite `[domain, country]` pattern used by other modules.

#### Caching (7-Day TTL)

- `CompareDomainCache` Prisma model with unique `cacheKey`
- Single `Json data` column stores entire response
- Cache hit → instant return, cache miss → OpenAI call → upsert cache

#### Usage Tracking

Uses `UsageRecord` with `COMPARE_DOMAINS` metric. Plan limits defined (FREE: 3/day, PRO: 50, AGENCY: unlimited).

### Data Returned

| Section | Description |
|---------|-------------|
| **domains[]** | Per-domain metrics: `authorityScore`, `organicKeywords`, `organicTraffic`, `organicTrafficCost`, `paidKeywords`, `paidTraffic`, `backlinks`, `referringDomains`, `trafficTrend` (6 months) |
| **keywordOverlap** | `shared` (keywords all rank for), `unique` (per-domain unique count), `totalUniverse` |
| **commonKeywords[]** | 10 keywords with `volume` and `positions` (per-domain position map) |
| **intentComparison** | Per-domain intent distribution: `informational`, `navigational`, `commercial`, `transactional` (percentages) |

### Frontend — 1 page with 5 sections

| Route | Description |
|-------|-------------|
| `/dashboard/compare-domains` | Full domain comparison dashboard |

#### Page Sections

1. **Domain Inputs** — 2-5 input fields with color dots, "Add Domain" button (max 5), remove buttons (min 2), country selector, Compare button
2. **Side-by-Side Metrics Table** — 8 metric rows (Authority, Organic KW, Organic Traffic, Traffic Cost, Paid KW, Paid Traffic, Backlinks, Referring Domains), one column per domain, highest value highlighted in green
3. **Traffic Trend Chart** — recharts `LineChart` with one line per domain (color-matched), 6-month overlay
4. **Keywords by Intent Chart** — recharts grouped `BarChart` comparing intent distribution across all domains
5. **Keyword Overlap Cards** — Shared count, unique per domain, total universe
6. **Common Keywords Table** — 10 keywords with volume and per-domain position badges (color-coded)

#### Domain Colors

5-color palette assigned by input order: `#6366f1` (indigo), `#f59e0b` (amber), `#22c55e` (green), `#ef4444` (red), `#8b5cf6` (purple). Used consistently across inputs, table headers, chart lines, and legend.

#### Navigation

Added to main sidebar after "Top Pages" with balance icon (⚖️).

---

## File Inventory

```
Backend:
  src/compare-domains/compare-domains.service.ts        — OpenAI integration, smart cache key,
                                                          multi-domain normalization, usage tracking
  src/compare-domains/compare-domains.controller.ts     — GET endpoint with JWT guard
  src/compare-domains/compare-domains.module.ts         — Module wiring
  src/compare-domains/dto/compare-domains-query.dto.ts  — Validation DTO
  src/compare-domains/dto/index.ts                      — DTO re-export

Frontend:
  types/compare-domains.ts                              — TypeScript interfaces (CompareDomainData,
                                                          DomainMetrics, CommonKeyword, KeywordOverlap)
  hooks/useCompareDomains.ts                            — React Query hook
  pages/dashboard/compare-domains/index.tsx             — Full page with charts, tables, dynamic inputs
  pages/dashboard/compare-domains/index.module.css      — Page styles (responsive, dark mode)

Modified:
  packages/database/prisma/schema.prisma                — CompareDomainCache model + COMPARE_DOMAINS enum
  apps/backend/api/src/app.module.ts                    — Registered CompareDomainsModule
  apps/backend/api/src/common/constants/plan-limits.ts  — Added maxCompareDomainsPerDay
  components/layout/Sidebar.tsx                         — Added Compare Domains nav link
```

### Environment Variables
```
OPENAI_API_KEY=""         # Required — no fallback
```

### Database Schema

```prisma
model CompareDomainCache {
  id        String   @id @default(cuid())
  cacheKey  String   @unique @map("cache_key")
  data      Json
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("compare_domain_cache")
}
```

### Data Flow

```
User enters 2-5 domains (e.g. "google.com, bing.com, yahoo.com")
     │
     ▼
Frontend: GET /compare-domains?domains=google.com,bing.com,yahoo.com&country=AU
     │
     ▼
Backend: normalize each domain, validate 2-5 count
     │
     ▼
Build cache key: sort domains → "bing.com|google.com|yahoo.com|AU"
     │
     ▼
Check CompareDomainCache (7-day TTL)
     │ miss?
     ▼
OpenAI gpt-4o-mini → estimate metrics for all domains + overlap + common keywords
     │ fail?
     ▼
Return error: "Failed to compare domains. Please try again."
     │ success?
     ▼
Upsert cache + increment usage
     │
     ▼
Return CompareDomainData to frontend
     │
     ▼
Frontend renders:
  • Side-by-side metrics table (highest highlighted)
  • Traffic trend line chart (overlaid per domain)
  • Intent comparison grouped bar chart
  • Keyword overlap cards
  • Common keywords table with position badges
```

---

## Use Cases

1. **Competitor benchmarking** — Compare your site against top 3 rivals to see who leads in traffic, authority, backlinks
2. **Content gap discovery** — Keyword overlap shows how many unique keywords competitors have that you don't
3. **Traffic trend monitoring** — Overlaid line chart reveals if a competitor is growing faster than you
4. **Intent strategy** — Compare what percentage of each domain's keywords are transactional vs informational
5. **Common keyword positions** — See exactly where you rank vs competitors for the same keywords

---

## Limitations

- [ ] Data is AI-estimated, not real SERP data — accuracy varies by domain fame
- [ ] No mock fallback — requires `OPENAI_API_KEY`
- [ ] Limited to 10 common keywords and 6-month trends (kept small for OpenAI response speed)
- [ ] No Venn diagram visualization (uses cards instead)
- [ ] No PDF/CSV export of comparison
- [ ] No saved comparisons (each lookup is ephemeral, though cached for 7 days)
- [ ] Cache key is order-independent but not subset-aware (comparing A+B vs A+B+C creates separate cache entries)
- [ ] Daily usage limits defined but not enforced

---

## How to Test

1. Ensure `OPENAI_API_KEY` is set in `.env`
2. Run migration: `npx prisma migrate dev --name add-compare-domains-cache`
3. Restart backend: `cd apps/backend/api && pnpm dev`
4. Restart frontend: `cd apps/frontend/tenent-dashboard && pnpm dev`
5. Navigate to `/dashboard/compare-domains` (or click "Compare Domains" in sidebar)
6. Enter 2 domains (e.g. `google.com` and `bing.com`) and click "Compare"
7. Verify side-by-side table renders with highest values highlighted green
8. Verify traffic trend chart shows overlaid lines per domain
9. Verify intent comparison bar chart renders
10. Verify keyword overlap cards show shared + unique counts
11. Verify common keywords table shows position badges per domain
12. Click "+ Add Domain" to add a 3rd domain, compare again
13. Toggle dark mode — all sections theme correctly
14. Resize to mobile — layout stacks vertically
15. Try same domains again — should load instantly from cache
16. Try reversed order (b.com, a.com) — should also hit cache
