# Phase 1 - Background Jobs & Schedulers

> **Queue:** BullMQ (backed by Redis)
> **Scheduler:** NestJS @Cron decorators (using node-cron)
> **Concurrency:** Configurable per queue

---

## Table of Contents

- [Overview](#overview)
- [BullMQ Architecture](#bullmq-architecture)
- [Job Definitions](#job-definitions)
- [Cron Schedule](#cron-schedule)
- [Job Queue Configuration](#job-queue-configuration)
- [Error Handling & Retries](#error-handling--retries)
- [Monitoring](#monitoring)

---

## Overview

Background jobs handle all work that shouldn't block the API response:

1. **GSC Rank Sync** — Daily pull of ranking data from Google Search Console
2. **Site Crawl** — Crawling a website page by page (can take minutes)
3. **Report Generation** — Puppeteer PDF rendering
4. **Alert Checks** — Evaluating alert conditions
5. **AI Insight Generation** — Generating dashboard insight cards
6. **Token Cleanup** — Removing expired refresh tokens
7. **Usage Reset** — Resetting monthly counters for free plan users
8. **Site Uptime Check** — Pinging project domains for downtime
9. **WordPress Health Check** — Weekly re-verification of WP credentials
10. **GitHub Deploy Re-Crawl** — Auto re-crawl triggered by GitHub push webhook

---

## BullMQ Architecture

```
                        +-----------+
                        |   Redis   |
                        |   :6379   |
                        +-----+-----+
                              |
              +---------------+---------------+
              |               |               |
        +-----+-----+  +-----+-----+  +-----+-----+
        | crawl     |  | report    |  | sync      |
        | queue     |  | queue     |  | queue     |
        +-----------+  +-----------+  +-----------+
              |               |               |
        +-----+-----+  +-----+-----+  +-----+-----+
        | Crawl     |  | Report    |  | GSC Sync  |
        | Workers   |  | Worker    |  | Worker    |
        | (5 conc.) |  | (2 conc.) |  | (3 conc.) |
        +-----------+  +-----------+  +-----------+
```

### Queues

| Queue Name | Concurrency | Purpose |
|-----------|-------------|---------|
| `crawl` | 5 | Site audit crawling |
| `report` | 2 | PDF generation (Puppeteer is memory-heavy) |
| `sync` | 3 | GSC/GA data sync |
| `alert` | 1 | Alert evaluation (sequential to prevent duplicate alerts) |
| `ai` | 2 | AI insight generation |
| `maintenance` | 1 | Cleanup jobs (token expiry, usage reset) |

---

## Job Definitions

### 1. GSC Rank Sync Job

```
Queue: sync
Trigger: Cron daily at 2:00 AM
Stagger: project hash % 60 = minute offset

Input:
{
  "projectId": "clxyz123",
  "userId": "user456"
}

Steps:
  1. Get GoogleConnection for user (decrypt refresh token)
  2. Refresh access token if expired
  3. Call GSC API:
     - Date range: today-7d to today-2d (GSC has 2-3 day delay)
     - Dimensions: query, date, device, country
  4. For each row:
     a. Match to TrackedKeyword by (keyword, device, country)
     b. Upsert RankingHistory record
  5. Compare with 7-day-ago positions
  6. If any keyword dropped > threshold: queue alert job

Output: { pagesProcessed: 25000, keywordsMatched: 45 }

Retry: 3 attempts with exponential backoff (1min, 5min, 15min)
Timeout: 5 minutes per project
```

### 2. Site Crawl Job

```
Queue: crawl
Trigger: User clicks "Start Crawl" or weekly schedule
Priority: User-initiated = HIGH, Scheduled = NORMAL

Input:
{
  "crawlJobId": "crawl123",
  "projectId": "clxyz123",
  "domain": "example.com",
  "pagesLimit": 10000
}

Steps:
  1. Update CrawlJob status: RUNNING
  2. Fetch robots.txt
  3. Initialize BFS queue with homepage URL
  4. Process URLs (concurrent, 5-10 at a time):
     a. Fetch page HTML
     b. Parse with Cheerio
     c. Run SEO checks
     d. Store CrawlPage + CrawlIssues
     e. Extract links, add new ones to internal queue
     f. Emit WebSocket progress event
     g. Check if pagesLimit reached
  5. Calculate health score
  6. Update CrawlJob: status=COMPLETED, score, counts
  7. Emit WebSocket completed event

Output: { pagesCrawled: 312, score: 78, duration: 127 }

Retry: 1 attempt only (crawls are expensive, user can re-trigger)
Timeout: 30 minutes max per crawl
```

### 3. Report Generation Job

```
Queue: report
Trigger: User clicks "Generate Report" or weekly schedule

Input:
{
  "reportId": "rpt123",
  "projectId": "clxyz123",
  "dateFrom": "2026-03-01",
  "dateTo": "2026-03-31",
  "emailTo": "client@example.com"   // optional
}

Steps:
  1. Update Report status: GENERATING
  2. Fetch all data for date range:
     - Rankings + history
     - Traffic from GA
     - Latest crawl results
     - AI executive summary (call Claude Haiku)
  3. Render Handlebars template
  4. Launch Puppeteer, generate PDF
  5. Save PDF to disk
  6. Update Report: status=COMPLETED, filePath, fileSize
  7. If emailTo: send email with PDF attachment

Output: { filePath: "/data/reports/clxyz123/rpt123.pdf", fileSize: 245000 }

Retry: 2 attempts (Puppeteer can crash occasionally)
Timeout: 5 minutes
```

### 4. Alert Check Job

```
Queue: alert
Trigger: Cron every 15 minutes

Input:
{
  "type": "SITE_DOWN_CHECK" | "RANKING_CHECK" | "CRAWL_CHECK"
}

Steps (SITE_DOWN_CHECK):
  1. Get all active projects
  2. For each: HTTP HEAD to domain (10s timeout)
  3. If failure: retry once after 5 min
  4. If still failing: check cooldown (last alert > 24h ago?)
  5. If cooldown passed: create alert_event, send email

Steps (RANKING_CHECK):
  1. Get all RANKING_DROP alerts
  2. For each: compare latest position vs previous
  3. If delta > threshold and cooldown passed: alert

Retry: 1 attempt
Timeout: 10 minutes
```

### 5. AI Insight Generation Job

```
Queue: ai
Trigger: Daily at 4:00 AM (after GSC sync completes)

Input:
{
  "projectId": "clxyz123"
}

Steps:
  1. Load project data (rankings, crawl, traffic)
  2. Build insight prompt for Claude Haiku
  3. Generate 1-3 insight cards
  4. Cache in Redis with 24h TTL
  5. Key: insights:{projectId}

Output: { insightCount: 3 }

Retry: 2 attempts
Timeout: 2 minutes
```

### 6. Maintenance Jobs

```
Queue: maintenance

Job: TOKEN_CLEANUP
Trigger: Daily at midnight
Steps: DELETE FROM refresh_tokens WHERE expires_at < now()

Job: USAGE_RESET
Trigger: 1st of each month at midnight
Steps:
  For Free plan users only (paid plans reset via Stripe webhook):
    Reset all UsageRecord counts to 0 for new month period

Job: KEYWORD_CACHE_REFRESH
Trigger: Weekly on Sunday at midnight
Steps:
  Find KeywordCache entries with updatedAt > 30 days
  Batch fetch from DataForSEO
  Update cache entries

Job: WORDPRESS_HEALTH_CHECK
Trigger: Weekly on Monday at 6 AM
Steps:
  For each WordPressConnection:
    GET /wp-json/wp/v2/posts?per_page=1 with stored credentials
    If 401/403: set isValid=false, notify user via email
    If 200: update lastVerifiedAt, keep isValid=true
    If timeout: skip, retry next cycle

Job: GITHUB_DEPLOY_RECRAWL
Trigger: On-demand (queued when GitHub push webhook received)
Steps:
  1. Wait 2 minutes (for deploy to propagate to hosting)
  2. Queue a site crawl for the project (same as user-initiated crawl)
  3. Log "Deploy detected, re-crawl triggered" in project activity
```

---

## Cron Schedule

| Time | Job | Queue |
|------|-----|-------|
| Every 15 min | Site uptime check | alert |
| Every 15 min | Alert condition evaluation | alert |
| 2:00 AM | GSC rank sync (staggered) | sync |
| 3:00 AM | GA traffic sync (staggered) | sync |
| 4:00 AM | AI insight generation | ai |
| Sunday 6:00 AM | Auto weekly reports | report |
| Sunday midnight | Keyword cache refresh | maintenance |
| Monday 6:00 AM | WordPress health check | maintenance |
| Daily midnight | Token cleanup | maintenance |
| 1st of month midnight | Usage counter reset (free plans) | maintenance |
| On GitHub push webhook | Deploy re-crawl (2 min delay) | crawl |

### Staggering Strategy

For jobs that process all projects (GSC sync, GA sync):

```
// Spread 1,000 projects across 60 minutes
const minuteOffset = hashCode(projectId) % 60;

// Project A syncs at 2:00 + 23 min = 2:23 AM
// Project B syncs at 2:00 + 47 min = 2:47 AM
// Project C syncs at 2:00 + 5 min = 2:05 AM

// This prevents all projects hitting Google API simultaneously
```

---

## Job Queue Configuration

### BullMQ Queue Options

```typescript
// Per-queue configuration
const QUEUE_CONFIG = {
  crawl: {
    concurrency: 5,
    limiter: { max: 10, duration: 60000 },    // max 10 jobs per minute
    defaultJobOptions: {
      attempts: 1,
      timeout: 1800000,     // 30 minutes
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  },
  report: {
    concurrency: 2,
    defaultJobOptions: {
      attempts: 2,
      timeout: 300000,      // 5 minutes
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 200 },
    },
  },
  sync: {
    concurrency: 3,
    limiter: { max: 20, duration: 60000 },    // respect Google API limits
    defaultJobOptions: {
      attempts: 3,
      timeout: 300000,      // 5 minutes
      backoff: { type: 'exponential', delay: 60000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  },
  alert: {
    concurrency: 1,         // sequential to prevent duplicate alerts
    defaultJobOptions: {
      attempts: 1,
      timeout: 600000,      // 10 minutes
      removeOnComplete: { count: 100 },
    },
  },
  ai: {
    concurrency: 2,
    limiter: { max: 10, duration: 60000 },
    defaultJobOptions: {
      attempts: 2,
      timeout: 120000,      // 2 minutes
      backoff: { type: 'fixed', delay: 30000 },
      removeOnComplete: { count: 200 },
    },
  },
  maintenance: {
    concurrency: 1,
    defaultJobOptions: {
      attempts: 1,
      timeout: 600000,      // 10 minutes
      removeOnComplete: { count: 10 },
    },
  },
};
```

### Job Priority

```
Priority 1 (highest): User-initiated crawls, manual sync
Priority 5 (normal):  Scheduled crawls, auto-reports
Priority 10 (lowest): Maintenance, cache refresh
```

---

## Error Handling & Retries

### Retry Strategy Per Job Type

| Job Type | Max Attempts | Backoff | Reason |
|----------|-------------|---------|--------|
| GSC Sync | 3 | Exponential (1m, 5m, 15m) | Google API can have transient failures |
| Site Crawl | 1 | None | Expensive, user can re-trigger |
| Report | 2 | Exponential (30s, 60s) | Puppeteer can crash |
| Alert Check | 1 | None | Runs every 15 min anyway |
| AI Insight | 2 | Fixed (30s) | Claude API can have transient errors |
| Maintenance | 1 | None | Non-critical, runs again next cycle |

### Failed Job Handling

```
When a job fails permanently (all retries exhausted):
  1. Log full error with stack trace (Pino logger)
  2. If user-initiated (crawl, report):
     - Update status in DB to FAILED
     - Emit WebSocket failure event (if applicable)
  3. If scheduled (sync, alert):
     - Log to monitoring
     - Will retry in next scheduled cycle
  4. Keep failed job data in Redis for 7 days (for debugging)
```

### Dead Letter Queue

Jobs that fail all retry attempts go to a dead letter pattern:
- Kept in Redis for 7 days
- Queryable via BullMQ Dashboard (optional Phase 2)
- Alert super admin if dead letter count exceeds threshold

---

## Monitoring

### Job Metrics to Track

| Metric | Why |
|--------|-----|
| Queue depth (pending jobs) | Detect backlog / capacity issues |
| Job processing time | Detect slow APIs or growing datasets |
| Job failure rate | Detect broken integrations or API changes |
| Jobs completed per hour | Capacity planning |

### Logging

Every job logs:
```json
{
  "level": "info",
  "jobId": "job123",
  "queue": "sync",
  "projectId": "clxyz123",
  "status": "completed",
  "duration": 4500,
  "message": "GSC sync completed: 45 keywords updated"
}
```

On failure:
```json
{
  "level": "error",
  "jobId": "job123",
  "queue": "sync",
  "projectId": "clxyz123",
  "status": "failed",
  "attempt": 3,
  "error": "Google API returned 403: quota exceeded",
  "stack": "..."
}
```

### Health Check Endpoint

```
GET /api/health

Response:
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "queues": {
    "crawl": { "waiting": 2, "active": 3, "failed": 0 },
    "report": { "waiting": 0, "active": 1, "failed": 0 },
    "sync": { "waiting": 15, "active": 3, "failed": 1 },
    "alert": { "waiting": 0, "active": 0, "failed": 0 }
  },
  "uptime": 86400
}
```
