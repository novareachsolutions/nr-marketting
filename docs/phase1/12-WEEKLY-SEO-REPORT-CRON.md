# Phase 1 - Weekly SEO Health Check Cron Job

> **Automated weekly/biweekly/monthly SEO reports** with user-configurable schedules, module selection, snapshot comparison, and AI-generated summaries.

---

## Table of Contents

- [Overview](#overview)
- [User Flow](#user-flow)
- [Schema Changes](#schema-changes)
- [Backend Architecture](#backend-architecture)
- [Scheduler Logic](#scheduler-logic)
- [Report Generation Pipeline](#report-generation-pipeline)
- [Comparison Data Structure](#comparison-data-structure)
- [Frontend Settings UI](#frontend-settings-ui)
- [API Endpoints](#api-endpoints)
- [Files to Create](#files-to-create)
- [Files to Modify](#files-to-modify)
- [Design Decisions](#design-decisions)
- [Verification](#verification)

---

## Overview

### Problem

The platform has 6+ SEO analysis modules (site audit, keyword research, organic rankings, domain overview, top pages, position tracking) that users run manually per project. There is no automated way to re-run these modules periodically and compare results over time.

### Solution

A user-configurable scheduled report system where:

1. Users choose **when** (day + hour) and **how often** (weekly/biweekly/monthly) to run reports
2. Users select **which modules** to include in each report
3. A **hourly cron job** checks which projects are due and triggers report generation
4. Reports **snapshot current data, refresh modules, and compare** old vs new
5. An **AI summary** is generated highlighting key changes
6. Everything is stored in the existing `Report` table with a JSON `data` field

---

## User Flow

```
1. User navigates to Project Settings page
2. Sees "Automated SEO Reports" section
3. Enables the schedule and configures:
   - Frequency: Weekly / Biweekly / Monthly
   - Day of week: Sunday - Saturday
   - Time of day: 0:00 - 23:00 (UTC)
   - Modules: checkboxes for each available module
4. Clicks "Save Settings"
5. Backend saves config on the Project model
6. Every hour, cron checks if this project is due
7. When due: snapshot → refresh → compare → save report
8. User views reports in the Reports list with full comparison data
9. User can also click "Generate Now" to trigger manually
```

---

## Schema Changes

### New Enum: `ReportSchedule`

```prisma
enum ReportSchedule {
  NONE
  DAILY
  WEEKLY
  MONTHLY
}
```

### Project Model Additions

```prisma
model Project {
  // ... existing fields ...

  // Report schedule settings
  reportSchedule       ReportSchedule @default(NONE) @map("report_schedule")
  reportDay            Int?           @map("report_day")           // 0=Sun, 1=Mon, ... 6=Sat
  reportHour           Int            @default(2) @map("report_hour")  // 0-23 UTC
  reportModules        Json?          @map("report_modules")       // ["siteAudit","domainOverview",...]
  lastWeeklyReportAt   DateTime?      @map("last_weekly_report_at")
}
```

| Field | Type | Description |
|-------|------|-------------|
| `reportSchedule` | ReportSchedule | NONE, DAILY, WEEKLY, or MONTHLY |
| `reportDay` | Int? | Day of week (0=Sunday through 6=Saturday). Ignored for MONTHLY. |
| `reportHour` | Int | Hour of day in UTC (0-23). Default: 2 (2 AM UTC) |
| `reportModules` | Json? | Array of module keys to include in report |
| `lastWeeklyReportAt` | DateTime? | Timestamp of last successful report generation |

### Report Model Addition

```prisma
model Report {
  // ... existing fields ...
  data      Json?    // Full comparison report data (snapshots + diff)
}
```

---

## Backend Architecture

### Module Structure

```
apps/backend/api/src/reports/
├── reports.module.ts              # NestJS module
├── reports.service.ts             # Core report generation logic
├── reports.controller.ts          # REST endpoints
└── report-scheduler.service.ts    # Hourly cron job
```

### Module Dependencies

`ReportsModule` imports:

| Module | Service Used | Purpose |
|--------|-------------|---------|
| PrismaModule | PrismaService | Database access |
| SiteAuditModule | SiteAuditService | Trigger crawls, read crawl data |
| DomainOverviewModule | DomainOverviewService | `getDomainOverview()` |
| OrganicRankingsModule | OrganicRankingsService | `getOrganicRankings()` |
| TopPagesModule | TopPagesService | `getTopPages()` |
| PositionTrackingModule | PositionTrackingService, RankCheckerService | Read rankings, trigger rank check |
| KeywordsModule | KeywordsService | Read keyword data |
| AiSuggestionsModule | AiSuggestionsService | AI summary generation |

---

## Scheduler Logic

### Cron Schedule

```typescript
@Cron(CronExpression.EVERY_HOUR)
async handleScheduledReports()
```

Follows the same pattern as existing `CrawlSchedulerService` and `RankCheckSchedulerService`.

### isDue() Logic

```typescript
isDue(schedule, reportDay, reportHour, lastReportAt, now): boolean {
  // If never run before, check if current day+hour match
  // If run before, check elapsed time:
  //   WEEKLY:   >= 7 days AND current day matches reportDay AND current hour matches reportHour
  //   DAILY:    >= 24 hours AND current hour matches reportHour
  //   MONTHLY:  >= 30 days AND current hour matches reportHour
}
```

### Processing Order

- Projects processed **sequentially** (not in parallel)
- **5-second delay** between projects to avoid OpenAI API rate limits
- Each project's report runs in **background** via `setTimeout`
- `lastWeeklyReportAt` updated **before** execution to prevent double-runs

---

## Report Generation Pipeline

```
For a single project:
│
├─ 1. DETECT USED MODULES
│     Check which modules have data for this project:
│     - Site Audit:        CrawlJob with status COMPLETED exists?
│     - Domain Overview:   DomainOverviewCache exists for domain?
│     - Organic Rankings:  OrganicRankingsCache exists for domain?
│     - Position Tracking: TrackedKeyword records exist?
│     - Top Pages:         TopPagesCache exists for domain?
│     - Keywords:          ProjectKeyword records exist?
│
│     Intersect with user's selected reportModules
│     (only run modules that have data AND user selected)
│
├─ 2. SNAPSHOT CURRENT DATA
│     Read current state from caches/DB:
│     - DomainOverviewCache → authority, traffic, keywords, backlinks
│     - OrganicRankingsCache → positions, traffic, competitors
│     - Latest CrawlJob → health score, error/warning/notice counts
│     - TrackedKeyword + RankingHistory → current positions, avg rank
│     - TopPagesCache → top pages by traffic
│
├─ 3. REFRESH MODULES
│     Call existing service methods to force-fetch fresh data:
│     - DomainOverviewService.getDomainOverview(domain, country, userId)
│     - OrganicRankingsService.getOrganicRankings(domain, country, userId)
│     - TopPagesService.getTopPages(domain, country, userId)
│     - RankCheckerService → trigger rank check
│     - CrawlerService → trigger new crawl (async, compare with previous)
│
├─ 4. READ NEW DATA
│     Read updated caches/DB after refresh
│
├─ 5. COMPARE
│     Generate diff between snapshot (step 2) and new data (step 4)
│     Calculate: absolute change, percentage change, new/lost items
│
├─ 6. AI SUMMARY
│     Send comparison data to OpenAI → generate executive summary
│     "Your organic traffic increased 12%. 3 new keywords entered top 10..."
│
├─ 7. SAVE REPORT
│     Create Report record:
│     - title: "Weekly SEO Report - Apr 1-8, 2026"
│     - type: WEEKLY
│     - status: COMPLETED
│     - dateFrom: 7 days ago
│     - dateTo: now
│     - data: { full comparison JSON }
│
└─ 8. UPDATE PROJECT
      Set project.lastWeeklyReportAt = now
```

---

## Comparison Data Structure

```typescript
interface WeeklyReportData {
  generatedAt: string;
  projectId: string;
  domain: string;
  modulesAnalyzed: string[];   // e.g. ["domainOverview", "siteAudit", "organicRankings"]

  domainOverview?: {
    previous: {
      authorityScore: number;
      organicTraffic: number;
      organicKeywords: number;
      totalBacklinks: number;
      referringDomains: number;
    };
    current: {
      authorityScore: number;
      organicTraffic: number;
      organicKeywords: number;
      totalBacklinks: number;
      referringDomains: number;
    };
    changes: {
      authorityScore: number;      // e.g. +2
      organicTraffic: number;      // e.g. +500
      organicKeywords: number;
      totalBacklinks: number;
      referringDomains: number;
    };
  };

  organicRankings?: {
    previous: {
      totalKeywords: number;
      monthlyTraffic: number;
      topPositions: { keyword: string; position: number }[];
    };
    current: {
      totalKeywords: number;
      monthlyTraffic: number;
      topPositions: { keyword: string; position: number }[];
    };
    changes: {
      totalKeywordsChange: number;
      monthlyTrafficChange: number;
      newKeywords: { keyword: string; position: number }[];
      lostKeywords: { keyword: string; previousPosition: number }[];
      improved: { keyword: string; from: number; to: number }[];
      declined: { keyword: string; from: number; to: number }[];
    };
  };

  siteAudit?: {
    previous: {
      healthScore: number;
      errors: number;
      warnings: number;
      notices: number;
    };
    current: {
      healthScore: number;
      errors: number;
      warnings: number;
      notices: number;
    };
    changes: {
      healthScoreChange: number;
      newErrors: { page: string; issue: string }[];
      fixedErrors: { page: string; issue: string }[];
      errorsDelta: number;
      warningsDelta: number;
    };
  };

  positionTracking?: {
    previous: {
      avgPosition: number;
      keywordsInTop10: number;
      keywordsInTop20: number;
    };
    current: {
      avgPosition: number;
      keywordsInTop10: number;
      keywordsInTop20: number;
    };
    changes: {
      avgPositionChange: number;
      topMovers: { keyword: string; from: number; to: number }[];
      topDecliners: { keyword: string; from: number; to: number }[];
    };
  };

  topPages?: {
    previous: {
      pages: { url: string; traffic: number; keywords: number }[];
    };
    current: {
      pages: { url: string; traffic: number; keywords: number }[];
    };
    changes: {
      newInTop10: { url: string; traffic: number }[];
      droppedFromTop10: { url: string; previousTraffic: number }[];
    };
  };

  keywords?: {
    totalTracked: number;
    newKeywordsAdded: number;
  };

  aiSummary: string;   // AI-generated executive summary of all changes
}
```

---

## Frontend Settings UI

### Settings Page Layout

```
+--------------------------------------------------+
|  Project Settings                                |
+--------------------------------------------------+
|                                                  |
|  Automated SEO Reports                           |
|  ──────────────────────                          |
|                                                  |
|  [Toggle: ON/OFF]  Enable Automated Reports      |
|                                                  |
|  When enabled:                                   |
|  ┌──────────────────────────────────────────┐   |
|  │  Frequency:  [ Daily / Weekly / Monthly ▾]│   |
|  │  Day:        [ Sunday        ▾ ]         │   |
|  │  Time:       [ 2:00 AM (UTC) ▾ ]         │   |
|  │                                          │   |
|  │  Modules to Include:                     │   |
|  │  ☑ Site Audit                            │   |
|  │  ☑ Domain Overview                       │   |
|  │  ☑ Organic Rankings                      │   |
|  │  ☑ Position Tracking                     │   |
|  │  ☑ Top Pages                             │   |
|  │  ☐ Keywords (greyed - no data yet)       │   |
|  │                                          │   |
|  │  [ Save Settings ]  [ Generate Now ]     │   |
|  │                                          │   |
|  │  Next report: Sunday, Apr 12 at 2 AM UTC │   |
|  └──────────────────────────────────────────┘   |
|                                                  |
+--------------------------------------------------+
```

### Module Checkbox Rules

| Module | Enabled When |
|--------|-------------|
| Site Audit | At least 1 `CrawlJob` with status COMPLETED |
| Domain Overview | `DomainOverviewCache` exists for project domain |
| Organic Rankings | `OrganicRankingsCache` exists for project domain |
| Position Tracking | At least 1 active `TrackedKeyword` |
| Top Pages | `TopPagesCache` exists for project domain |
| Keywords | At least 1 `ProjectKeyword` record |

Modules without data show as disabled with tooltip: "Run this module at least once to include it in reports"

---

## API Endpoints

### Report Schedule Settings

```
PUT /api/projects/:id/report-settings
```

**Request body:**
```json
{
  "reportSchedule": "WEEKLY",
  "reportDay": 0,
  "reportHour": 2,
  "reportModules": ["siteAudit", "domainOverview", "organicRankings", "positionTracking", "topPages"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "reportSchedule": "WEEKLY",
    "reportDay": 0,
    "reportHour": 2,
    "reportModules": ["siteAudit", "domainOverview", "organicRankings", "positionTracking", "topPages"],
    "lastWeeklyReportAt": null,
    "nextReportAt": "2026-04-12T02:00:00.000Z"
  }
}
```

```
GET /api/projects/:id/report-settings
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "reportSchedule": "WEEKLY",
    "reportDay": 0,
    "reportHour": 2,
    "reportModules": ["siteAudit", "domainOverview", "organicRankings", "positionTracking", "topPages"],
    "lastWeeklyReportAt": "2026-04-05T02:00:00.000Z",
    "nextReportAt": "2026-04-12T02:00:00.000Z",
    "availableModules": {
      "siteAudit": true,
      "domainOverview": true,
      "organicRankings": true,
      "positionTracking": false,
      "topPages": true,
      "keywords": false
    }
  }
}
```

### Reports CRUD

```
POST /api/projects/:id/reports/generate
```

**Request body (optional):**
```json
{
  "modules": ["siteAudit", "domainOverview"]
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "reportId": "rpt_abc123",
    "status": "PENDING",
    "message": "Report generation started. Check back shortly."
  }
}
```

```
GET /api/projects/:id/reports
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "rpt_abc123",
      "title": "Weekly SEO Report - Apr 1-8, 2026",
      "type": "WEEKLY",
      "dateFrom": "2026-04-01T00:00:00.000Z",
      "dateTo": "2026-04-08T00:00:00.000Z",
      "status": "COMPLETED",
      "modulesAnalyzed": ["siteAudit", "domainOverview", "organicRankings"],
      "createdAt": "2026-04-08T02:00:00.000Z"
    }
  ]
}
```

```
GET /api/projects/:id/reports/:reportId
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "rpt_abc123",
    "title": "Weekly SEO Report - Apr 1-8, 2026",
    "type": "WEEKLY",
    "status": "COMPLETED",
    "data": { /* full WeeklyReportData comparison object */ },
    "createdAt": "2026-04-08T02:00:00.000Z"
  }
}
```

```
DELETE /api/projects/:id/reports/:reportId
```

**Response (200):**
```json
{
  "success": true,
  "message": "Report deleted"
}
```

---

## Files to Create

| # | File Path | Purpose |
|---|-----------|---------|
| 1 | `apps/backend/api/src/reports/reports.module.ts` | NestJS module with all imports |
| 2 | `apps/backend/api/src/reports/reports.service.ts` | Core logic: detect modules, snapshot, refresh, compare, save |
| 3 | `apps/backend/api/src/reports/reports.controller.ts` | REST endpoints for settings + CRUD |
| 4 | `apps/backend/api/src/reports/report-scheduler.service.ts` | `@Cron(EVERY_HOUR)` scheduler |
| 5 | `apps/frontend/tenent-dashboard/components/settings/ReportScheduleSettings.tsx` | Settings UI component |
| 6 | `apps/frontend/tenent-dashboard/app/projects/[id]/settings/page.tsx` | Settings page (or integrate into existing) |

## Files to Modify

| # | File Path | Change |
|---|-----------|--------|
| 1 | `packages/database/prisma/schema.prisma` | Add `ReportSchedule` enum, new Project fields, `data` on Report |
| 2 | `apps/backend/api/src/app.module.ts` | Import `ReportsModule` |

---

## Design Decisions

### 1. Hourly Cron (Not Per-Project Timers)
Same pattern as `CrawlSchedulerService` and `RankCheckSchedulerService`. One cron runs every hour, iterates projects, checks if each is due. Simple, proven, no dynamic scheduler complexity.

### 2. User Picks Day + Hour (Not Full Crontab)
Users don't need crontab syntax. Day-of-week + hour-of-day covers all realistic scheduling needs. Clean UI with dropdowns.

### 3. Module Selection via Checkboxes
Users only pay for modules they care about. Modules that haven't been used yet are greyed out — can't compare data that doesn't exist.

### 4. No BullMQ / Redis
Follows existing `setTimeout` pattern for background work. For a weekly job, this is sufficient. Can migrate to BullMQ later if needed.

### 5. Reuse Existing Services
All 6+ module services are already exported from their NestJS modules. We inject them and call their public methods. Zero duplication.

### 6. Site Audit is Special
Crawls take minutes/hours. For weekly reports, we compare the **two most recent completed crawls** rather than waiting for a new crawl to finish. The cron triggers a new crawl, but the report uses the already-completed data.

### 7. Sequential Processing with Delays
Projects processed one at a time with 5-second gaps between them. Prevents OpenAI rate limit issues. Acceptable for a background job.

### 8. Report.data Stores Everything
Single JSON field with `previous`, `current`, and `changes` per module. Frontend can render rich comparison views directly from this structure. No additional tables needed.

---

## Verification

1. Run `npx prisma migrate dev` to apply schema changes
2. Start the backend server
3. Create a project and run at least one module manually (e.g., domain overview)
4. Call `PUT /api/projects/:id/report-settings` with a WEEKLY schedule
5. Call `POST /api/projects/:id/reports/generate` to trigger manual report
6. Call `GET /api/projects/:id/reports` — verify report appears with comparison data
7. Call `GET /api/projects/:id/reports/:id` — verify full comparison JSON in `data` field
8. To test the cron: temporarily change to `CronExpression.EVERY_MINUTE`, verify it picks up the project and generates a report
9. Verify `lastWeeklyReportAt` is updated after report generation
10. Verify the cron skips projects that are not yet due
