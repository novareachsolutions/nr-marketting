# Module 13 — Keyword Gap (Semrush-Style)

> **Status:** ✅ Complete
> **Completed:** 2026-04-06
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Semrush-style keyword gap analysis tool. Users enter their domain + up to 4 competitor domains and see a detailed keyword-level comparison — which keywords each domain ranks for, where you're missing/weak/strong/unique, with per-keyword positions, volume, KD%, intent, and CPC. The first domain is treated as "you" and all gap types are relative to it. Uses OpenAI (gpt-4o-mini) as the sole data source. Results cached for 7 days. Global tool (not project-scoped).

**Distinct from other tools:**
- **Compare Domains** = domain-level metrics side-by-side (authority, traffic, backlinks)
- **Keyword Gap** = keyword-level deep dive (which specific keywords each domain ranks for, gap classification)

---

## What Was Built

### Backend — 1 API endpoint

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/keyword-gap?domains=you.com,rival.com&country=US` | JWT | Keyword gap analysis — 15 keywords with gap type classification |

### Key Feature: 7 Gap Types

| Type | Meaning | Action |
|------|---------|--------|
| **Shared** | All entered domains rank for this keyword | Battlefield — monitor closely |
| **Missing** | All competitors rank, you don't | Highest priority — create content |
| **Weak** | You rank lower than all competitors | Optimize existing pages |
| **Strong** | You rank higher than all competitors | Your strengths — protect |
| **Untapped** | You don't rank, but at least 1 competitor does | New content opportunities |
| **Unique** | Only you rank, no competitors do | Your competitive advantage |

### Data Source: OpenAI Only

Single OpenAI call (gpt-4o-mini, temperature 0.3, max_tokens 3000, JSON response format, 120s timeout). Returns 15 keywords with positions per domain and pre-classified gap type. On failure → throws descriptive error (no mock fallback).

### Caching (7-Day TTL)

- `KeywordGapCache` Prisma model with unique `cacheKey`
- Cache key = sorted domains + country + `|gap` suffix. E.g. `"a.com|b.com|US|gap"`
- Ensures order-independent cache hits

### Data Returned

| Section | Description |
|---------|-------------|
| **Summary** | `totalKeywords`, `shared`, `missing`, `weak`, `strong`, `untapped`, `unique` (counts) |
| **Keywords** (15 items) | `keyword`, `volume`, `kd` (0-100), `cpc`, `intent`, `positions` (per-domain map of position or null), `gapType` |

### Frontend — 1 page

| Route | Description |
|-------|-------------|
| `/dashboard/keyword-gap` | Full keyword gap analysis with gap type tabs + filterable table |

#### Page Sections

1. **Domain Inputs** — "Your Domain" (first) + up to 4 "Competitor" inputs with color dots, add/remove buttons, country selector, Compare button
2. **Summary Cards** (7 clickable) — All, Shared, Missing, Weak, Strong, Untapped, Unique. Each shows count and acts as a filter when clicked
3. **Filters Row** — Keyword search, intent dropdown, min volume, max KD%
4. **Gap Type Tabs** — Same 7 types with counts, active tab filters the table
5. **Keyword Table** (sortable, paginated 15/page):
   - Keyword, Volume, KD (color badge), CPC, Intent (I/N/C/T badge)
   - One position column per domain (color-coded, best position highlighted with green ring)
   - Gap type badge per row (color-coded: shared=indigo, missing=red, weak=orange, strong=green, untapped=blue, unique=purple)
6. **Pagination** — Previous/Next + page info

#### Visual Features

- **Position highlighting**: Best (lowest non-null) position in each row gets a green ring/outline
- **Null positions**: Shown as "--" (domain doesn't rank for this keyword)
- **Gap type badges**: Color-coded per type for instant recognition
- **Domain colors**: 5-color palette consistent across inputs and table headers

#### Navigation

Added to main sidebar after "Compare Domains" with shuffle icon (🔀).

---

## File Inventory

```
Backend:
  src/keyword-gap/keyword-gap.service.ts        — OpenAI integration, gap type classification,
                                                  sorted cache key, usage tracking
  src/keyword-gap/keyword-gap.controller.ts     — GET endpoint with JWT guard
  src/keyword-gap/keyword-gap.module.ts         — Module wiring
  src/keyword-gap/dto/keyword-gap-query.dto.ts  — Validation DTO
  src/keyword-gap/dto/index.ts                  — DTO re-export

Frontend:
  types/keyword-gap.ts                          — TypeScript interfaces (KeywordGapData, GapKeyword,
                                                  GapSummary, GapType, SearchIntent)
  hooks/useKeywordGap.ts                        — React Query hook
  pages/dashboard/keyword-gap/index.tsx         — Full page with gap tabs, filters, sortable table
  pages/dashboard/keyword-gap/index.module.css  — Page styles (gap badges, responsive, dark mode)

Modified:
  packages/database/prisma/schema.prisma                — KeywordGapCache model + KEYWORD_GAP enum
  apps/backend/api/src/app.module.ts                    — Registered KeywordGapModule
  apps/backend/api/src/common/constants/plan-limits.ts  — Added maxKeywordGapPerDay
  components/layout/Sidebar.tsx                         — Added Keyword Gap nav link
```

### Environment Variables
```
OPENAI_API_KEY=""         # Required — no fallback
```

### Database Schema

```prisma
model KeywordGapCache {
  id        String   @id @default(cuid())
  cacheKey  String   @unique @map("cache_key")
  data      Json
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("keyword_gap_cache")
}
```

### Data Flow

```
User enters: yourdomain.com + competitor1.com, competitor2.com
     │
     ▼
Frontend: GET /keyword-gap?domains=yourdomain.com,competitor1.com,competitor2.com&country=AU
     │
     ▼
Backend: normalize each domain, validate 2-5 count
     │
     ▼
Build cache key: sort → "competitor1.com|competitor2.com|yourdomain.com|AU|gap"
     │
     ▼
Check KeywordGapCache (7-day TTL)
     │ miss?
     ▼
OpenAI gpt-4o-mini → generate 15 keywords with positions per domain + gap types
     │ fail?
     ▼
Return descriptive error with details
     │ success?
     ▼
Upsert cache + increment usage
     │
     ▼
Return KeywordGapData to frontend
     │
     ▼
Frontend renders:
  • 7 clickable summary cards (All/Shared/Missing/Weak/Strong/Untapped/Unique)
  • Gap type tabs with counts
  • Filterable, sortable keyword table
  • Per-domain position columns with best highlighted
  • Gap type badges per row
```

---

## Use Cases

1. **Find content gaps** — "Missing" keywords show exactly what competitors rank for that you don't → direct content creation targets
2. **Prioritize optimization** — "Weak" keywords are pages you already have but need to improve → quick wins
3. **Discover opportunities** — "Untapped" keywords are low-hanging fruit where only 1 competitor ranks → less competition
4. **Protect strengths** — "Strong" and "Unique" keywords show your competitive advantage → don't neglect these
5. **Plan SEO campaigns** — Filter by intent (transactional keywords = revenue) + low KD% = best ROI targets
6. **PPC research** — Find keywords where competitors rank organically but no one advertises → potential ad opportunities

---

## Limitations

- [ ] Data is AI-estimated, not real SERP data — accuracy varies by domain fame
- [ ] No mock fallback — requires `OPENAI_API_KEY`
- [ ] Limited to 15 keywords per analysis (kept small for OpenAI response speed)
- [ ] No keyword export (CSV/PDF)
- [ ] No historical gap tracking (each lookup is a snapshot)
- [ ] No keyword type selection (organic only — no paid/PLA comparison)
- [ ] No device toggle (desktop only — no mobile comparison)
- [ ] No URL/subdomain/subfolder granularity — domain level only
- [ ] Daily usage limits defined but not enforced

---

## How to Test

1. Ensure `OPENAI_API_KEY` is set in `.env`
2. Run migration: `npx prisma migrate dev --name add-keyword-gap-cache`
3. Restart backend: `cd apps/backend/api && pnpm dev`
4. Restart frontend: `cd apps/frontend/tenent-dashboard && pnpm dev`
5. Navigate to `/dashboard/keyword-gap` (or click "Keyword Gap" in sidebar)
6. Enter your domain + 1 competitor and click "Compare"
7. Verify 7 summary cards appear with counts
8. Click "Missing" card → table filters to missing keywords only
9. Click gap type tabs → table updates
10. Use keyword search, intent filter, volume/KD filters
11. Click column headers to sort
12. Verify position columns show best position highlighted with green ring
13. Add more competitors (up to 4) → position columns expand
14. Toggle dark mode — all sections theme correctly
15. Resize to mobile — layout stacks vertically
16. Try same domains again — should load instantly from cache
