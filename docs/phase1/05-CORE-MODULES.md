# Phase 1 - Core Modules

> **Modules:** Project/Workspace (with WordPress + GitHub integrations), Domain Overview, Keyword Research, Rank Tracking, Organic Traffic Insights, Site Audit
> **These 6 modules are the heart of the product — they deliver 80% of user value.**

---

## Table of Contents

- [Module 1: Project / Workspace](#module-1-project--workspace)
- [Module 2: Domain Overview](#module-2-domain-overview)
- [Module 3: Keyword Research](#module-3-keyword-research)
- [Module 4: Rank Tracking](#module-4-rank-tracking)
- [Module 5: Organic Traffic Insights](#module-5-organic-traffic-insights)
- [Module 6: Site Audit](#module-6-site-audit)

---

## Module 1: Project / Workspace

### What It Does

A project represents a website the user wants to track. Everything in the platform is scoped to a project.

### Features

- Create / edit / delete a project (domain + display name)
- Add competitor domains (up to 2/5/10 per plan)
- View project dashboard (summary of all modules)
- Connect project to Google Analytics + Search Console properties
- **Connect to WordPress** (auto-fix issues, publish content directly)
- **Connect to GitHub** (auto-PR fixes, deploy detection, source file analysis)

### 3 Ways to Add a Project

| Method | Setup | Works For | Key Benefit |
|--------|-------|-----------|-------------|
| **Enter domain** (MANUAL) | Zero setup | Any website | Universal, no barriers |
| **Connect WordPress** | 2 min | WordPress sites (~43% of web) | Auto-fix issues, publish AI content |
| **Connect GitHub** | 1 min OAuth | Sites with code on GitHub | Auto-PR fixes, deploy detection |

**All 3 methods always get the full SEO toolkit** (keywords, rankings, audit, AI). WordPress/GitHub just add write-back capabilities on top.

### Business Rules

1. **Domain normalization on save:**
   - Remove `http://`, `https://`
   - Remove `www.`
   - Lowercase everything
   - Remove trailing `/`
   - `https://WWW.MyWebsite.com/` -> `mywebsite.com`

2. **Uniqueness:** A user cannot add the same domain twice

3. **Plan limits on project count:**
   - Free: 1 project
   - Pro: 5 projects
   - Agency: 25 projects

4. **Cascade deletion:** Deleting a project deletes ALL related data (keywords, rankings, crawls, reports, WP/GitHub connections)

5. **Soft disable:** Projects can be set `isActive: false` without deleting data

6. **Source type can be changed later:** A MANUAL project can connect WordPress/GitHub at any time via settings

---

### WordPress Integration

#### Connection Methods

**Option A: WordPress Application Password (no plugin needed)**
```
1. User selects "WordPress" when creating project
2. User goes to WordPress Admin -> Users -> Profile -> Application Passwords
3. User creates an Application Password, copies it
4. User enters WordPress URL + username + app password in our platform
5. Backend verifies by calling WP REST API: GET /wp-json/wp/v2/posts?per_page=1
6. If valid: store encrypted credentials, detect WP version and SEO plugin
7. Project sourceType set to WORDPRESS
```

**Option B: Our Custom WordPress Plugin (better UX, more features)**
```
1. User installs our plugin from WordPress Plugin Directory
2. Plugin generates a unique API key
3. User enters the API key in our platform
4. Plugin exposes additional endpoints:
   - Bulk update meta tags across posts/pages
   - Read Yoast/RankMath SEO settings
   - Push content directly with SEO metadata
   - Webhook on post publish (trigger re-crawl)
```

#### What WordPress Connection Unlocks

| Feature | Without WP | With WP |
|---------|-----------|---------|
| Find SEO issues | Yes (crawl) | Yes |
| **Fix SEO issues** | Manual | **Auto-fix from dashboard** (update title, meta desc, alt tags via API) |
| Content suggestions | AI generates text | **Publish AI articles directly to WordPress** |
| On-page SEO | Show what's wrong | **Push changes live** (edit post metadata via API) |
| Sitemap | Crawl to discover | **Read sitemap.xml from WP REST API** |
| SEO plugin data | No access | **Read Yoast/RankMath settings** |

#### WordPress REST API Endpoints Used

```
Verify connection:   GET  /wp-json/wp/v2/posts?per_page=1
Read posts:          GET  /wp-json/wp/v2/posts
Read pages:          GET  /wp-json/wp/v2/pages
Update post meta:    POST /wp-json/wp/v2/posts/{id}  (title, excerpt, meta)
Create post:         POST /wp-json/wp/v2/posts
Read media:          GET  /wp-json/wp/v2/media
Update media alt:    POST /wp-json/wp/v2/media/{id}
Read site info:      GET  /wp-json
Yoast meta:          GET  /wp-json/yoast/v1/get_head?url={page_url}
RankMath meta:       GET  /wp-json/rankmath/v1/getHead?url={page_url}
```

#### Auto-Fix Flow (WordPress)

```
User sees crawl issue: "Missing meta description on /about-us"
User clicks "Auto-Fix" button

1. Backend looks up WordPress page by URL slug
   GET /wp-json/wp/v2/pages?slug=about-us

2. AI generates meta description based on page content
   Claude Haiku: "Summarize this page in 155 characters for SEO"

3. Backend updates the page via WP REST API
   POST /wp-json/wp/v2/pages/{pageId}
   Body: { "meta": { "_yoast_wpseo_metadesc": "generated description" } }
   (or equivalent for RankMath)

4. Mark issue as "Fixed (auto)" in crawl results
5. Queue re-crawl of that specific page to verify
```

---

### GitHub Integration

#### Connection Flow

```
1. User selects "GitHub" when creating project (or connects later)
2. Redirect to GitHub OAuth consent:
   GET https://github.com/login/oauth/authorize
     ?client_id={GITHUB_CLIENT_ID}
     &redirect_uri={API_URL}/api/github/callback
     &scope=repo
     &state={csrf_token}

3. User authorizes our app on GitHub
4. GitHub redirects back with code
5. Backend exchanges code for access token:
   POST https://github.com/login/oauth/access_token

6. Backend lists user's repositories:
   GET https://api.github.com/user/repos

7. User selects the repository for this project
8. Backend:
   a. Store encrypted access token
   b. Detect default branch
   c. Auto-detect deploy URL:
      - Check for CNAME file (GitHub Pages custom domain)
      - Check repo settings for GitHub Pages URL
      - Check for vercel.json (Vercel deployment)
      - Check for netlify.toml (Netlify deployment)
   d. Set up webhook for push events (deploy detection)
   e. Set project sourceType to GITHUB
```

#### What GitHub Connection Unlocks

| Feature | Without GitHub | With GitHub |
|---------|--------------|-------------|
| Site Audit | Crawl live site | Crawl + **read source files directly** |
| Fix issues | Manual | **Create PRs with fixes** (meta tags, alt text, robots.txt) |
| Deploy detection | Unknown | **Auto re-crawl after deploy** (webhook) |
| Content publishing | Manual | **Commit AI articles to repo** (static sites) |
| robots.txt | Crawl to find | **Read and edit directly in repo** |
| Redirects | Can't see | **Read/suggest rules** (.htaccess, _redirects, vercel.json) |
| Source analysis | Live HTML only | **Analyze templates, components, config files** |

#### Auto-Fix via Pull Request

```
User sees crawl issue: "Missing meta description on /about"
User clicks "Fix via PR" button

1. Backend creates a new branch:
   POST /repos/{owner}/{repo}/git/refs
   Branch: fix/seo-add-meta-description-about

2. Backend reads the source file:
   GET /repos/{owner}/{repo}/contents/pages/about.tsx
   (or about.html, about.md — detected from repo structure)

3. AI generates the fix:
   Claude: "Add this meta description tag to the <Head> component"

4. Backend commits the change:
   PUT /repos/{owner}/{repo}/contents/pages/about.tsx
   Body: { branch: "fix/seo-...", content: base64(updatedFile), message: "SEO: Add meta description to /about" }

5. Backend opens a Pull Request:
   POST /repos/{owner}/{repo}/pulls
   {
     title: "SEO: Add meta description to /about page",
     body: "## Auto-generated by SEO Platform\n\nIssue: Missing meta description...\nFix: Added meta description based on page content.\n\nDetected in site audit on 2026-03-31.",
     head: "fix/seo-add-meta-description-about",
     base: "main"
   }

6. Show PR link to user in dashboard
7. When user merges -> webhook fires -> auto re-crawl -> issue resolved
```

#### Deploy Detection (Webhook)

```
When GitHub connection is established:
  1. Create webhook on the repo:
     POST /repos/{owner}/{repo}/hooks
     {
       events: ["push", "deployment_status"],
       config: {
         url: "{API_URL}/api/github/webhook",
         content_type: "json",
         secret: "{generated_webhook_secret}"
       }
     }

  2. When push to default branch is detected:
     - Wait 2 minutes (for deploy to propagate)
     - Queue a re-crawl of the project
     - Show "Deploy detected" notification on dashboard

  3. Webhook signature verified using stored webhook_secret
```

#### GitHub API Endpoints Used

```
Auth:             POST https://github.com/login/oauth/access_token
List repos:       GET  /user/repos
Repo details:     GET  /repos/{owner}/{repo}
Read file:        GET  /repos/{owner}/{repo}/contents/{path}
Create/update:    PUT  /repos/{owner}/{repo}/contents/{path}
Create branch:    POST /repos/{owner}/{repo}/git/refs
Create PR:        POST /repos/{owner}/{repo}/pulls
Create webhook:   POST /repos/{owner}/{repo}/hooks
Delete webhook:   DELETE /repos/{owner}/{repo}/hooks/{id}
```

### Project Dashboard

The project dashboard is the landing page after selecting a project. It shows a summary card from each module:

```
+------------------------------------------------------+
| mywebsite.com                      [Settings] [Edit] |
+------------------------------------------------------+
|                                                      |
| +------------------+  +------------------+           |
| | Keywords Tracked |  | Avg. Position    |           |
| |       45         |  |     12.3         |           |
| |  +5 this week    |  |  -2.1 improved   |           |
| +------------------+  +------------------+           |
|                                                      |
| +------------------+  +------------------+           |
| | Organic Traffic  |  | Site Health      |           |
| |    12,500/mo     |  |     78/100       |           |
| |  +8% vs last mo  |  |  3 new errors    |           |
| +------------------+  +------------------+           |
|                                                      |
| +------------------+  +------------------+           |
| | Top Keyword      |  | AI Suggestion    |           |
| | "best shoes" #4  |  | Fix 3 broken     |           |
| |  was #7 last wk  |  | links on /blog   |           |
| +------------------+  +------------------+           |
+------------------------------------------------------+
```

### API Endpoints

```
GET    /api/projects                     List all projects for current user
POST   /api/projects                     Create a new project
GET    /api/projects/:id                 Get project details + dashboard summary
PUT    /api/projects/:id                 Update project (name, timezone)
DELETE /api/projects/:id                 Delete project and all data

GET    /api/projects/:id/competitors     List competitors
POST   /api/projects/:id/competitors     Add a competitor
DELETE /api/projects/:id/competitors/:cId Remove a competitor

# WordPress Integration
POST   /api/projects/:id/wordpress/connect       Connect WordPress (verify + store creds)
GET    /api/projects/:id/wordpress/status         Check WP connection status
POST   /api/projects/:id/wordpress/verify         Re-verify credentials
DELETE /api/projects/:id/wordpress/disconnect      Disconnect WordPress
POST   /api/projects/:id/wordpress/fix-issue/:issueId   Auto-fix an issue via WP API
POST   /api/projects/:id/wordpress/publish-content       Publish AI content to WordPress

# GitHub Integration
GET    /api/github/authorize                      Redirect to GitHub OAuth
GET    /api/github/callback                       Handle GitHub OAuth callback
POST   /api/projects/:id/github/connect           Select repo + set up webhook
GET    /api/projects/:id/github/status             Check GitHub connection status
GET    /api/projects/:id/github/repos              List user's GitHub repos
DELETE /api/projects/:id/github/disconnect          Disconnect GitHub
POST   /api/projects/:id/github/fix-issue/:issueId  Create PR to fix an issue
POST   /api/github/webhook                         GitHub webhook receiver (push events)
```

### DTOs

**Create Project (with source type):**
```json
{
  "domain": "example.com",
  "name": "My Website",
  "timezone": "America/New_York",
  "sourceType": "MANUAL"
}
```

**Connect WordPress:**
```json
{
  "siteUrl": "https://mywebsite.com",
  "username": "admin",
  "appPassword": "xxxx xxxx xxxx xxxx xxxx xxxx",
  "authMethod": "APP_PASSWORD"
}
```

**Connect GitHub (after OAuth, select repo):**
```json
{
  "repoFullName": "username/my-website"
}
```

**Project Response:**
```json
{
  "id": "clxyz123",
  "domain": "example.com",
  "name": "My Website",
  "timezone": "America/New_York",
  "sourceType": "WORDPRESS",
  "isActive": true,
  "competitorCount": 3,
  "trackedKeywordCount": 45,
  "lastCrawlScore": 78,
  "wordpressConnected": true,
  "githubConnected": false,
  "googleConnected": true,
  "createdAt": "2026-03-01T00:00:00.000Z"
}
```

---

## Module 2: Domain Overview

### What It Does

Enter any domain and instantly see its organic traffic estimate, top keywords, backlink count, and key metrics. Like Semrush's Domain Overview tool.

### Features

- Enter any domain (not just your own project)
- See at a glance: organic traffic, organic keywords count, backlinks count, domain authority
- Top 10 organic keywords with positions
- Traffic trend chart (last 12 months)
- Top competitors by organic keywords overlap

### Data Source

**DataForSEO Domain Analytics API**

### API Call to DataForSEO

```
POST https://api.dataforseo.com/v3/dataforseo_labs/google/domain_metrics_by_categories/live

Auth: Basic base64(login:password)

Body:
[{
  "target": "example.com",
  "location_code": 2840,         // United States
  "language_code": "en"
}]
```

For top organic keywords:
```
POST https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live

Body:
[{
  "target": "example.com",
  "location_code": 2840,
  "language_code": "en",
  "limit": 10,
  "order_by": ["keyword_data.keyword_info.search_volume,desc"]
}]
```

### Caching

- Cache domain overview data in Redis for **24 hours**
- Key: `dom:{normalized_domain}`
- Saves API costs when multiple users look up the same domain
- User can force-refresh (clears cache and re-fetches)

### API Endpoints

```
GET /api/domain-overview?domain=example.com&country=US
```

### Response

```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "metrics": {
      "organicTraffic": 125000,
      "organicKeywords": 8500,
      "backlinks": 45000,
      "referringDomains": 2300
    },
    "topKeywords": [
      {
        "keyword": "example product",
        "position": 1,
        "searchVolume": 12000,
        "traffic": 3600
      }
    ],
    "trafficTrend": [
      { "month": "2025-04", "traffic": 98000 },
      { "month": "2025-05", "traffic": 102000 }
    ]
  }
}
```

---

## Module 3: Keyword Research

### What It Does

User types a seed keyword -> system returns keyword suggestions with metrics (volume, difficulty, CPC). Covers Semrush's Keyword Overview (#3) and Keyword Magic Tool (#4).

### Features

- **Keyword search:** Type a keyword, get volume, difficulty, CPC, trend
- **Keyword suggestions:** Get hundreds of related/long-tail keywords grouped by topic
- **Save keywords:** Add keywords to a project for tracking
- **Keyword list:** View and manage saved keywords per project

### Data Source

**DataForSEO Keyword Data API + Keyword Suggestions API**

### Keyword Overview API Call

```
POST https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live

Body:
[{
  "keywords": ["best running shoes", "running shoes review"],
  "location_code": 2840,
  "language_code": "en"
}]
```

Response per keyword:
```json
{
  "keyword": "best running shoes",
  "search_volume": 33100,
  "competition": 0.87,
  "competition_level": "HIGH",
  "cpc": 1.45,
  "monthly_searches": [
    { "year": 2026, "month": 3, "search_volume": 33100 },
    { "year": 2026, "month": 2, "search_volume": 30500 }
  ]
}
```

### Keyword Suggestions API Call (Magic Tool)

```
POST https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live

Body:
[{
  "keyword": "running shoes",
  "location_code": 2840,
  "language_code": "en",
  "include_seed_keyword": true,
  "limit": 100
}]
```

Returns related keywords: "best running shoes", "running shoes for flat feet", "cheap running shoes", etc.

### Keyword Difficulty Score

DataForSEO returns a `keyword_difficulty` score (0-100):
- **0-29:** Easy (low competition, new sites can rank)
- **30-49:** Medium (some effort needed)
- **50-69:** Hard (need authority and good content)
- **70-84:** Very Hard (need strong backlinks)
- **85-100:** Extreme (dominated by big brands)

### Caching Strategy

```
1. User searches "best running shoes"
2. Check keyword_cache table: SELECT WHERE keyword = 'best running shoes' AND country = 'US'
3. If found AND updatedAt < 30 days ago: return cached data
4. If not found OR stale: call DataForSEO API, store result, return
```

This shared cache saves significant API costs. Popular keywords are looked up by many users.

### API Endpoints

```
GET  /api/keywords/search?q=running+shoes&country=US           Keyword overview (volume, difficulty, CPC)
GET  /api/keywords/suggestions?q=running+shoes&country=US       Keyword suggestions (magic tool)
GET  /api/projects/:id/keywords                                 List saved keywords for project
POST /api/projects/:id/keywords                                 Save keyword(s) to project
DELETE /api/projects/:id/keywords/:keywordId                    Remove saved keyword
```

### Request/Response Examples

**Search keywords:**
```
GET /api/keywords/search?q=best+running+shoes&country=US

Response:
{
  "success": true,
  "data": {
    "keyword": "best running shoes",
    "country": "US",
    "searchVolume": 33100,
    "difficulty": 72,
    "cpc": 1.45,
    "trend": [33100, 30500, 28900, 35200, ...],  // last 12 months
    "competitionLevel": "HIGH"
  }
}
```

**Keyword suggestions:**
```
GET /api/keywords/suggestions?q=running+shoes&country=US&limit=50

Response:
{
  "success": true,
  "data": {
    "seed": "running shoes",
    "total": 850,
    "keywords": [
      {
        "keyword": "best running shoes for flat feet",
        "searchVolume": 8100,
        "difficulty": 45,
        "cpc": 1.20
      },
      {
        "keyword": "running shoes on sale",
        "searchVolume": 14800,
        "difficulty": 38,
        "cpc": 0.95
      }
    ]
  },
  "meta": { "page": 1, "perPage": 50, "total": 850 }
}
```

**Save keyword to project:**
```
POST /api/projects/:id/keywords
{
  "keyword": "best running shoes",
  "targetUrl": "/blog/best-running-shoes"
}
```

---

## Module 4: Rank Tracking

### What It Does

Tracks where a website appears on Google for specific keywords over time. Shows position trends, clicks, impressions, CTR.

### Features

- Add keywords to track (from saved keywords or manually)
- Daily position sync from Google Search Console
- Position history charts (line chart, Y-axis inverted: 1 = top)
- Filter by device (desktop/mobile) and country
- Position change indicators (up/down arrows with delta)
- Compare current position vs 7 days ago, 30 days ago

### Data Sources

| Source | Used For | Cost |
|--------|---------|------|
| **Google Search Console API** | Own site rankings (primary) | Free |
| **DataForSEO Domain Organic API** | Competitor rankings (secondary) | Paid |

### Why GSC (Not SERP Scraping)

- GSC gives **real Google data** for free
- GSC provides **all keywords** your site appears for (not just ones you specify)
- GSC includes **clicks and impressions** (SERP scrapers can't provide this)
- No proxy costs, no blocking risk, no CAPTCHA issues
- Averaged position (e.g., 7.3) is fine for trend tracking

### Daily Sync Job Flow

```
Trigger: Cron at 2:00 AM daily

For each project with GSC connected:
  1. Get all active TrackedKeywords for this project
  2. Call GSC API:
     - Date range: last 7 days (to catch late-arriving data)
     - Dimensions: query, date, device, country
     - Filter by project's country setting
  3. For each row in GSC response:
     a. Find matching TrackedKeyword by (keyword, device, country)
     b. If match found:
        - Upsert RankingHistory for that date
        - (upsert = update if exists, insert if not)
     c. If no match: skip (keyword is not being tracked)
  4. After sync complete:
     - Compare today's positions with 7 days ago
     - If any keyword dropped > 5 positions: queue alert

Stagger by project: project_id hash % 60 = minute offset
This spreads 1,000 projects across 60 minutes instead of all at once.
```

### Position Display Logic

```
Position shown to user:
  - Latest available date from ranking_history
  - Label: "Position as of Mar 28" (2-3 day GSC delay)

Change calculation:
  - current_position vs position from 7 days ago
  - Up arrow (green) if position number decreased (e.g., 8 -> 5 = improved)
  - Down arrow (red) if position number increased (e.g., 5 -> 8 = dropped)
  - Dash if no change

Chart:
  - X-axis: dates (last 30/60/90 days)
  - Y-axis: position (INVERTED — 1 at top, 100 at bottom)
  - Line chart with dots per data point
```

### API Endpoints

```
GET    /api/projects/:id/rankings                     List all tracked keywords with latest position
GET    /api/projects/:id/rankings/history?keyword=:kw&days=30  Position history for a keyword
POST   /api/projects/:id/rankings/track               Add keyword(s) to tracking
DELETE /api/projects/:id/rankings/:trackedKeywordId    Stop tracking a keyword
POST   /api/projects/:id/rankings/sync                 Trigger manual GSC sync (rate limited)
```

### Response Examples

**List tracked keywords with latest position:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxyz123",
      "keyword": "best running shoes",
      "device": "DESKTOP",
      "country": "US",
      "targetUrl": "/blog/best-running-shoes",
      "currentPosition": 4.2,
      "previousPosition": 7.1,
      "change": -2.9,
      "changeDirection": "up",
      "clicks": 145,
      "impressions": 3200,
      "ctr": 0.045,
      "lastUpdated": "2026-03-28T00:00:00.000Z"
    },
    {
      "id": "clxyz456",
      "keyword": "running shoes review",
      "device": "DESKTOP",
      "country": "US",
      "targetUrl": "/reviews/running-shoes",
      "currentPosition": 12.5,
      "previousPosition": 9.8,
      "change": 2.7,
      "changeDirection": "down",
      "clicks": 32,
      "impressions": 1800,
      "ctr": 0.018,
      "lastUpdated": "2026-03-28T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "perPage": 50, "total": 45 }
}
```

**Ranking history for a keyword:**
```json
{
  "success": true,
  "data": {
    "keyword": "best running shoes",
    "history": [
      { "date": "2026-03-28", "position": 4.2, "clicks": 45, "impressions": 1200 },
      { "date": "2026-03-27", "position": 4.5, "clicks": 38, "impressions": 1100 },
      { "date": "2026-03-26", "position": 5.1, "clicks": 42, "impressions": 1150 },
      { "date": "2026-03-25", "position": 7.1, "clicks": 25, "impressions": 950 }
    ]
  }
}
```

---

## Module 5: Organic Traffic Insights

### What It Does

Merges Google Analytics traffic data with Search Console keyword data to show which keywords drive traffic to which pages. Covers Semrush's Organic Traffic Insights (#8).

### The Problem It Solves

Google Analytics shows page-level traffic but hides the keywords ("not provided").
Google Search Console shows keyword data but doesn't show actual session counts.
By merging both, you get: **page + keyword + real traffic data**.

### How The Merge Works

```
GA says:  /blog/running-shoes got 500 sessions this week
GSC says: /blog/running-shoes ranks for "best running shoes" at position 4
          with 120 clicks and 3,200 impressions

Combined output:
  Page: /blog/running-shoes
  Sessions: 500 (from GA)
  Top keyword: "best running shoes"
  Position: 4
  Clicks: 120
  Impressions: 3,200
  Estimated organic %: 24% (120 clicks / 500 sessions)
```

### Merge Algorithm

```
1. Pull page-level traffic from GA API:
   GET sessions per pagePath for date range

2. Pull keyword-level data per page from GSC API:
   GET query + page dimensions for same date range

3. Group GSC data by page URL

4. For each GA page:
   a. Find matching GSC entries by URL
   b. Attach top keywords with clicks, impressions, position
   c. Calculate organic traffic share

5. Sort by sessions descending
```

### API Endpoints

```
GET /api/projects/:id/traffic-insights?dateFrom=2026-03-01&dateTo=2026-03-31
```

### Response

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalSessions": 12500,
      "organicSessions": 8200,
      "organicShare": 0.656,
      "topChannel": "organic"
    },
    "pages": [
      {
        "pagePath": "/blog/running-shoes",
        "sessions": 500,
        "keywords": [
          {
            "keyword": "best running shoes",
            "position": 4.2,
            "clicks": 120,
            "impressions": 3200
          },
          {
            "keyword": "running shoes review",
            "position": 8.1,
            "clicks": 45,
            "impressions": 1800
          }
        ]
      }
    ],
    "channelBreakdown": {
      "organic": 8200,
      "direct": 2100,
      "social": 1200,
      "referral": 700,
      "paid": 300
    }
  }
}
```

### Requirements

- Google Analytics must be connected (GA4 property selected)
- Google Search Console must be connected (GSC site selected)
- If only one is connected, show partial data with a prompt to connect the other

---

## Module 6: Site Audit

### What It Does

Crawls a website like Googlebot and finds technical SEO issues. Returns a health score (0-100) with categorized issues and fix suggestions. Zero external API cost.

### Features

- Start a crawl for any project domain
- Real-time crawl progress via WebSocket (pages crawled, errors found)
- Health score 0-100
- Issues grouped by severity: Errors, Warnings, Notices
- Per-page issue detail with fix suggestion
- Compare with previous crawl (new issues vs fixed issues)
- Scheduled re-crawls (weekly)

### Crawler Architecture

```
                          +------------------+
                          |  User clicks     |
                          |  "Start Crawl"   |
                          +--------+---------+
                                   |
                          +--------v---------+
                          |  API creates     |
                          |  CrawlJob in DB  |
                          |  status: QUEUED  |
                          +--------+---------+
                                   |
                          +--------v---------+
                          |  Add to BullMQ   |
                          |  crawl queue     |
                          +--------+---------+
                                   |
                    +--------------v--------------+
                    |     BullMQ Worker picks up  |
                    +--------------+--------------+
                                   |
                    +--------------v--------------+
                    |  1. Fetch robots.txt        |
                    |  2. Add homepage to queue   |
                    |  3. Start BFS crawl loop    |
                    +--------------+--------------+
                                   |
                    +--------------v--------------+
                    |  FOR EACH URL IN QUEUE:     |
                    |                             |
                    |  a. Fetch page HTML          |
                    |  b. Parse with Cheerio       |
                    |  c. Run all SEO checks       |
                    |  d. Store CrawlPage + Issues |
                    |  e. Extract links            |
                    |  f. Add new links to queue   |
                    |  g. Emit WebSocket progress  |
                    |                             |
                    |  CONCURRENCY: 5-10 workers  |
                    +--------------+--------------+
                                   |
                    +--------------v--------------+
                    |  All URLs processed OR      |
                    |  page limit reached          |
                    |                             |
                    |  Calculate health score      |
                    |  Update CrawlJob: COMPLETED  |
                    |  Emit WebSocket: done        |
                    +-----------------------------+
```

### URL Deduplication (Prevents Infinite Loops)

```
Rules for URL normalization before adding to queue:

1. Lowercase the URL
2. Remove trailing slash
3. Remove fragment (#section)
4. Remove common tracking params (?utm_source, ?ref, ?fbclid)
5. Resolve relative URLs to absolute

Skip URL if:
  - Already visited (in Set)
  - External domain (different from project domain)
  - File extension is media (.jpg, .png, .gif, .pdf, .zip, .mp4, .css, .js)
  - Matches disallowed path in robots.txt
  - URL scheme is not http/https (mailto:, tel:, javascript:)
```

### Robots.txt Respect

```
Before crawling, fetch and parse robots.txt:

GET https://example.com/robots.txt

Parse rules for User-Agent: * (or our bot name)
Respect Disallow directives
Respect Crawl-delay if present

Library: robots-parser npm package
```

### SEO Checks Per Page

| # | Check | What It Looks For | Severity |
|---|-------|------------------|----------|
| 1 | HTTP Status | 404 or 5xx response | ERROR |
| 2 | Title Tag | Missing or empty | ERROR |
| 3 | H1 Tag | Missing or empty | ERROR |
| 4 | Noindex | Page has `<meta name="robots" content="noindex">` | ERROR |
| 5 | Internal Broken Links | Links pointing to 404 pages within the site | ERROR |
| 6 | Redirect Chain | 3+ redirects before final page | ERROR |
| 7 | Meta Description | Missing or empty | WARNING |
| 8 | Duplicate Title | Same title as another page in this crawl | WARNING |
| 9 | Duplicate Meta Desc | Same meta description as another page | WARNING |
| 10 | Image Alt Text | Images without `alt` attribute | WARNING |
| 11 | Slow Page | Load time > 5 seconds | WARNING |
| 12 | Multiple H1 | More than one `<h1>` tag on the page | WARNING |
| 13 | Missing Canonical | No canonical tag present | WARNING |
| 14 | Title Too Long | Over 60 characters | NOTICE |
| 15 | Title Too Short | Under 30 characters | NOTICE |
| 16 | Meta Desc Too Long | Over 160 characters | NOTICE |
| 17 | Meta Desc Too Short | Under 120 characters | NOTICE |
| 18 | Low Word Count | Page body has fewer than 300 words | NOTICE |

### Health Score Calculation

```
Formula:
  totalChecks = totalPages * numberOfChecks (18 checks per page)
  deductions  = (errors * 10) + (warnings * 5) + (notices * 1)
  maxPossible = totalPages * 10 * 5    // normalization factor
  score       = max(0, round(100 - (deductions / maxPossible) * 100))

Score ranges:
  90-100: Excellent (green)
  70-89:  Good (light green)
  50-69:  Needs work (yellow)
  30-49:  Poor (orange)
  0-29:   Critical (red)
```

### WebSocket Events

```
Event: crawl:progress
Emitted: After each page is crawled
Payload:
{
  "crawlJobId": "clxyz123",
  "pagesCrawled": 47,
  "pagesTotal": 312,
  "errorsFound": 3,
  "warningsFound": 12,
  "percentage": 15,
  "lastUrl": "/about-us"
}

Event: crawl:completed
Emitted: When crawl finishes
Payload:
{
  "crawlJobId": "clxyz123",
  "pagesCrawled": 312,
  "score": 78,
  "errorCount": 8,
  "warningCount": 45,
  "noticeCount": 23,
  "duration": 127       // seconds
}

Event: crawl:failed
Emitted: If crawl encounters fatal error
Payload:
{
  "crawlJobId": "clxyz123",
  "error": "Could not connect to target domain"
}
```

### Crawl Comparison (vs Previous Crawl)

```
For each issue in current crawl:
  - Check if same issue existed in previous crawl (match by page URL + issue type)
  - If not in previous: mark as "NEW" (red badge)
  - If in previous: mark as "EXISTING"

For each issue in previous crawl:
  - If not in current: mark as "FIXED" (green badge)

Summary:
  "Since last crawl: 5 new issues, 12 fixed issues"
```

### Plan Limits on Crawling

| Plan | Pages per crawl | Crawls per month |
|------|----------------|-----------------|
| Free | 100 | 2 |
| Pro | 10,000 | 10 |
| Agency | 100,000 | 50 |

### Libraries Used

| Library | Purpose |
|---------|---------|
| `cheerio` | HTML parsing (jQuery-like API for Node.js) |
| `bullmq` | Job queue for crawl processing |
| `robots-parser` | Parse and respect robots.txt |
| `axios` / `node-fetch` | HTTP requests to fetch pages |
| `socket.io` / `@nestjs/websockets` | Real-time progress to frontend |

### API Endpoints

```
GET    /api/projects/:id/crawls                    List all crawl jobs for project
POST   /api/projects/:id/crawls                    Start a new crawl
GET    /api/projects/:id/crawls/:crawlId           Get crawl job details + summary
GET    /api/projects/:id/crawls/:crawlId/issues    List all issues (filterable by severity)
GET    /api/projects/:id/crawls/:crawlId/pages     List all crawled pages
GET    /api/projects/:id/crawls/:crawlId/compare   Compare with previous crawl
DELETE /api/projects/:id/crawls/:crawlId           Cancel a running crawl
```

### Response Examples

**Start crawl:**
```json
POST /api/projects/:id/crawls

Response (202 Accepted):
{
  "success": true,
  "data": {
    "crawlJobId": "clxyz123",
    "status": "QUEUED",
    "pagesLimit": 10000,
    "message": "Crawl queued. Connect to WebSocket for live progress."
  }
}
```

**Get crawl results:**
```json
GET /api/projects/:id/crawls/:crawlId

Response:
{
  "success": true,
  "data": {
    "id": "clxyz123",
    "status": "COMPLETED",
    "score": 78,
    "pagesCrawled": 312,
    "errorCount": 8,
    "warningCount": 45,
    "noticeCount": 23,
    "duration": 127,
    "startedAt": "2026-03-31T02:00:00.000Z",
    "completedAt": "2026-03-31T02:02:07.000Z",
    "issueBreakdown": {
      "MISSING_TITLE": 2,
      "BROKEN_INTERNAL_LINK": 4,
      "PAGE_NOT_FOUND": 2,
      "MISSING_META_DESCRIPTION": 15,
      "IMAGE_MISSING_ALT": 22,
      "SLOW_PAGE": 8,
      "TITLE_TOO_LONG": 12,
      "LOW_WORD_COUNT": 11
    }
  }
}
```

**List issues (paginated, filterable):**
```json
GET /api/projects/:id/crawls/:crawlId/issues?severity=ERROR&page=1&perPage=20

Response:
{
  "success": true,
  "data": [
    {
      "id": "issue123",
      "pageUrl": "/old-page",
      "type": "PAGE_NOT_FOUND",
      "severity": "ERROR",
      "message": "Page returns HTTP 404 status code",
      "suggestion": "Either restore the page content or set up a 301 redirect to a relevant page.",
      "details": { "statusCode": 404 },
      "isNew": true
    }
  ],
  "meta": { "page": 1, "perPage": 20, "total": 8 }
}
```

### What You Do NOT Need for Site Audit

```
Playwright / headless browser  -> NOT needed. Basic HTTP fetch + Cheerio is enough.
                                  Headless browser is only needed for JavaScript-rendered SPAs.
                                  Most websites serve HTML content directly.

Proxies                        -> NOT needed. You're crawling the user's OWN website.
                                  Nobody blocks crawlers on their own site.

External API                   -> NOT needed. 100% self-contained.
                                  Zero running cost per crawl.

Google access                  -> NOT needed. Completely independent from Google.
```
