# Module 17 — Backlink Audit (Semrush-Style)

> **Status:** ✅ Complete (Scope A — MVP, no monitoring/scheduler)
> **Completed:** 2026-04-13
> **Scope:** Backend (NestJS, persisted) + Frontend (Next.js)

---

## Overview

Semrush-style backlink audit tool. Users enter any domain and get an AI-powered evaluation of every backlink: each link is scored 0-100 for **toxicity**, tagged with risk factors, and grouped into clean / suspicious / toxic buckets. Users review the per-link table, mark links as **Keep / Flag / Disavow**, and export a Google-format **disavow.txt** file. AI insights highlight the top issues to fix. Uses OpenAI (`gpt-4o-mini`) as the sole data source.

**Distinct from prior backlink modules:**
- **Backlink Gap** — compares your referring domains vs competitors → find link-building targets
- **Backlinks** — single-domain *profile* (who links, authority, anchors, trends)
- **Backlink Audit** (this) — link *quality / toxicity* scoring with disavow workflow

**Data is persisted** (not just cached): each audit creates a `BacklinkAuditJob` row plus N `BacklinkAuditLink` rows so user flag/disavow decisions survive across visits.

---

## What Was Built

### Backend — 7 API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/backlink-audit` | JWT | Run new audit (body: `{ domain, country }`) |
| `GET` | `/backlink-audit` | JWT | List user's recent audits |
| `GET` | `/backlink-audit?domain=&country=` | JWT | Get latest audit for a domain |
| `GET` | `/backlink-audit/:id` | JWT | Fetch one audit with all links |
| `PATCH` | `/backlink-audit/:id/links/:linkId` | JWT | Update single link status (`keep`/`flag`/`disavow`/`pending`) |
| `PATCH` | `/backlink-audit/:id/links` | JWT | Bulk update (body: `{ linkIds, status }`) |
| `DELETE` | `/backlink-audit/:id` | JWT | Delete an audit |
| `GET` | `/backlink-audit/:id/disavow.txt` | JWT | Download Google-format disavow file |

### AI Output Shape

The OpenAI call returns:

| Section | Description |
|---------|-------------|
| **Top-level scores** | `toxicityScore` (0-100), `authorityScore` (0-100, weighted avg of source authority) |
| **Counts** | `totalLinks`, `totalDomains`, `toxicCount`, `suspiciousCount`, `cleanCount` |
| **Insights** (4-6) | `severity` (low/medium/high), `title`, `description`, `action` |
| **Distribution** | `toxicityBuckets`, `authorityBuckets`, `tld`, `anchor`, `category` |
| **Links** (30 rows) | `sourceUrl`, `sourceTitle`, `sourceDomain`, `targetUrl`, `anchor`, `linkType`, `category`, `tld`, `firstSeen`, `sourceAuthority` (0-100), `toxicityScore` (0-100), `toxicityLevel` (clean/suspicious/toxic), `riskFactors[]` |

### Toxicity Levels

| Level | Score range | Meaning |
|-------|-------------|---------|
| **Clean** | 0-30 | Healthy, keep |
| **Suspicious** | 31-60 | Manual review |
| **Toxic** | 61-100 | High risk — disavow candidate |

### 17 Risk Factors (AI picks 0-5 per link)

`Low authority source`, `Spammy TLD`, `Link farm pattern`, `Excessive outbound links`, `Unrelated niche`, `Thin content source`, `Hacked / deindexed site`, `Paid link pattern`, `Exact-match over-optimization`, `Private blog network (PBN)`, `Comment / forum spam`, `Sitewide footer link`, `Low domain age`, `Foreign language mismatch`, `Adult / gambling niche`, `Scraper site`, `Parked domain`

### Frontend — 1 page

| Route | Description |
|-------|-------------|
| `/dashboard/backlink-audit` | Audit dashboard with run form, recent history, gauges, insights, distributions, link table, disavow export |

#### Page Sections

1. **Header + Guide modal**
2. **Run Audit form** — Domain input + country selector + Run button
3. **Recent Audits** (collapsible) — List of user's prior audits with toxicity score chip + delete button; click to re-open
4. **Empty state** — Shown before any audit is selected
5. **Hero row** (2 cards):
   - **Toxicity Gauge** (0-100) + risk-level message
   - **Authority Gauge** + domain name + badges (country, link count, domain count, age)
6. **4 Summary Cards** (clickable → set filter): Toxic / Suspicious / Clean / Disavow Queue
7. **AI Insights Panel** — 4-6 actionable recommendations with severity icons + chips
8. **Two-column distributions**: Toxicity buckets + Authority buckets (color-coded bars)
9. **Disavow Action Bar** — Live count of links marked `disavow` + "Download disavow.txt" red button (disabled when 0)
10. **Filter Tabs** — All / Toxic / Suspicious / Clean / Flagged / Disavow (with counts)
11. **Backlink Quality Table**:
    - Source (linkable URL + title + domain)
    - Anchor (italic, truncated, tooltip on full)
    - Authority chip (color-coded)
    - Toxicity score chip + level chip stacked
    - Risk factor chips (red, max 4 + "+N" overflow)
    - Type (follow/nofollow)
    - Status dropdown (Pending/Keep/Flag/Disavow) — color-coded text

---

## File Inventory

```
Backend:
  src/backlink-audit/backlink-audit.service.ts     — OpenAI call, CRUD, disavow file builder
  src/backlink-audit/backlink-audit.controller.ts  — 7 endpoints
  src/backlink-audit/backlink-audit.module.ts      — Module wiring

Frontend:
  types/backlink-audit.ts                          — TypeScript interfaces
  hooks/useBacklinkAudit.ts                        — React Query hooks (list/get/run/update/delete/download)
  pages/dashboard/backlink-audit/index.tsx         — Full audit page with hero, insights, table
  pages/dashboard/backlink-audit/index.module.css  — Styles

Modified:
  packages/database/prisma/schema.prisma           — BacklinkAuditJob + BacklinkAuditLink models, BACKLINK_AUDIT enum
  apps/backend/api/src/app.module.ts               — Registered BacklinkAuditModule
  components/layout/Sidebar.tsx                    — Added "Backlink Audit" entry (ShieldAlert icon, both nav contexts)

Migration:
  packages/database/prisma/migrations/20260413095737_add_backlink_audit/
```

### Environment Variables

```
OPENAI_API_KEY=""    # Required — no fallback
```

### Database Schema

```prisma
model BacklinkAuditJob {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  domain          String
  country         String   @default("US")

  toxicityScore   Float    @default(0) @map("toxicity_score")
  authorityScore  Float    @default(0) @map("authority_score")

  totalLinks      Int      @default(0) @map("total_links")
  totalDomains    Int      @default(0) @map("total_domains")
  toxicCount      Int      @default(0) @map("toxic_count")
  suspiciousCount Int      @default(0) @map("suspicious_count")
  cleanCount      Int      @default(0) @map("clean_count")

  insights        Json?    // AiInsight[]
  distribution    Json?    // bucket maps

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user            User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  links           BacklinkAuditLink[]

  @@index([userId])
  @@index([domain])
  @@index([createdAt])
  @@map("backlink_audit_jobs")
}

model BacklinkAuditLink {
  id              String   @id @default(cuid())
  jobId           String   @map("job_id")

  sourceUrl       String   @map("source_url") @db.Text
  sourceTitle     String?  @map("source_title") @db.Text
  sourceDomain    String   @map("source_domain")
  targetUrl       String   @map("target_url") @db.Text
  anchor          String   @db.Text
  linkType        String   @default("follow") @map("link_type")
  category        String?
  tld             String?
  firstSeen       String?  @map("first_seen")

  sourceAuthority Int      @default(0) @map("source_authority")
  toxicityScore   Int      @default(0) @map("toxicity_score")
  toxicityLevel   String   @default("clean") @map("toxicity_level")
  riskFactors     Json?    @map("risk_factors")

  status          String   @default("pending") // pending | keep | flag | disavow
  userNote        String?  @map("user_note") @db.Text

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  job             BacklinkAuditJob @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
  @@index([jobId, status])
  @@index([jobId, toxicityLevel])
  @@map("backlink_audit_links")
}

enum UsageMetric {
  ...
  BACKLINK_AUDIT  // ← new
  ...
}
```

### Data Flow

```
User: clicks Run Audit on example.com / AU
     │
     ▼
POST /backlink-audit { domain, country }
     │
     ▼
Backend: normalize domain → call OpenAI gpt-4o-mini (max 6000 tokens)
     │
     ▼
Parse JSON response: scores + 30 link rows + insights + distribution
     │
     ▼
DB transaction: create BacklinkAuditJob + nested-create 30 BacklinkAuditLink rows
     │
     ▼
Increment BACKLINK_AUDIT usage
     │
     ▼
Return full job (with links) to frontend
     │
     ▼
Frontend renders gauges, insights, summary cards, table
     │
     ▼
User changes a link status to "Disavow" → PATCH /backlink-audit/:id/links/:linkId
     │
     ▼
DB updates row, frontend invalidates query, table re-renders
     │
     ▼
User clicks "Download disavow.txt" → GET /backlink-audit/:id/disavow.txt
     │
     ▼
Backend selects all links where status = 'disavow', dedupes by sourceDomain,
emits Google-format file:
  # Disavow file generated by NR SEO — Backlink Audit
  # Domain audited: example.com
  # ...
  domain:badsite.com
  domain:spammer.xyz
     │
     ▼
Browser triggers download as disavow-<jobId>.txt
```

---

## Use Cases

1. **Recover from penalty** — Scan a penalized site, identify toxic links, build disavow file → submit to Google
2. **Proactive hygiene** — Periodically audit your domain, flag suspicious sources before they become a problem
3. **Audit a new client's site** — Agencies use this on first onboarding to assess link health
4. **Detect negative SEO attacks** — Sudden spike in toxic backlinks visible in summary cards
5. **Refine outreach lists** — Don't pursue links from sites with high toxicity — check before contacting
6. **Compete with Semrush Backlink Audit** — Same workflow as the paid tool, AI-driven

---

## Limitations (Scope A — to address in Scope B)

- [ ] **No monitoring scheduler** — audits are one-shot; no @Cron periodic re-checks
- [ ] **No alerts table** — no persisted notifications for new/lost/broken backlinks
- [ ] **No outreach** — cannot email site owners from the tool (would require SMTP wiring)
- [ ] **No GSC import** — only AI-generated data; no Google Search Console connection
- [ ] **No Majestic / file import** — single data source (OpenAI)
- [ ] **30 links per audit** — limited by OpenAI token window; no pagination/multi-call
- [ ] Data is AI-estimated, not real backlink data
- [ ] No mock fallback — requires `OPENAI_API_KEY`
- [ ] Daily usage limits tracked but not enforced
- [ ] No CSV export of full link list (disavow.txt only)
- [ ] No anchor distribution chart (data is captured in `distribution.anchor` but page renders only toxicity + authority buckets)
- [ ] No comparison between audit runs (no historical diff)

---

## How to Test

1. Ensure `OPENAI_API_KEY` is set in `.env`
2. Migration already applied: `20260413095737_add_backlink_audit`
3. Restart backend (Prisma client picks up new `BacklinkAuditJob` / `BacklinkAuditLink` models + `BACKLINK_AUDIT` enum) + frontend
4. Navigate to `/dashboard/backlink-audit`
5. Enter a domain (e.g. `example.com`), pick country, click **Run Audit**
6. First call: ~30-60s OpenAI round-trip. Verify:
   - Toxicity gauge renders with score + color (red/yellow/green)
   - Authority gauge renders
   - 4 summary cards populate with toxic/suspicious/clean/disavow counts
   - AI Insights panel shows 4-6 recommendations with severity icons
   - Toxicity + Authority distribution bars render
   - Backlink table shows 30 rows with source link, anchor, scores, risk chips
7. Click **Toxic** summary card → table filters to toxic links
8. Click filter tabs (All/Toxic/Suspicious/Clean/Flagged/Disavow) — counts match
9. Change status dropdown on a link → "Disavow" → Disavow Action Bar count increments
10. Mark 3 links as Disavow → click **Download disavow.txt** → file downloads with `domain:` lines + audit metadata header
11. Click **Recent Audits** → click an older audit → loads, status flags persist
12. Click delete (trash icon) on an audit → confirms, removes from list
13. Re-run same domain → creates new job (audit state is per-job, not deduped)
14. Dark mode + mobile responsive (grid collapses to single column below 1024px)

---

## Future (Scope B)

- `BacklinkAuditAlert` table for new/lost/broken events
- `@Cron` scheduler that re-audits tracked domains daily/weekly
- Email digest of changes
- Site-owner outreach via SMTP (contact form + reply tracking)
- Google Search Console integration for real backlink data
- Majestic / file import
- Multi-call pagination for 100+ link audits
- CSV export of full link list
