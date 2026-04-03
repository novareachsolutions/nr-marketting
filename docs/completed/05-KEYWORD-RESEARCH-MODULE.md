# Module 5 — Keyword Research

> **Status:** ✅ Complete
> **Completed:** 2026-04-01
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Keyword research tools covering Keyword Overview (search volume, difficulty, CPC) and Keyword Magic Tool (suggestions). Uses DataForSEO API with a shared keyword cache to reduce costs. Falls back to mock data when API keys are not configured.

---

## What Was Built

### Backend — 5 API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/keywords/search?q=...&country=US` | JWT | Keyword overview — volume, difficulty, CPC, trend |
| `GET` | `/api/keywords/suggestions?q=...&country=US&limit=50&page=1` | JWT | Related keyword suggestions |
| `GET` | `/api/projects/:id/keywords` | JWT + Owner | List saved keywords for project |
| `POST` | `/api/projects/:id/keywords` | JWT + Owner | Save keyword to project |
| `DELETE` | `/api/projects/:id/keywords/:keywordId` | JWT + Owner | Remove saved keyword |

### Key Features
- **Shared KeywordCache** — 30-day TTL, reduces API costs when multiple users search same keyword
- **DataForSEO integration** — search volume via `keywords_data/google_ads/search_volume/live`, suggestions via `dataforseo_labs/google/keyword_suggestions/live`
- **Mock data fallback** — realistic fake data when `DATAFORSEO_LOGIN` is empty (works without API keys)
- **Per-project keyword saving** with target URL and notes

### Frontend — 2 pages

| Route | Description |
|-------|-------------|
| `/dashboard/keywords` | Keyword research page — search bar, keyword card with metrics, suggestions table with save buttons |
| `/dashboard/projects/[id]/keywords` | Project keywords page — saved keywords table with remove |

---

## File Inventory

```
Backend:
  src/keywords/keywords.service.ts      — DataForSEO API + cache + mock fallback
  src/keywords/keywords.controller.ts   — 5 endpoints
  src/keywords/keywords.module.ts       — Module wiring
  src/keywords/dto/search-keyword.dto.ts
  src/keywords/dto/save-keyword.dto.ts
  src/keywords/dto/index.ts

Frontend:
  types/keyword.ts                      — TypeScript interfaces
  hooks/useKeywords.ts                  — React Query hooks
  pages/dashboard/keywords/index.tsx    — Research page
  pages/dashboard/keywords/index.module.css
  pages/dashboard/projects/[id]/keywords.tsx  — Project keywords
  pages/dashboard/projects/[id]/keywords.module.css
```

### Environment Variables
```
DATAFORSEO_LOGIN=""
DATAFORSEO_PASSWORD=""
```

---

## Known Limitations
- [ ] No keyword difficulty color coding thresholds on backend — frontend handles display
- [ ] Suggestions pagination relies on DataForSEO offset — mock generates fixed sets
- [ ] No daily search limit enforcement yet (spec says 10/500/unlimited per plan)
