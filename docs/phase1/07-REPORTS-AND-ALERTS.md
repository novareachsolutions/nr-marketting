# Phase 1 - Reports & Alerts

> **Reports:** Puppeteer-rendered HTML-to-PDF with Handlebars templates
> **Alerts:** Database-driven checks every 15 minutes, email delivery

---

## Table of Contents

- [Reporting Module](#reporting-module)
- [PDF Report Structure](#pdf-report-structure)
- [PDF Generation Pipeline](#pdf-generation-pipeline)
- [Report Templates](#report-templates)
- [Alerts Module](#alerts-module)
- [Alert Types](#alert-types)
- [Alert Processing](#alert-processing)
- [API Endpoints](#api-endpoints)

---

## Reporting Module

### What It Does

Generates professional PDF reports summarizing a project's SEO performance over a date range. Users can generate on-demand or schedule weekly auto-reports.

### Features

- Generate on-demand PDF reports for any date range
- Weekly auto-generated reports (Sunday 6 AM)
- Report sections: rankings, traffic, site health, AI summary
- Download as PDF
- Email report to self or client
- Report history (list past reports, re-download)

---

## PDF Report Structure

### Page Layout

```
+--------------------------------------------------+
|  [Logo]    SEO Performance Report                |
|            mywebsite.com                          |
|            March 1 - March 31, 2026              |
+--------------------------------------------------+

Section 1: Executive Summary
+--------------------------------------------------+
|  Health Score: 78/100 (+5 from last period)      |
|                                                  |
|  Top Wins:                                       |
|   - "best shoes" improved from #9 to #4         |
|   - Organic traffic up 12% month-over-month      |
|   - Fixed 15 broken links from last audit        |
|                                                  |
|  Top Issues:                                     |
|   - 3 pages returning 404 errors                 |
|   - Mobile page speed degraded on /products      |
|   - Lost 2 referring domains this month          |
+--------------------------------------------------+

Section 2: Keyword Rankings
+--------------------------------------------------+
|  [Line chart: top 5 keywords position over time] |
|                                                  |
|  Keyword             Position  Change  Clicks    |
|  best shoes          #4        +5      450       |
|  running shoes       #8        -2      120       |
|  shoe reviews        #12       +1      85        |
|  cheap shoes         #15       0       62        |
|  shoes online        #22       +3      35        |
|                                                  |
|  Keywords in top 10: 12 (+3 from last period)    |
|  Keywords in top 20: 28 (+5 from last period)    |
+--------------------------------------------------+

Section 3: Organic Traffic
+--------------------------------------------------+
|  [Bar chart: daily sessions over period]         |
|                                                  |
|  Metric              This Period  Previous  %Chg |
|  Sessions            12,500       11,200    +12% |
|  Users               9,800        8,900     +10% |
|  Bounce Rate         42%          45%       -3%  |
|  Avg Session Duration 2:15        2:05      +8%  |
|                                                  |
|  Top Pages:                                      |
|  1. /blog/best-shoes       2,100 sessions        |
|  2. /products              1,800 sessions        |
|  3. /blog/shoe-reviews     1,200 sessions        |
+--------------------------------------------------+

Section 4: Site Health
+--------------------------------------------------+
|  [Gauge: health score 78/100]                    |
|                                                  |
|  Issues Summary:                                 |
|  Errors:    8  (3 new, 2 fixed)                  |
|  Warnings:  45 (5 new, 8 fixed)                  |
|  Notices:   23 (2 new, 1 fixed)                  |
|                                                  |
|  Top Errors:                                     |
|  - /old-page returns 404                         |
|  - /about-us missing H1 tag                      |
|  - /products has noindex tag (likely accidental)  |
+--------------------------------------------------+

Section 5: AI Recommendations
+--------------------------------------------------+
|  Based on your data, here are the top 3 actions: |
|                                                  |
|  1. Fix the noindex tag on /products - this page |
|     gets 1,800 sessions/month and may get        |
|     deindexed from Google                        |
|                                                  |
|  2. Update content on /blog/best-shoes - top     |
|     competitors have 2x more content with        |
|     recent product reviews                       |
|                                                  |
|  3. Fix 3 broken internal links on high-traffic  |
|     pages to improve crawl efficiency            |
+--------------------------------------------------+

Footer:
+--------------------------------------------------+
|  Generated by SEO Platform | March 31, 2026      |
|  Page 1 of 3                                     |
+--------------------------------------------------+
```

---

## PDF Generation Pipeline

```
1. User clicks "Generate Report" (or scheduled cron triggers)

2. Create Report record in DB (status: PENDING)

3. Add job to BullMQ report queue

4. Worker picks up job:
   a. Set Report status: GENERATING
   b. Fetch all data:
      - Rankings: latest positions + 30-day history
      - Traffic: GA sessions, users, bounce rate for period
      - Site audit: latest crawl score and issue counts
      - AI: generate executive summary via Claude Haiku
   c. Render Handlebars template with data
   d. Launch Puppeteer -> load HTML -> generate PDF
   e. Save PDF to disk (or S3 in production)
   f. Update Report record: status=COMPLETED, filePath, fileSize

5. If user requested email delivery:
   - Attach PDF to email
   - Send via SendGrid

6. If generation fails:
   - Set Report status: FAILED
   - Log error for debugging
```

### Puppeteer PDF Settings

```javascript
const pdf = await page.pdf({
  format: 'A4',
  printBackground: true,        // Include background colors/images
  margin: {
    top: '40px',
    bottom: '60px',
    left: '40px',
    right: '40px',
  },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="font-size: 10px; text-align: center; width: 100%; color: #666;">
      Generated by SEO Platform | <span class="date"></span> | Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>
  `,
});
```

### File Storage

**Phase 1:** Store PDFs on local disk at `/data/reports/{projectId}/{reportId}.pdf`
**Phase 2+:** Migrate to S3-compatible storage (DigitalOcean Spaces, AWS S3, MinIO)

---

## Report Templates

Using **Handlebars** (.hbs) for HTML templating.

### Template Structure

```
reports/
  |-- report-templates/
      |-- weekly-report.hbs        # Full report layout
      |-- partials/
          |-- header.hbs           # Logo + title + date range
          |-- executive-summary.hbs
          |-- rankings-section.hbs
          |-- traffic-section.hbs
          |-- site-health-section.hbs
          |-- ai-recommendations.hbs
          |-- footer.hbs
      |-- styles/
          |-- report.css           # Print-optimized styles
```

### Template Data Interface

```typescript
interface ReportData {
  // Meta
  projectName: string;
  domain: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  logoUrl?: string;           // white-label (Agency plan, Phase 3)

  // Executive Summary
  healthScore: number;
  healthScoreChange: number;
  topWins: string[];
  topIssues: string[];

  // Rankings
  trackedKeywords: {
    keyword: string;
    position: number;
    change: number;
    clicks: number;
    impressions: number;
  }[];
  keywordsInTop10: number;
  keywordsInTop10Change: number;

  // Traffic
  sessions: number;
  sessionsChange: number;
  users: number;
  usersChange: number;
  bounceRate: number;
  bounceRateChange: number;
  avgSessionDuration: string;
  topPages: { path: string; sessions: number }[];
  dailyTraffic: { date: string; sessions: number }[];

  // Site Health
  errorCount: number;
  warningCount: number;
  noticeCount: number;
  newErrors: number;
  fixedErrors: number;
  topErrors: { page: string; issue: string }[];

  // AI
  aiRecommendations: {
    priority: number;
    action: string;
    impact: string;
  }[];
}
```

---

## Alerts Module

### What It Does

Monitors project data and sends notifications when important changes occur. Email delivery in Phase 1. Slack + SMS in Phase 2.

### Alert Types (Phase 1)

| Alert Type | Trigger | Severity |
|-----------|---------|----------|
| `RANKING_DROP` | Any tracked keyword drops > N positions | High |
| `RANKING_GAIN` | Any tracked keyword improves > N positions | Low (positive) |
| `SITE_DOWN` | Project domain returns 5xx or times out | Critical |
| `NEW_CRAWL_ERRORS` | New site audit finds new ERROR-level issues | Medium |
| `CRAWL_SCORE_DROP` | Health score drops > 10 points vs previous crawl | Medium |

### Alert Configuration

Users can configure alerts per project:

```json
{
  "projectId": "clxyz123",
  "alerts": [
    {
      "type": "RANKING_DROP",
      "threshold": 5,
      "isActive": true,
      "channel": "EMAIL"
    },
    {
      "type": "SITE_DOWN",
      "threshold": null,
      "isActive": true,
      "channel": "EMAIL"
    }
  ]
}
```

Default alerts (auto-created for every new project):
- RANKING_DROP with threshold 5 (active)
- SITE_DOWN (active)
- NEW_CRAWL_ERRORS (active)

---

## Alert Processing

### Check Schedule

```
Cron: Every 15 minutes

For each active alert across all projects:
  1. Evaluate condition against latest data
  2. If triggered:
     a. Check cooldown (don't re-alert within 24 hours for same condition)
     b. If cooldown passed: create alert_event + send notification
     c. If cooldown active: skip
```

### Site Down Check

```
Every 15 minutes:
  For each active project:
    1. HTTP HEAD request to https://{domain}
    2. Timeout: 10 seconds
    3. If response >= 500 OR timeout:
       a. Mark as "possibly down"
       b. Retry in 5 minutes (confirm before alerting)
    4. If second check also fails:
       a. Trigger SITE_DOWN alert
       b. Send email immediately
    5. If site recovers:
       a. Send "Site is back up" notification
       b. Include downtime duration
```

### Email Templates

**Ranking Drop:**
```
Subject: [SEO Alert] Keyword ranking dropped on mywebsite.com

Hi {name},

Your keyword "{keyword}" dropped from position #{oldPosition} to #{newPosition}
on {date} for {domain}.

This is a change of {delta} positions.

View your rankings: {FRONTEND_URL}/projects/{projectId}/rankings

— SEO Platform Alerts
```

**Site Down:**
```
Subject: [URGENT] mywebsite.com appears to be down

Hi {name},

We detected that {domain} is not responding.

Status: {statusCode or "Timeout"}
Checked at: {timestamp}

We'll notify you when it comes back up.

— SEO Platform Alerts
```

---

## API Endpoints

### Reports

```
POST   /api/projects/:id/reports/generate      Generate a new report
GET    /api/projects/:id/reports                List all reports for project
GET    /api/projects/:id/reports/:reportId      Get report metadata
GET    /api/projects/:id/reports/:reportId/download   Download PDF file
DELETE /api/projects/:id/reports/:reportId      Delete a report
```

**Generate report request:**
```json
{
  "type": "WEEKLY",
  "dateFrom": "2026-03-01",
  "dateTo": "2026-03-31",
  "emailTo": "client@example.com"
}
```

**Generate report response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "reportId": "rpt123",
    "status": "PENDING",
    "message": "Report generation started. You'll be notified when ready."
  }
}
```

**List reports response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "rpt123",
      "title": "Weekly Report - Mar 1-31, 2026",
      "type": "WEEKLY",
      "dateFrom": "2026-03-01",
      "dateTo": "2026-03-31",
      "status": "COMPLETED",
      "fileSize": 245000,
      "createdAt": "2026-03-31T06:00:00.000Z"
    }
  ]
}
```

### Alerts

```
GET    /api/projects/:id/alerts                 List alert configurations
POST   /api/projects/:id/alerts                 Create/update alert config
PUT    /api/projects/:id/alerts/:alertId        Update alert (threshold, active, channel)
DELETE /api/projects/:id/alerts/:alertId        Delete alert
GET    /api/projects/:id/alerts/history         List triggered alert events
```

**Alert config response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "alert123",
      "type": "RANKING_DROP",
      "threshold": 5,
      "isActive": true,
      "channel": "EMAIL",
      "lastTriggered": "2026-03-28T10:00:00.000Z"
    }
  ]
}
```

**Alert history response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "evt123",
      "alertType": "RANKING_DROP",
      "detail": "Keyword 'best shoes' dropped from #4 to #9",
      "triggeredAt": "2026-03-28T10:00:00.000Z"
    }
  ]
}
```
