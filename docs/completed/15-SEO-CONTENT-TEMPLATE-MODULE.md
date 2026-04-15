# Module 15 — SEO Content Template (Semrush-Style)

> **Status:** ✅ Complete
> **Completed:** 2026-04-13
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Semrush-style SEO Content Template tool. Users enter a target keyword + country and receive a data-backed content brief that tells writers exactly how to outrank the Google top 10 for that keyword. The brief includes recommended text length, target readability score, semantic (LSI) keywords, on-page title/meta/H1 rules, top 10 competitor analysis with keyword usage examples, and suggested backlink target domains. Uses OpenAI (gpt-4o) as the sole data source — no SERP scraping. Results cached for 7 days. Briefs are persisted per user and can be exported to `.doc` or piped directly into the Writing Assistant as a pre-filled document.

**Distinct from Topic Research:** Topic Research finds *what* to write about (topic clusters, subtopics, FAQs). SEO Content Template tells you *how* to write it for a specific keyword (length, readability, on-page rules, competitor patterns).

**Distinct from Writing Assistant:** Writing Assistant is the editor that scores what you're writing. Content Template is the upstream brief that tells the editor what "good" looks like for a given target keyword.

---

## What Was Built

### Backend — 6 API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/seo-content-template/generate` | JWT | Generate a new brief from target keywords |
| `GET` | `/seo-content-template` | JWT | List user's saved briefs (paginated) |
| `GET` | `/seo-content-template/:id` | JWT | Get a single brief by ID |
| `DELETE` | `/seo-content-template/:id` | JWT | Delete a brief |
| `GET` | `/seo-content-template/:id/export` | JWT | Download brief as Word-compatible `.doc` |
| `POST` | `/seo-content-template/:id/send-to-writer` | JWT | Create a `WritingDocument` pre-filled from the brief |

### Key Feature: AI-generated content brief (single GPT-4o call)

A single structured-output call to `gpt-4o` (JSON mode, temperature 0.4) returns a complete brief. The prompt is engineered to produce Semrush-shaped output with strict rules (exactly 10 rivals, exactly 15 backlink targets, character limits on title/meta/H1).

### Data Returned

| Section | Description |
|---------|-------------|
| **Top 10 Rivals** (exactly 10 items) | `rank`, `url`, `title`, `snippet`, `totalOccurrences`, `exampleSentences[]` — estimated top-ranking competitor pages with keyword usage examples |
| **Backlink Targets** (exactly 15 items) | Bare domains recommended for outreach (e.g. `example-blog.com`) |
| **Semantic Keywords** (12–18 items) | LSI / semantically related terms writers should naturally include |
| **Avg Readability** | Flesch reading ease score 0–100 benchmark from top 10 |
| **Recommended Word Count** | Integer word count target based on top 10 average |
| **Title Suggestion** | ≤55 chars, contains primary keyword once |
| **Meta Suggestion** | ≤160 chars, contains primary keyword |
| **H1 Suggestion** | Contains primary keyword once |

### Frontend — 2 pages

| Route | Description |
|-------|-------------|
| `/dashboard/content-template` | List of saved briefs + generate form (keyword input, country selector, Generate button) |
| `/dashboard/content-template/[id]` | Brief detail view with all cards, export button, send-to-writer button |

#### Detail Page Sections

1. **Header** — Back link, keyword/country/timestamp, **Export .doc** button, **Send to Writing Assistant** button
2. **Disclaimer banner** — "Competitor data is AI-estimated. Verify URLs before backlink outreach."
3. **Recommendations Card** — Readability stat + recommended word count stat (big numbers, muted green)
4. **On-Page Rules Card** — Title / Meta / H1 with live character counts, max-length rules, primary-keyword rule per row
5. **Semantic Keywords Card** — Chip list (pill-style, accent color)
6. **Rivals Card** — 10 ranked competitor cards with:
   - Rank badge, title, clickable URL
   - Snippet with **primary keyword highlighted** (`<mark>`)
   - Keyword occurrence count
   - Collapsible example sentences (also with keyword highlight)
7. **Backlinks Card** — 15 domain chips

---

## File Inventory

```
Backend:
  src/seo-content-template/seo-content-template.module.ts          — Module wiring
  src/seo-content-template/seo-content-template.controller.ts      — 6 endpoints, JwtAuthGuard
  src/seo-content-template/seo-content-template.service.ts         — CRUD + send-to-writer integration
  src/seo-content-template/seo-content-template-ai.service.ts      — GPT-4o prompt, normalization, 7-day cache
  src/seo-content-template/seo-content-template-export.service.ts  — Word-compatible HTML .doc builder

Frontend:
  types/seo-content-template.ts                                    — TypeScript interfaces
  hooks/useContentTemplate.ts                                      — React Query hooks (list/get/generate/delete/send-to-writer)
  components/content-template/BriefCards.tsx                       — 5 card components + keyword highlighting
  pages/dashboard/content-template/index.tsx                       — List + generate form
  pages/dashboard/content-template/[id].tsx                        — Brief detail view

Modified:
  packages/database/prisma/schema.prisma                           — SeoContentBrief + SeoBriefCache models + User/Project relations
  apps/backend/api/src/app.module.ts                               — Registered SeoContentTemplateModule
  apps/frontend/tenent-dashboard/components/layout/Sidebar.tsx     — Added "SEO Content Template" nav link (global + project-scoped)

Migration:
  packages/database/prisma/migrations/20260413072344_add_seo_content_template/migration.sql
```

### Environment Variables
```
OPENAI_API_KEY=""         # Required — no fallback
```

### Database Schema

```prisma
model SeoContentBrief {
  id                   String   @id @default(cuid())
  userId               String   @map("user_id")
  projectId            String?  @map("project_id")

  // Inputs
  targetKeywords       Json     @map("target_keywords")    // string[]
  country              String   @default("US")

  // GPT-generated brief
  topRivals            Json     @map("top_rivals")         // RivalItem[]
  backlinkTargets      Json     @map("backlink_targets")   // string[]
  semanticKeywords     Json     @map("semantic_keywords")  // string[]
  avgReadability       Int      @map("avg_readability")
  recommendedWordCount Int      @map("recommended_word_count")

  titleSuggestion      String   @map("title_suggestion")
  metaSuggestion       String   @map("meta_suggestion")
  h1Suggestion         String   @map("h1_suggestion")

  status               String   @default("ready") // ready | generating | failed
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([userId, updatedAt(sort: Desc)])
  @@index([projectId])
  @@map("seo_content_briefs")
}

model SeoBriefCache {
  id        String   @id @default(cuid())
  cacheKey  String   @unique @map("cache_key")
  data      Json
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("seo_brief_cache")
}
```

### Data Flow

```
User enters: "tiles" + country "AU"
     │
     ▼
Frontend: POST /seo-content-template/generate { targetKeywords: ["tiles"], country: "AU" }
     │
     ▼
Backend: trim + lowercase keywords, uppercase country
     │
     ▼
Build cache key: "brief|AU|<hash(sorted keywords)>"
     │
     ▼
Check SeoBriefCache (7-day TTL)
     │ miss?
     ▼
Build structured GPT-4o prompt (system + user)
     │
     ▼
OpenAI gpt-4o JSON mode (temp 0.4, max 4000 tokens, 60s timeout)
     │ fail?
     ▼
BadRequestException "AI request failed. Please try again."
     │ success?
     ▼
normalizeBrief() — clamp integers, slice arrays to limits, strip http://
     │
     ▼
Upsert cache + persist SeoContentBrief row
     │
     ▼
Frontend routes to /dashboard/content-template/[id]
     │
     ▼
Detail page renders:
  • Recommendations card (readability + word count)
  • On-page rules card (title/meta/H1 with live char counts)
  • Semantic keywords chips
  • Top 10 rivals with keyword highlighting + collapsible examples
  • Backlink target chips
  • Export .doc button → GET /seo-content-template/:id/export (blob download)
  • Send to Writing Assistant button → POST .../send-to-writer → redirect to editor
```

### Send-to-Writing-Assistant Integration

When clicked, backend creates a new `WritingDocument` with:
- `title` = brief's `titleSuggestion`
- `content` = pre-templated HTML (H1, target keywords line, target length/readability line, semantic keywords checklist, placeholder intro)
- `targetKeywords` = brief's keywords
- `metaDescription` = brief's `metaSuggestion`
- `projectId` = brief's projectId (if any)

Frontend then routes to `/dashboard/writing-assistant?documentId=<id>` so the user can start drafting immediately against the brief's targets.

### .doc Export

Uses a Word-compatible HTML approach (MIME `application/msword`) — no new npm dependency required. Word and LibreOffice both open the file natively. The exported document contains all brief sections formatted with inline styles (headings, bullet lists, competitor cards with borders).

---

## Use Cases

1. **Content briefs for writers** — Hand writers a data-backed spec instead of vague guidance ("write 1,900 words, readability 66, include these 15 LSI terms")
2. **On-page optimization rules** — Enforce title ≤55 chars, meta ≤160 chars, keyword once in each — live character counts surface violations immediately
3. **Competitor keyword analysis** — See how the top 10 ranking pages naturally use the target keyword in prose (example sentences)
4. **Backlink outreach targets** — Get 15 domain suggestions as a starting point for link building research
5. **Bridge to Writing Assistant** — One click turns the brief into a live draft document that's already scored against the brief's targets
6. **Export to writer workflows** — Download as `.doc` for writers who don't use the platform directly

---

## Workflow Integration

```
Topic Research  →  SEO Content Template  →  Writing Assistant  →  Site Audit
  (what to            (how to write it —        (live draft          (publish check)
  write about)        the brief)                with scoring)
```

Sidebar groups these three modules together under the content workflow, making the flow visually obvious.

---

## Limitations

- [ ] **Data is AI-estimated, not real SERP data** — Top 10 URLs are plausible guesses, not scraped from Google. Users should verify URLs before outreach (disclaimer banner shown on detail page)
- [ ] No mock fallback — requires `OPENAI_API_KEY`
- [ ] **Single keyword only in v1** — schema supports `targetKeywords: Json` as array, so bulk (up to 30) is a future frontend change
- [ ] No real backlink data — suggestions are AI-generated, no backlink API integration
- [ ] No geo-targeting beyond country level (no region/city)
- [ ] Synchronous generation only — user waits ~20–40s with a spinner (no async job + polling)
- [ ] No usage limit enforcement (no `SEO_CONTENT_TEMPLATE` entry in `UsageMetric` enum)
- [ ] No bulk delete / archive
- [ ] Export is `.doc` (Word HTML) only — no `.docx`, PDF, or Google Docs integration
- [ ] No revision history — regenerating a brief for the same keyword creates a new record

---

## How to Test

1. Ensure `OPENAI_API_KEY` is set in `.env`
2. Run migration: `pnpm --filter @repo/database db:migrate` (applied: `20260413072344_add_seo_content_template`)
3. Regenerate Prisma Client: `pnpm --filter @repo/database db:generate` *(stop backend dev server first on Windows, the query engine `.dll` gets locked while the server runs)*
4. Restart backend + frontend
5. Navigate to `/dashboard/content-template`
6. Enter "tiles" in the keyword input, select "Australia", click **Generate brief**
7. Wait 20–40 seconds for GPT-4o to return
8. Verify redirect to detail page showing:
   - Recommendations card with readability + word count
   - On-page rules with character counters
   - Semantic keyword chips
   - 10 ranked rivals with highlighted keyword in snippets
   - Collapsible example sentences under each rival
   - 15 backlink target chips
9. Click **Export .doc** — file downloads, opens correctly in Word/LibreOffice
10. Click **Send to Writing Assistant** — redirects to editor with pre-filled H1, keywords, target length, semantic checklist
11. Return to `/dashboard/content-template` — brief appears in "My Briefs" list
12. Delete brief — confirms + removes from list
13. Regenerate same keyword within 7 days — returns instantly from `SeoBriefCache`
14. Dark mode + mobile responsive
