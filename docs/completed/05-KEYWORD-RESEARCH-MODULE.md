# Module 5 — Keyword Research (Semrush-Style)

> **Status:** ✅ Complete (v2 — Intent + Filters + Gap Analysis + Clustering)
> **Completed:** 2026-04-03
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Full keyword research suite inspired by Semrush's methodology. Covers Keyword Overview (volume, difficulty, CPC, **intent classification**, **priority scoring**), Keyword Magic Tool (suggestions with **11 advanced filters**, **match types**, **topic clustering**), **Keyword Gap Analysis** (compare vs competitors), and per-project keyword management with **domain-based suggestions**. Uses DataForSEO API → OpenAI fallback → mock data chain. All keywords enriched with pattern-based intent classification (I/N/C/T) and priority scores.

---

## What Was Built

### Backend — 8 API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/keywords/search?q=...&country=US` | JWT | Keyword overview — volume, difficulty, CPC, trend, **intent**, **priority score** |
| `GET` | `/keywords/suggestions?q=...` | JWT | Related keywords with **11 filter params**, match types, clustering |
| `GET` | `/projects/:id/keywords` | JWT + Owner | List saved keywords for project (paginated) |
| `POST` | `/projects/:id/keywords` | JWT + Owner | Save keyword to project |
| `DELETE` | `/projects/:id/keywords/:keywordId` | JWT + Owner | Remove saved keyword |
| `GET` | `/projects/:id/keyword-gap?competitors=...` | JWT + Owner | Keyword gap analysis vs up to 4 competitors |
| `GET` | `/projects/:id/keywords/export` | JWT + Owner | Export all project keywords with enriched metrics |

### Key Features

#### Intent Classification (pattern-based, zero API cost)

| Intent | Trigger Patterns | Example |
|--------|-----------------|---------|
| **TRANSACTIONAL** (T) | buy, purchase, order, pricing, discount, cheap, subscribe, download | "buy seo tools" |
| **COMMERCIAL** (C) | best, top, review, comparison, vs, alternatives, pros and cons | "best seo tools 2026" |
| **NAVIGATIONAL** (N) | login, website, .com, app, dashboard, portal | "semrush login" |
| **INFORMATIONAL** (I) | how, what, why, guide, tutorial, tips, ways to, learn | "how to do keyword research" |

#### Priority Scoring (Semrush formula)
```
Priority = (VolumeScore × 0.4) + (IntentScore × 0.3) + (KD_Inverse × 0.3)

VolumeScore = min(100, log10(volume) / log10(100000) × 100)
IntentScore = TRANSACTIONAL:100, COMMERCIAL:75, INFORMATIONAL:50, NAVIGATIONAL:25
KD_Inverse  = (100 - KD%) / 100 × 100
```

#### Advanced Suggestion Filters (11 parameters)

| Filter | Query Param | Description |
|--------|------------|-------------|
| Match Type | `matchType` | broad / phrase / exact / questions |
| Min Volume | `minVolume` | Minimum search volume |
| Max Volume | `maxVolume` | Maximum search volume |
| Min KD | `minKd` | Minimum keyword difficulty |
| Max KD | `maxKd` | Maximum keyword difficulty |
| Intent | `intent` | INFORMATIONAL / COMMERCIAL / TRANSACTIONAL / NAVIGATIONAL |
| Questions Only | `questionsOnly` | Filter to question-format keywords |
| Min Words | `minWords` | Minimum word count |
| Max Words | `maxWords` | Maximum word count |
| Include Words | `includeWords` | Comma-separated must-contain words |
| Exclude Words | `excludeWords` | Comma-separated must-not-contain words |

#### Keyword Clustering
Groups suggestions by most significant shared word (longest non-stop-word). Each cluster represents a potential content piece / landing page target.

#### Keyword Gap Analysis
- Compares project's saved keywords vs up to 4 competitor domains
- Categories: **Missing** (competitors have, you don't), **Shared** (both have), **Unique** (only you have)
- Missing keywords sorted by priority score descending
- Returns top 100 missing keyword opportunities

#### Domain-Based Suggestions
Project keywords page extracts meaningful words from the project domain (e.g., `ultimaterenovations.com.au` → `ultimate renovations`) and uses them as a seed keyword for top 10 domain-relevant suggestions.

### Frontend — 2 pages (enhanced)

| Route | Description |
|-------|-------------|
| `/dashboard/keywords` | Keyword research page — search bar, keyword card with **intent badge** + **priority score**, **match type tabs** (Broad/Phrase/Exact/Questions), **filters panel** (intent, volume, KD, word count, include/exclude), **topic groups** (cluster tags), suggestions table with intent + priority columns |
| `/dashboard/projects/[id]/keywords` | Project keywords page — **inline search bar**, **"Suggest for {domain}" button** (domain-based suggestions), **search result card** with metrics + save, **suggestions table** with intent/priority, saved keywords table, **"Keyword Research" button** to global research page |

---

## File Inventory

```
Backend:
  src/keywords/keywords.service.ts      — DataForSEO API + cache + mock + intent classification
                                          + priority scoring + clustering + gap analysis + export
  src/keywords/keywords.controller.ts   — 8 endpoints with filter query params
  src/keywords/keywords.module.ts       — Module wiring
  src/keywords/dto/search-keyword.dto.ts
  src/keywords/dto/save-keyword.dto.ts
  src/keywords/dto/index.ts

Frontend:
  types/keyword.ts                      — TypeScript interfaces (SearchIntent, SuggestionFilters,
                                          KeywordGapResponse, KeywordExportData)
  hooks/useKeywords.ts                  — 7 React Query hooks (search, suggestions with filters,
                                          project keywords, gap, export, save, remove)
  pages/dashboard/keywords/index.tsx    — Research page with filters + clusters + intent
  pages/dashboard/keywords/index.module.css
  pages/dashboard/projects/[id]/keywords.tsx  — Project keywords with inline research + domain suggestions
  pages/dashboard/projects/[id]/keywords.module.css
```

### Environment Variables
```
DATAFORSEO_LOGIN=""       # Optional — falls back to OpenAI → mock
DATAFORSEO_PASSWORD=""
OPENAI_API_KEY=""         # Optional — falls back to mock
```

### Data Flow

```
User enters keyword
     │
     ▼
Backend: check KeywordCache (30-day TTL)
     │ miss?
     ▼
DataForSEO API → OpenAI fallback → Mock data
     │
     ▼
Enrich: classifyIntent() + calculatePriorityScore() + getWordCount() + isQuestion()
     │
     ▼
Upsert to cache → return enriched KeywordData to frontend
     │
     ▼
Frontend: display intent badge (I/N/C/T), priority score, metrics
```

### Suggestion Flow with Filters

```
User clicks "Get Suggestions" + sets filters
     │
     ▼
Backend: fetch 3x limit from API (to have pool for filtering)
     │
     ▼
Enrich all with intent/priority/wordCount/isQuestion
     │
     ▼
Apply match type filter → Apply all 11 filters → Generate clusters
     │
     ▼
Paginate filtered results → Return { keywords, total, clusters }
     │
     ▼
Frontend: render match type tabs, filter panel, cluster tags, enriched table
```

---

## Previous Limitations — Now Resolved

- [x] **No intent classification** — pattern-based I/N/C/T classification on all keywords
- [x] **No priority scoring** — Semrush-style composite score (volume + intent + KD inverse)
- [x] **No advanced filters** — 11 filter parameters including match types, intent, word count
- [x] **No keyword clustering** — shared-word grouping into topic clusters
- [x] **No keyword gap analysis** — compare vs competitors, find missing opportunities
- [x] **No domain-based suggestions** — project page suggests keywords based on domain name
- [x] **No inline research on project page** — search + suggest directly on project keywords page
- [x] **No keyword export** — export all project keywords with enriched metrics

## Remaining Limitations
- [ ] No daily search limit enforcement per plan
- [ ] Keyword gap uses domain-name-based heuristic (no SERP API for actual competitor keywords)
- [ ] Clustering is word-based (no SERP overlap analysis — would need SERP API)
- [ ] No keyword position tracking integration yet (separate module)

---

## How to Test

1. Restart backend: `cd apps/backend/api && pnpm dev`
2. Navigate to `/dashboard/keywords`
3. Search a keyword — see intent badge (I/N/C/T), priority score, volume, KD, CPC
4. Click "Get Suggestions" — switch between Broad/Phrase/Exact/Questions tabs
5. Open Filters panel — filter by intent, volume, KD, word count
6. Click topic group tags to quick-filter
7. Navigate to `/dashboard/projects/{id}/keywords`
8. Click "Suggest for {domain}" to get domain-relevant keyword ideas
9. Use inline search to research and save keywords directly on the project page
