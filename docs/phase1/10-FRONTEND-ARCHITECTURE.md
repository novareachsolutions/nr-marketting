# Phase 1 - Frontend Architecture

> **Framework:** Next.js 14 (Pages Router)
> **UI:** Tailwind CSS + shadcn/ui
> **State:** TanStack Query v5 (server state) + React Context (client state)
> **3 Apps:** Tenant Dashboard, Super Admin, Customer Website

---

## Table of Contents

- [App Roles](#app-roles)
- [Tenant Dashboard Routes](#tenant-dashboard-routes)
- [Super Admin Routes](#super-admin-routes)
- [Customer Website Routes](#customer-website-routes)
- [Layout System](#layout-system)
- [Authentication Flow (Frontend)](#authentication-flow-frontend)
- [Data Fetching Pattern](#data-fetching-pattern)
- [Key Page Specifications](#key-page-specifications)
- [Component Library](#component-library)
- [Charts & Data Visualization](#charts--data-visualization)

---

## App Roles

| App | Port | Purpose | Users |
|-----|------|---------|-------|
| **Tenant Dashboard** | 3000 | Main product — all SEO tools | Paying customers |
| **Super Admin** | 3001 | Platform management panel | Internal team only |
| **Customer Website** | 3002 | Marketing site, pricing, signup | Public visitors |

---

## Tenant Dashboard Routes

```
/                                    -> Redirect to /dashboard
/login                               -> Login form
/register                            -> Registration form
/verify-email                        -> Email verification handler
/forgot-password                     -> Forgot password form
/reset-password                      -> Reset password form

/dashboard                           -> Project list + quick stats
/projects/new                        -> Create project wizard (domain + source type selection)

/projects/:id                        -> Project dashboard (summary cards)
/projects/:id/settings               -> Project settings (domain, timezone, competitors)
/projects/:id/settings/wordpress     -> WordPress connection setup/manage
/projects/:id/settings/github        -> GitHub connection setup/manage

/projects/:id/keywords               -> Keyword research + saved keywords
/projects/:id/keywords/suggestions   -> Keyword magic tool (suggestions)

/projects/:id/rankings               -> Rank tracking table + charts
/projects/:id/rankings/:keywordId    -> Single keyword position history

/projects/:id/domain-overview        -> Domain overview (any domain lookup)

/projects/:id/traffic                -> Organic traffic insights (GA + GSC merged)

/projects/:id/audit                  -> Site audit list (past crawls)
/projects/:id/audit/:crawlId         -> Crawl results (score, issues, pages)
/projects/:id/audit/:crawlId/issues  -> Full issue list with filters
/projects/:id/audit/:crawlId/pages   -> Full page list with filters

/projects/:id/ai                     -> AI assistant chat
/projects/:id/ai/topics              -> Topic research tool

/projects/:id/reports                -> Report list + generate
/projects/:id/alerts                 -> Alert configuration + history

/settings                            -> Redirect to /settings/profile
/settings/profile                    -> Name, email, timezone, avatar
/settings/billing                    -> Plan, subscription, usage
/settings/integrations               -> Google OAuth + WordPress + GitHub connection manager
/settings/team                       -> Team members (Phase 2+)
```

---

## Super Admin Routes

```
/                                    -> Redirect to /dashboard
/login                               -> Admin login

/dashboard                           -> Platform stats overview
/users                               -> User list (search, filter, paginate)
/users/:id                           -> User detail (profile, subscription, projects)
/users/:id/impersonate               -> Login as this user (for support)

/subscriptions                       -> All subscriptions (plan breakdown, MRR)
/projects                            -> All projects across all users

/jobs                                -> Background job dashboard (queue depths, failures)
/logs                                -> Application log viewer

/settings                            -> Platform settings
```

---

## Customer Website Routes

```
/                                    -> Landing page (hero, features, testimonials)
/pricing                             -> Pricing table (Free / Pro / Agency)
/features                            -> Feature list with screenshots
/about                               -> About the company
/blog                                -> Blog listing (SEO content marketing)
/blog/:slug                          -> Blog post page
/contact                             -> Contact form
/login                               -> Redirect to tenant dashboard /login
/register                            -> Redirect to tenant dashboard /register

/tools/seo-checker                   -> Free tool: lite site audit (100 pages)
/tools/keyword-tool                  -> Free tool: keyword lookup (limited)
```

---

## Layout System

### Tenant Dashboard Layout

```
+--------------------------------------------------+
| Topbar: Logo | Search | Notifications | Avatar   |
+------+-------------------------------------------+
|      |                                           |
| Side |          Main Content Area                |
| bar  |                                           |
|      |                                           |
| Nav: |                                           |
| Home |                                           |
| KW   |                                           |
| Rank |                                           |
| Audit|                                           |
| AI   |                                           |
| Rpt  |                                           |
| ...  |                                           |
|      |                                           |
+------+-------------------------------------------+
```

### Sidebar Navigation Items

```
Dashboard           /projects/:id
---
Keyword Research    /projects/:id/keywords
Domain Overview     /projects/:id/domain-overview
Rank Tracking       /projects/:id/rankings
Traffic Insights    /projects/:id/traffic
---
Site Audit          /projects/:id/audit
---
AI Assistant        /projects/:id/ai
Topic Research      /projects/:id/ai/topics
---
Reports             /projects/:id/reports
Alerts              /projects/:id/alerts
---
Settings            /projects/:id/settings
```

### Topbar Components

- **Logo** — Click to go to project list
- **Project Switcher** — Dropdown to switch between projects
- **Global Search** — Search keywords, pages, issues across project
- **Notifications Bell** — Recent alerts count badge
- **User Avatar** — Dropdown: Profile, Billing, Integrations, Logout

---

## Authentication Flow (Frontend)

### Token Storage

```
Access Token:   Stored in memory (React state / context)
                - Lost on page refresh (intentional)
                - Re-obtained via refresh token on app load

Refresh Token:  HttpOnly cookie (set by backend)
                - Sent automatically with /api/auth/refresh requests
                - Cannot be read by JavaScript (XSS safe)
```

### App Load Flow

```
1. App loads (_app.tsx)
2. Check if we have accessToken in memory
3. If no: call POST /api/auth/refresh (cookie sent automatically)
4. If refresh succeeds:
   - Store new accessToken in memory
   - Load user profile
   - Redirect to dashboard
5. If refresh fails (no cookie or expired):
   - Redirect to /login
   - Clear any stale state
```

### Axios Interceptor (Auto-Refresh)

```
Every API request:
  1. Attach Authorization: Bearer {accessToken} header
  2. If response is 401:
     a. Call /api/auth/refresh to get new accessToken
     b. Retry the original request with new token
     c. If refresh also fails: redirect to /login
  3. Queue concurrent requests while refreshing (don't make multiple refresh calls)
```

### Auth Context

```typescript
interface AuthContext {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}
```

---

## Data Fetching Pattern

### TanStack Query (React Query) for Server State

```
All API data fetched via React Query hooks:
  - Automatic caching
  - Background refetching on window focus
  - Loading/error/success states
  - Optimistic updates where appropriate
```

### Hook Naming Convention

```
useProjects()                    -> GET /api/projects
useProject(id)                   -> GET /api/projects/:id
useKeywordSearch(query)          -> GET /api/keywords/search?q=...
useKeywordSuggestions(query)     -> GET /api/keywords/suggestions?q=...
useProjectKeywords(projectId)    -> GET /api/projects/:id/keywords
useRankings(projectId)           -> GET /api/projects/:id/rankings
useRankingHistory(keywordId)     -> GET /api/projects/:id/rankings/history
useCrawls(projectId)             -> GET /api/projects/:id/crawls
useCrawlResult(crawlId)          -> GET /api/projects/:id/crawls/:crawlId
useCrawlIssues(crawlId, filters) -> GET /api/projects/:id/crawls/:crawlId/issues
useTrafficInsights(projectId)    -> GET /api/projects/:id/traffic-insights
useAiConversations(projectId)    -> GET /api/projects/:id/ai/conversations
useAiInsights(projectId)         -> GET /api/projects/:id/ai/insights
useReports(projectId)            -> GET /api/projects/:id/reports
useAlerts(projectId)             -> GET /api/projects/:id/alerts
useSubscription()                -> GET /api/billing/subscription
useUsage()                       -> GET /api/billing/usage
useGoogleStatus()                -> GET /api/google-oauth/status
useWordPressStatus(projectId)    -> GET /api/projects/:id/wordpress/status
useGitHubStatus(projectId)       -> GET /api/projects/:id/github/status
useGitHubRepos()                 -> GET /api/projects/:id/github/repos
```

### Mutation Hooks

```
useCreateProject()
useSaveKeyword()
useTrackKeyword()
useStartCrawl()
useGenerateReport()
useSendAiMessage()
useCreateAlert()
useConnectGoogle()
useCreateCheckout()
useConnectWordPress()
useConnectGitHub()
useDisconnectWordPress()
useDisconnectGitHub()
useAutoFixIssueWP()              // Fix via WordPress API
useAutoFixIssueGH()              // Fix via GitHub PR
```

### Cache Invalidation

```
After creating a project     -> invalidate useProjects
After saving a keyword       -> invalidate useProjectKeywords
After starting a crawl       -> invalidate useCrawls
After generating a report    -> invalidate useReports
After changing subscription  -> invalidate useSubscription + useUsage
```

---

## Key Page Specifications

### Project Dashboard (`/projects/:id`)

**Layout:** 2x3 grid of summary cards + AI insights below

**Cards:**
1. **Keywords Tracked** — Count + change vs last week
2. **Average Position** — Avg across all tracked keywords + change
3. **Organic Traffic** — Sessions this month + % change (requires GA)
4. **Site Health** — Latest audit score + change vs previous crawl
5. **Top Keyword** — Best ranking keyword + position
6. **Crawl Status** — Last crawl date + next scheduled

**AI Insights Section:** 1-3 cards with icon, title, message, action button

---

### Keyword Research (`/projects/:id/keywords`)

**Layout:** Search bar at top + results table below + saved keywords tab

**Search bar:** Input + country dropdown + "Search" button

**Results table columns:**
| Keyword | Volume | Difficulty | CPC | Trend | Actions |
|---------|--------|-----------|-----|-------|---------|
| Text | Number | Progress bar (0-100, color-coded) | $X.XX | Sparkline (12 months) | Save / Track |

**Difficulty color scale:**
- 0-29: Green
- 30-49: Yellow
- 50-69: Orange
- 70-100: Red

---

### Rank Tracking (`/projects/:id/rankings`)

**Layout:** Summary bar + chart + table

**Summary bar:** Keywords tracked | In top 10 | In top 20 | Improved | Declined

**Chart:** Line chart showing position over time for top 5 keywords
- Y-axis INVERTED (1 at top, 100 at bottom)
- Each keyword = different color line
- Hover shows exact position + date

**Table columns:**
| Keyword | Position | Change | Clicks | Impressions | CTR | URL |
|---------|---------|--------|--------|-------------|-----|-----|
| Text | #N | Arrow + delta | Number | Number | Percent | Truncated URL |

**Change column:** Green up arrow if improved, red down arrow if dropped, gray dash if unchanged.

---

### Site Audit (`/projects/:id/audit/:crawlId`)

**Layout:** Score ring + issue summary + tabbed issue list

**Score ring:** Large circular gauge, color-coded by score range

**Issue summary bar:** `8 Errors | 45 Warnings | 23 Notices`

**Issue tabs:** [All] [Errors] [Warnings] [Notices]

**Issue list item:**
```
[ERROR icon] Missing title tag                              2 pages affected
  /about-us — Page is missing a <title> tag.
  /contact — Page is missing a <title> tag.
  Suggestion: Add a unique, descriptive title tag (30-60 chars) to each page.
```

**New/Fixed badges:** Issues from previous crawl comparison marked with colored badges.

---

### AI Assistant (`/projects/:id/ai`)

**Layout:** Chat interface (like ChatGPT)

**Left sidebar:** Conversation list (title + last message preview)
**Main area:** Message thread with streaming response
**Bottom:** Input box + send button

**Message bubbles:**
- User: Right-aligned, blue background
- Assistant: Left-aligned, gray background, supports markdown rendering

---

## Component Library

### Using shadcn/ui Components

```
Button          — Primary, secondary, outline, ghost, destructive variants
Input           — Text, email, password, search
Select          — Country picker, device filter, plan selector
Table           — Sortable, paginated data tables
Card            — Dashboard summary cards, insight cards
Dialog/Modal    — Confirmations, forms
Dropdown        — User menu, project switcher
Tabs            — Issue severity tabs, keyword tabs
Badge           — Plan labels, status labels, new/fixed markers
Toast           — Success/error notifications (Sonner)
Progress        — Crawl progress bar, keyword difficulty bar
Tooltip         — Hover info on metrics
Sheet           — Mobile sidebar
Skeleton        — Loading states for all data components
```

### Custom Components to Build

```
RankingChart       — Recharts line chart with inverted Y-axis
ScoreRing          — Circular SVG gauge for health score
SparkLine          — Mini trend chart for keyword volume
PositionChange     — Arrow + delta display (green/red/gray)
IssueCard          — Expandable issue with affected pages
CrawlProgressBar   — Real-time WebSocket-driven progress
KeywordDifficulty  — Color-coded progress bar (0-100)
PlanBadge          — FREE / PRO / AGENCY colored badge
UsageBar           — Progress bar showing usage vs limit
ProjectSwitcher    — Dropdown with project list + "New Project"
GoogleConnectButton — OAuth connect/disconnect with status indicator
WordPressConnectForm — WP URL + username + app password form
GitHubConnectButton  — GitHub OAuth + repo selector dropdown
SourceTypePicker     — MANUAL / WordPress / GitHub selector in project wizard
AutoFixButton        — "Fix via WordPress" or "Fix via PR" on crawl issues
```

---

## Charts & Data Visualization

### Library: Recharts

Used for all charts in the dashboard.

### Chart Types Needed

| Chart | Used In | Data |
|-------|---------|------|
| **Line Chart** | Rank tracking | Position over time (inverted Y) |
| **Area Chart** | Traffic overview | Sessions over time |
| **Bar Chart** | Traffic by channel | Organic, direct, social, paid, referral |
| **Pie/Donut Chart** | Issue breakdown | Errors, warnings, notices proportions |
| **Sparkline** | Keyword table | 12-month volume trend per keyword |

### Chart Styling

```
Colors (consistent across app):
  Primary:    #2563EB (blue-600)
  Success:    #16A34A (green-600)
  Warning:    #CA8A04 (yellow-600)
  Error:      #DC2626 (red-600)
  Neutral:    #6B7280 (gray-500)

  Keyword lines (up to 5):
    #2563EB, #7C3AED, #DB2777, #EA580C, #059669

Font: System font stack (same as Tailwind default)
Grid: Light gray (#F3F4F6) background grid lines
Tooltip: White card with shadow, show exact values
Responsive: Charts resize with container
```

---

## Responsive Design

### Breakpoints (Tailwind defaults)

```
sm:  640px   (mobile landscape)
md:  768px   (tablet)
lg:  1024px  (desktop)
xl:  1280px  (large desktop)
2xl: 1536px  (ultra-wide)
```

### Mobile Adaptations

- Sidebar collapses to hamburger menu (Sheet component)
- Dashboard grid: 2 columns on desktop -> 1 column on mobile
- Tables: horizontal scroll on mobile
- Charts: full width, reduced labels
- AI chat: full screen on mobile

---

## Loading & Error States

### Loading States

Every data component shows a Skeleton loader while fetching:
- Tables: skeleton rows
- Cards: skeleton blocks
- Charts: skeleton placeholder with pulse animation

### Error States

```
API error -> Show error card with message + "Retry" button
No data   -> Show empty state illustration + helpful message
Network   -> Show "Unable to connect" banner at top of page
```

### Empty States

Each page has a tailored empty state:
- No projects: "Create your first project to get started" + CTA button
- No keywords: "Search for keywords to start tracking" + search bar
- No crawls: "Run your first site audit" + CTA button
- No rankings: "Add keywords to track" + link to keyword page
