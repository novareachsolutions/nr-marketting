# Module 9 — Domain Overview (Semrush-Style)

> **Status:** ✅ Complete
> **Completed:** 2026-04-03
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Semrush-style domain analysis tool. Users enter any domain and get a full analytics dashboard — authority score, organic/paid traffic estimates, backlinks summary, keyword intent & position distributions, top organic keywords, top pages, competitors, and country-level traffic breakdown. Uses OpenAI (gpt-4o-mini) to estimate domain metrics, with deterministic mock fallback. Results cached for 7 days per domain+country pair. Rate-limited by plan tier.

---

## What Was Built

### Backend — 1 API endpoint

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/domain-overview?domain=...&country=US` | JWT | Full domain analytics — authority, traffic, backlinks, keywords, competitors, distributions |

### Key Features

#### Data Source: OpenAI Estimation

Single OpenAI call (gpt-4o-mini, temperature 0.3, JSON response format) that estimates all domain metrics in one request. The prompt asks GPT to provide realistic estimates based on its knowledge of the domain. For well-known domains, results are reasonably accurate; for unknown domains, conservative estimates are returned.

#### Caching (7-Day TTL)

- `DomainOverviewCache` Prisma model with composite unique key `[domain, country]`
- On cache hit within 7 days → return cached data (zero API cost)
- On cache miss → call OpenAI → upsert cache → return data
- 7-day TTL chosen because domain-level metrics change slowly

#### Domain Normalization

Input is cleaned before lookup:
- Strip protocol (`https://`, `http://`)
- Strip `www.` prefix
- Strip path, query string, fragment
- Strip trailing dot
- Lowercase

So `https://www.Example.com/page?q=1` → `example.com`

#### Plan-Based Rate Limiting

| Plan | Daily Limit |
|------|------------|
| FREE | 3 lookups/day |
| PRO | 50 lookups/day |
| AGENCY | Unlimited |

Uses the existing `UsageRecord` model with a new `DOMAIN_OVERVIEWS` metric. Period format is `YYYY-MM-DD` (daily tracking).

#### Mock Data Fallback

If OpenAI is not configured or the API call fails, deterministic mock data is generated using a `simpleHash(domain)` function. This ensures:
- Consistent results for the same domain (no random fluctuation)
- Realistic-looking numbers across all metrics
- The feature works in development without an API key

### Metrics Returned

| Category | Fields |
|----------|--------|
| **Authority** | `authorityScore` (0-100), `authorityTrend` (6-month array) |
| **Organic Search** | `organicKeywords`, `organicTraffic`, `organicTrafficCost`, `organicTrafficTrend` (12-month) |
| **Paid Search** | `paidKeywords`, `paidTraffic`, `paidTrafficCost` |
| **Backlinks** | `totalBacklinks`, `referringDomains`, `followBacklinks`, `nofollowBacklinks` |
| **Intent Distribution** | `informational`, `navigational`, `commercial`, `transactional` (percentages) |
| **Position Distribution** | `top3`, `pos4_10`, `pos11_20`, `pos21_50`, `pos51_100` (keyword counts) |
| **Top Organic Keywords** | 10 keywords with `position`, `volume`, `trafficPercent`, `url` |
| **Top Organic Pages** | 10 pages with `traffic`, `keywords` count |
| **Competitors** | 10 competitors with `commonKeywords`, `organicKeywords`, `organicTraffic` |
| **Country Distribution** | Top 5 countries with `trafficShare` percentage |

### Frontend — 1 page (9 sections)

| Route | Description |
|-------|-------------|
| `/dashboard/domain-overview` | Full domain analysis dashboard |

#### Page Sections

1. **Search Form** — Domain input + country selector (11 countries) + Analyze button
2. **Authority Score** — SVG circle gauge (0-100, color-coded green/yellow/orange/red) + domain name + 6-month trend bars
3. **Metrics Grid** (3 columns) — Organic Search card (keywords, traffic, cost) | Paid Search card | Backlinks card (with follow/nofollow ratio bar)
4. **Traffic Trend Chart** — Recharts `LineChart` showing 12-month organic traffic
5. **Intent Distribution** — Recharts `PieChart` (4 slices: informational/navigational/commercial/transactional)
6. **Position Distribution** — Recharts `BarChart` (5 bars: Top 3 / 4-10 / 11-20 / 21-50 / 51-100)
7. **Top Organic Keywords Table** — 10 rows with keyword, position badge, volume, traffic %, URL
8. **Top Organic Pages Table** — 10 rows with URL, traffic, keyword count
9. **Main Organic Competitors Table** — 10 rows with domain, common keywords, organic keywords, traffic
10. **Country Distribution** — Horizontal bars with country code + percentage

#### Navigation

Added to main sidebar after "Keyword Research" with globe icon (🌐). Active state matches `/dashboard/domain-overview` prefix.

---

## File Inventory

```
Backend:
  src/domain-overview/domain-overview.service.ts      — OpenAI integration, caching, mock fallback,
                                                        usage tracking, domain normalization
  src/domain-overview/domain-overview.controller.ts   — GET endpoint with JWT guard
  src/domain-overview/domain-overview.module.ts       — Module wiring
  src/domain-overview/dto/domain-overview-query.dto.ts — Validation DTO
  src/domain-overview/dto/index.ts                    — DTO re-export

Frontend:
  types/domain-overview.ts                            — TypeScript interfaces (DomainOverviewData)
  hooks/useDomainOverview.ts                          — React Query hook
  pages/dashboard/domain-overview/index.tsx           — Full page with all 10 sections + recharts
  pages/dashboard/domain-overview/index.module.css    — Page styles (responsive, dark mode)

Modified:
  packages/database/prisma/schema.prisma              — DomainOverviewCache model + DOMAIN_OVERVIEWS enum
  apps/backend/api/src/app.module.ts                  — Registered DomainOverviewModule
  apps/backend/api/src/common/constants/plan-limits.ts — Added maxDomainOverviewsPerDay
  components/layout/Sidebar.tsx                       — Added Domain Overview nav link
  apps/frontend/tenent-dashboard/package.json         — Added recharts dependency
```

### Environment Variables
```
OPENAI_API_KEY=""         # Required for real estimates — falls back to mock data if not set
```

### Database Schema

```prisma
model DomainOverviewCache {
  id                   String   @id @default(cuid())
  domain               String
  country              String   @default("US")
  authorityScore       Int?
  authorityTrend       Json?
  organicKeywords      Int?
  organicTraffic       Int?
  organicTrafficCost   Float?
  organicTrafficTrend  Json?
  paidKeywords         Int?
  paidTraffic          Int?
  paidTrafficCost      Float?
  totalBacklinks       Int?
  referringDomains     Int?
  followBacklinks      Int?
  nofollowBacklinks    Int?
  intentDistribution   Json?
  positionDistribution Json?
  topOrganicKeywords   Json?
  topOrganicPages      Json?
  topCompetitors       Json?
  countryDistribution  Json?
  updatedAt            DateTime @updatedAt

  @@unique([domain, country])
  @@map("domain_overview_cache")
}
```

### Data Flow

```
User enters domain (e.g. "semrush.com")
     │
     ▼
Frontend: GET /domain-overview?domain=semrush.com&country=AU
     │
     ▼
Backend: normalizeDomain() → "semrush.com"
     │
     ▼
Check plan usage limit (FREE:3/day, PRO:50, AGENCY:unlimited)
     │
     ▼
Check DomainOverviewCache (7-day TTL)
     │ miss?
     ▼
OpenAI gpt-4o-mini → estimate all metrics in single JSON response
     │ fail?
     ▼
Mock data fallback (deterministic via simpleHash)
     │
     ▼
Upsert cache + increment daily usage counter
     │
     ▼
Return DomainOverviewData to frontend
     │
     ▼
Frontend renders:
  • Authority gauge (SVG)
  • 3-column metrics cards
  • Traffic trend line chart (recharts)
  • Intent pie chart + Position bar chart
  • 3 data tables (keywords, pages, competitors)
  • Country distribution bars
```

---

## Limitations

- [ ] Data is AI-estimated, not real crawl/API data — accuracy varies by domain fame
- [ ] No historical tracking (each lookup is a snapshot, no trend comparison across lookups)
- [ ] No PDF export of domain overview report
- [ ] No competitor comparison view (analyze multiple domains side-by-side)
- [ ] No integration with project system (can't auto-import top keywords to a project)
- [ ] Recharts adds ~170KB to bundle (only loaded on this page via `next/dynamic`)

---

## How to Test

1. Run database migration: `npx prisma migrate dev --name add-domain-overview-cache`
2. Restart backend: `cd apps/backend/api && pnpm dev`
3. Restart frontend: `cd apps/frontend/tenent-dashboard && pnpm dev`
4. Navigate to `/dashboard/domain-overview` (or click "Domain Overview" in sidebar)
5. Enter a domain (e.g. `google.com`) and click "Analyze"
6. Verify all sections render: authority gauge, metrics cards, charts, tables
7. Toggle dark mode — all sections should theme correctly
8. Resize to mobile — grid collapses to single column
9. Try without `OPENAI_API_KEY` — should show mock data
10. Try exceeding daily limit (FREE: 3) — should show error message
