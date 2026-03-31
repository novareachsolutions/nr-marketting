# Phase 1 - Database Schema

> **ORM:** Prisma 5
> **Database:** PostgreSQL 15
> **Pattern:** Shared database, row-level tenant isolation via `userId` / `projectId`

---

## Table of Contents

- [Schema Overview](#schema-overview)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [All Models (Detailed)](#all-models-detailed)
- [Enums](#enums)
- [Indexes](#indexes)
- [Caching Strategy](#caching-strategy)
- [Migration Strategy](#migration-strategy)
- [Seed Data](#seed-data)
- [Full Prisma Schema](#full-prisma-schema)

---

## Schema Overview

### Model Count: 20 tables

| Category | Models |
|----------|--------|
| **Auth & Users** | `User`, `RefreshToken` |
| **Billing** | `Subscription`, `UsageRecord` |
| **Projects** | `Project`, `Competitor` |
| **Google Integrations** | `GoogleConnection` |
| **Source Integrations** | `WordPressConnection`, `GitHubConnection` |
| **Keywords** | `KeywordCache`, `ProjectKeyword` |
| **Rank Tracking** | `TrackedKeyword`, `RankingHistory` |
| **Site Audit** | `CrawlJob`, `CrawlPage`, `CrawlIssue` |
| **AI Assistant** | `AiConversation`, `AiMessage` |
| **Reports** | `Report` |

### Naming Conventions

- **Table names:** snake_case plural (via `@@map`)
- **Column names:** camelCase in Prisma, snake_case in DB (via `@map`)
- **Primary keys:** `id` as `String @id @default(cuid())`
- **Timestamps:** `createdAt` + `updatedAt` on every table
- **Foreign keys:** `<entity>Id` (e.g., `userId`, `projectId`)
- **Soft deletes:** NOT used in Phase 1 (hard delete, keep it simple)
- **Booleans:** prefixed with `is` (e.g., `isActive`, `isDofollow`)

---

## Entity Relationship Diagram

```
User (1)
  |
  |---(1:many)--- Project
  |                 |
  |                 |---(1:many)--- Competitor
  |                 |---(1:many)--- ProjectKeyword
  |                 |---(1:many)--- TrackedKeyword ---(1:many)--- RankingHistory
  |                 |---(1:many)--- CrawlJob ---(1:many)--- CrawlPage ---(1:many)--- CrawlIssue
  |                 |---(1:many)--- Report
  |                 |---(1:many)--- AiConversation ---(1:many)--- AiMessage
  |
  |---(1:one)---- GoogleConnection
  |---(1:one)---- Subscription
  |---(1:many)--- RefreshToken
  |---(1:many)--- UsageRecord

KeywordCache (global, shared across all users)
```

---

## All Models (Detailed)

---

### 1. User

Stores registered user accounts.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Unique user ID |
| `email` | String | Unique, indexed | Login email |
| `passwordHash` | String | Not null | bcrypt hash (12 rounds) |
| `name` | String | Nullable | Display name |
| `role` | Enum `Role` | Default: `USER` | USER, ADMIN, SUPER_ADMIN |
| `isEmailVerified` | Boolean | Default: false | Email verification status |
| `emailVerifyToken` | String | Nullable | Token sent in verify email |
| `passwordResetToken` | String | Nullable | Token sent in reset email |
| `passwordResetExpiry` | DateTime | Nullable | Reset token expiry |
| `avatarUrl` | String | Nullable | Profile picture URL |
| `timezone` | String | Default: "UTC" | User's preferred timezone |
| `createdAt` | DateTime | Auto | Account created |
| `updatedAt` | DateTime | Auto | Last modified |

**Relations:**
- Has one `Subscription`
- Has many `Project`
- Has many `RefreshToken`
- Has one `GoogleConnection`
- Has many `UsageRecord`

---

### 2. RefreshToken

Stores active refresh tokens for JWT rotation.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Token record ID |
| `userId` | String | FK -> User | Owner |
| `tokenHash` | String | Indexed | SHA-256 hash of the refresh token |
| `userAgent` | String | Nullable | Browser/device info |
| `ipAddress` | String | Nullable | IP at time of login |
| `expiresAt` | DateTime | Not null | When this token expires |
| `createdAt` | DateTime | Auto | When issued |

**Why hash tokens:** If DB is compromised, attacker can't use raw tokens.

**Cleanup:** Cron job deletes expired tokens weekly.

---

### 3. Subscription

One subscription per user. Maps to Stripe subscription.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Subscription record ID |
| `userId` | String | FK -> User, Unique | One sub per user |
| `stripeCustomerId` | String | Unique | Stripe customer ID |
| `stripeSubscriptionId` | String | Nullable, Unique | Stripe subscription ID |
| `plan` | Enum `Plan` | Default: `FREE` | FREE, PRO, AGENCY |
| `billingCycle` | Enum `BillingCycle` | Default: `MONTHLY` | MONTHLY, YEARLY |
| `status` | Enum `SubStatus` | Default: `ACTIVE` | ACTIVE, PAST_DUE, CANCELLED, TRIALING |
| `currentPeriodStart` | DateTime | Nullable | Billing period start |
| `currentPeriodEnd` | DateTime | Nullable | Billing period end |
| `cancelAtPeriodEnd` | Boolean | Default: false | Will cancel at end of period |
| `createdAt` | DateTime | Auto | Created |
| `updatedAt` | DateTime | Auto | Updated |

---

### 4. UsageRecord

Tracks per-user usage against plan limits. One record per user per month per metric.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Record ID |
| `userId` | String | FK -> User | Owner |
| `metric` | Enum `UsageMetric` | Not null | KEYWORDS_TRACKED, PAGES_CRAWLED, AI_CREDITS, REPORTS_GENERATED |
| `count` | Int | Default: 0 | Current usage count |
| `limit` | Int | Not null | Max allowed by plan |
| `period` | String | Not null | "2026-03" (year-month) |
| `createdAt` | DateTime | Auto | Created |
| `updatedAt` | DateTime | Auto | Updated |

**Unique constraint:** `(userId, metric, period)` — one row per user per metric per month.

---

### 5. Project

A website the user wants to track. Core entity everything else hangs off.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Project ID |
| `userId` | String | FK -> User, indexed | Owner |
| `domain` | String | Not null | Normalized: no www, lowercase, no trailing slash |
| `name` | String | Not null | Display name (e.g., "My Blog") |
| `timezone` | String | Default: "UTC" | Timezone for reports/scheduling |
| `sourceType` | Enum `SourceType` | Default: `MANUAL` | How the project source is connected |
| `isActive` | Boolean | Default: true | Soft-disable without deleting |
| `createdAt` | DateTime | Auto | Created |
| `updatedAt` | DateTime | Auto | Updated |

**Unique constraint:** `(userId, domain)` — one user can't add the same domain twice.

**Domain normalization rules (applied on save):**
1. Lowercase everything
2. Remove `http://`, `https://`, `www.`
3. Remove trailing `/`
4. Example: `https://WWW.MyWebsite.com/` -> `mywebsite.com`

**Source types:**
- `MANUAL` — Just a domain, no code access (works for any website)
- `WORDPRESS` — Connected via WP REST API or custom plugin
- `GITHUB` — Connected via GitHub OAuth (GitHub Pages, Vercel, Netlify, static sites)

---

### 5a. WordPressConnection

Stores credentials for WordPress REST API access. One per project (only for WordPress sites).

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Connection ID |
| `projectId` | String | FK -> Project, Unique | One WP connection per project |
| `siteUrl` | String | Not null | WordPress site URL (e.g., `https://mysite.com`) |
| `username` | String | Not null | **Encrypted.** WordPress username |
| `appPassword` | String | Nullable | **Encrypted.** WordPress Application Password |
| `pluginApiKey` | String | Nullable | **Encrypted.** API key from our custom WP plugin |
| `authMethod` | Enum `WpAuthMethod` | Not null | APP_PASSWORD or PLUGIN |
| `isValid` | Boolean | Default: true | Whether credentials are still working |
| `wpVersion` | String | Nullable | Detected WordPress version |
| `seoPlugin` | Enum `WpSeoPlugin` | Nullable | Detected SEO plugin (YOAST, RANKMATH, NONE) |
| `capabilities` | Json | Nullable | What actions are available (read posts, write meta, etc.) |
| `lastVerifiedAt` | DateTime | Nullable | Last successful API call |
| `connectedAt` | DateTime | Auto | When connection was established |
| `updatedAt` | DateTime | Auto | Last updated |

**Security:** `username`, `appPassword`, and `pluginApiKey` are all **encrypted with AES-256-GCM** before storage (same as Google refresh tokens).

**Capabilities JSON example:**
```json
{
  "canReadPosts": true,
  "canWritePosts": true,
  "canReadMeta": true,
  "canWriteMeta": true,
  "canReadMedia": true,
  "canUploadMedia": true,
  "canReadPlugins": true,
  "seoPluginAccess": true
}
```

---

### 5b. GitHubConnection

Stores OAuth tokens for GitHub repository access. One per project.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Connection ID |
| `projectId` | String | FK -> Project, Unique | One GitHub connection per project |
| `accessToken` | String | Not null | **Encrypted.** GitHub OAuth token |
| `repoOwner` | String | Not null | Repository owner (user or org) |
| `repoName` | String | Not null | Repository name |
| `repoFullName` | String | Not null | `owner/repo` format |
| `defaultBranch` | String | Default: "main" | Main branch name |
| `repoUrl` | String | Not null | Full repo URL |
| `deployUrl` | String | Nullable | Auto-detected deploy URL (Vercel, Netlify, GitHub Pages) |
| `deployPlatform` | Enum `DeployPlatform` | Nullable | GITHUB_PAGES, VERCEL, NETLIFY, OTHER |
| `webhookId` | String | Nullable | GitHub webhook ID (for deploy detection) |
| `webhookSecret` | String | Nullable | **Encrypted.** Webhook signature secret |
| `isValid` | Boolean | Default: true | Whether token still works |
| `lastVerifiedAt` | DateTime | Nullable | Last successful API call |
| `connectedAt` | DateTime | Auto | When OAuth was completed |
| `updatedAt` | DateTime | Auto | Last updated |

**Security:** `accessToken` and `webhookSecret` are **encrypted with AES-256-GCM** before storage.

---

### 6. Competitor

Competitor domains added to a project. Max 5 per project.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Competitor ID |
| `projectId` | String | FK -> Project, indexed | Parent project |
| `domain` | String | Not null | Normalized domain |
| `name` | String | Nullable | Display label |
| `createdAt` | DateTime | Auto | Created |

**Unique constraint:** `(projectId, domain)` — no duplicate competitor domains per project.

---

### 7. GoogleConnection

Stores OAuth tokens for Google Analytics and Search Console.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Connection ID |
| `userId` | String | FK -> User, Unique | One connection per user |
| `accessToken` | String | Not null | Short-lived (1 hour), refreshed automatically |
| `refreshToken` | String | Not null | **Encrypted with AES-256-GCM before storage** |
| `tokenExpiry` | DateTime | Not null | When access token expires |
| `scope` | String | Not null | OAuth scopes granted |
| `gaPropertyId` | String | Nullable | Google Analytics property ID (e.g., "G-XXXXXXX") |
| `gscSiteUrl` | String | Nullable | Search Console site URL (e.g., "https://mywebsite.com") |
| `connectedAt` | DateTime | Auto | When OAuth was completed |
| `updatedAt` | DateTime | Auto | Last token refresh |

**Critical security note:** `refreshToken` must be encrypted at rest. If DB is compromised, raw
refresh tokens would give attackers read access to users' Google Analytics data.

**Encryption implementation:**
```
Store:   AES-256-GCM encrypt(refreshToken, ENCRYPTION_KEY) -> encrypted blob + IV + auth tag
Read:    AES-256-GCM decrypt(encrypted blob, ENCRYPTION_KEY, IV, auth tag) -> refreshToken
```

---

### 8. KeywordCache

Global shared cache of keyword metrics. Not user-specific — saves API costs.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Cache entry ID |
| `keyword` | String | Not null | The keyword text |
| `country` | String | Default: "US" | Country code (ISO 3166-1 alpha-2) |
| `searchVolume` | Int | Nullable | Monthly search volume |
| `difficulty` | Int | Nullable | Keyword difficulty 0-100 |
| `cpc` | Float | Nullable | Cost per click in USD |
| `trend` | Json | Nullable | 12-month volume trend as array |
| `updatedAt` | DateTime | Auto | Last refreshed from API |

**Unique constraint:** `(keyword, country)` — one cache entry per keyword per country.

**Cache TTL:** 30 days. Background job refreshes stale entries.

**Why global:** If User A searches "best shoes" and User B searches the same keyword,
the second query hits the cache instead of calling DataForSEO again. Saves money.

---

### 9. ProjectKeyword

Keywords saved to a specific project by the user.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Record ID |
| `projectId` | String | FK -> Project, indexed | Parent project |
| `keyword` | String | Not null | The keyword text |
| `targetUrl` | String | Nullable | Which page should rank for this keyword |
| `notes` | String | Nullable | User notes |
| `createdAt` | DateTime | Auto | Created |

**Unique constraint:** `(projectId, keyword)` — no duplicate keywords per project.

---

### 10. TrackedKeyword

Keywords actively being tracked for rank position changes.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Tracked keyword ID |
| `projectId` | String | FK -> Project, indexed | Parent project |
| `keyword` | String | Not null | The keyword to track |
| `targetUrl` | String | Nullable | Expected ranking page |
| `device` | Enum `Device` | Default: `DESKTOP` | DESKTOP, MOBILE |
| `country` | String | Default: "US" | Country to track in |
| `isActive` | Boolean | Default: true | Whether to include in daily sync |
| `createdAt` | DateTime | Auto | Created |

**Unique constraint:** `(projectId, keyword, device, country)` — one tracking per keyword+device+country combo.

**Plan limits enforcement:**
- Free: 10 tracked keywords max
- Pro: 500 tracked keywords max
- Agency: 5,000 tracked keywords max

---

### 11. RankingHistory

Daily ranking snapshots. One row per tracked keyword per day.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Record ID |
| `trackedKeywordId` | String | FK -> TrackedKeyword, indexed | Parent keyword |
| `position` | Float | Nullable | Average position (e.g., 7.3). Null = not ranking |
| `clicks` | Int | Default: 0 | Clicks from GSC |
| `impressions` | Int | Default: 0 | Impressions from GSC |
| `ctr` | Float | Default: 0 | Click-through rate (0.0 - 1.0) |
| `date` | DateTime | Not null | The date this data is for |
| `source` | Enum `DataSource` | Default: `GSC` | GSC or DATAFORSEO |

**Unique constraint:** `(trackedKeywordId, date, source)` — one snapshot per keyword per day per source.

**Index:** `(trackedKeywordId, date DESC)` — fast time-series queries.

**Data volume estimate:**
- 500 keywords x 365 days = 182,500 rows per project per year
- 1,000 projects = 182M rows per year
- Partitioning by date recommended at scale (not Phase 1)

---

### 12. CrawlJob

A site audit crawl session.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Crawl job ID |
| `projectId` | String | FK -> Project, indexed | Parent project |
| `status` | Enum `CrawlStatus` | Default: `QUEUED` | QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED |
| `pagesCrawled` | Int | Default: 0 | Pages processed so far |
| `pagesTotal` | Int | Default: 0 | Total pages discovered |
| `pagesLimit` | Int | Not null | Max pages allowed (from plan) |
| `errorCount` | Int | Default: 0 | Issues with severity ERROR |
| `warningCount` | Int | Default: 0 | Issues with severity WARNING |
| `noticeCount` | Int | Default: 0 | Issues with severity NOTICE |
| `score` | Int | Nullable | Health score 0-100 (calculated after completion) |
| `startedAt` | DateTime | Nullable | When crawl began |
| `completedAt` | DateTime | Nullable | When crawl finished |
| `createdAt` | DateTime | Auto | When job was queued |

---

### 13. CrawlPage

Each page discovered and analyzed during a crawl.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Page record ID |
| `crawlJobId` | String | FK -> CrawlJob, indexed | Parent crawl |
| `url` | String | Not null | Full URL of the page |
| `statusCode` | Int | Nullable | HTTP status (200, 301, 404, 500) |
| `title` | String | Nullable | Page title tag content |
| `metaDescription` | String | Nullable | Meta description content |
| `h1` | String | Nullable | First H1 tag content |
| `h1Count` | Int | Default: 0 | Number of H1 tags on page |
| `wordCount` | Int | Default: 0 | Word count of visible text |
| `loadTimeMs` | Int | Nullable | Page load time in milliseconds |
| `contentType` | String | Nullable | Response content-type header |
| `canonicalUrl` | String | Nullable | Canonical URL if present |
| `hasRobotsNoindex` | Boolean | Default: false | Whether noindex is set |
| `hasRobotsNofollow` | Boolean | Default: false | Whether nofollow is set |
| `internalLinksCount` | Int | Default: 0 | Number of internal links on page |
| `externalLinksCount` | Int | Default: 0 | Number of external links on page |
| `imagesCount` | Int | Default: 0 | Total images |
| `imagesWithoutAlt` | Int | Default: 0 | Images missing alt attribute |
| `crawledAt` | DateTime | Auto | When this page was crawled |

**Index:** `(crawlJobId, statusCode)` — filter pages by status quickly.

---

### 14. CrawlIssue

Specific SEO issues found on a crawled page.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Issue ID |
| `crawlPageId` | String | FK -> CrawlPage, indexed | Parent page |
| `type` | Enum `IssueType` | Not null | MISSING_TITLE, BROKEN_LINK, SLOW_PAGE, etc. |
| `severity` | Enum `IssueSeverity` | Not null | ERROR, WARNING, NOTICE |
| `message` | String | Not null | Human-readable issue description |
| `details` | Json | Nullable | Extra data (e.g., broken link URL, actual load time) |
| `suggestion` | String | Nullable | How to fix this issue |

**No timestamps needed** — lifecycle is tied to the parent CrawlJob.

---

### 15. AiConversation

A conversation thread between the user and the AI assistant.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Conversation ID |
| `projectId` | String | FK -> Project, indexed | Context project |
| `title` | String | Nullable | Auto-generated or user-set title |
| `createdAt` | DateTime | Auto | Created |
| `updatedAt` | DateTime | Auto | Last message time |

---

### 16. AiMessage

Individual messages in an AI conversation.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Message ID |
| `conversationId` | String | FK -> AiConversation, indexed | Parent conversation |
| `role` | Enum `MessageRole` | Not null | USER, ASSISTANT |
| `content` | String | Not null | Message text (supports markdown) |
| `tokensUsed` | Int | Default: 0 | Token count for billing/tracking |
| `createdAt` | DateTime | Auto | Sent at |

---

### 17. Report

Generated PDF reports.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | String (cuid) | PK | Report ID |
| `projectId` | String | FK -> Project, indexed | Parent project |
| `title` | String | Not null | Report title |
| `type` | Enum `ReportType` | Default: `WEEKLY` | WEEKLY, MONTHLY, CUSTOM |
| `dateFrom` | DateTime | Not null | Report period start |
| `dateTo` | DateTime | Not null | Report period end |
| `filePath` | String | Nullable | Path to generated PDF file |
| `fileSize` | Int | Nullable | File size in bytes |
| `status` | Enum `ReportStatus` | Default: `PENDING` | PENDING, GENERATING, COMPLETED, FAILED |
| `createdAt` | DateTime | Auto | Created |

---

## Enums

```prisma
enum Role {
  USER
  ADMIN
  SUPER_ADMIN
}

enum Plan {
  FREE
  PRO
  AGENCY
}

enum BillingCycle {
  MONTHLY
  YEARLY
}

enum SubStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  TRIALING
}

enum UsageMetric {
  KEYWORDS_TRACKED
  PAGES_CRAWLED
  AI_CREDITS
  REPORTS_GENERATED
}

enum Device {
  DESKTOP
  MOBILE
}

enum DataSource {
  GSC
  DATAFORSEO
}

enum CrawlStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum IssueType {
  // Errors
  MISSING_TITLE
  MISSING_H1
  BROKEN_INTERNAL_LINK
  PAGE_NOT_FOUND
  SERVER_ERROR
  HAS_NOINDEX
  REDIRECT_CHAIN

  // Warnings
  MISSING_META_DESCRIPTION
  DUPLICATE_TITLE
  DUPLICATE_META_DESCRIPTION
  IMAGE_MISSING_ALT
  SLOW_PAGE
  MULTIPLE_H1
  MISSING_CANONICAL

  // Notices
  TITLE_TOO_LONG
  TITLE_TOO_SHORT
  META_DESCRIPTION_TOO_LONG
  META_DESCRIPTION_TOO_SHORT
  LOW_WORD_COUNT
}

enum IssueSeverity {
  ERROR
  WARNING
  NOTICE
}

enum MessageRole {
  USER
  ASSISTANT
}

enum ReportType {
  WEEKLY
  MONTHLY
  CUSTOM
}

enum ReportStatus {
  PENDING
  GENERATING
  COMPLETED
  FAILED
}

enum SourceType {
  MANUAL            // Just domain, no code access
  WORDPRESS         // Connected via WP REST API or plugin
  GITHUB            // Connected via GitHub OAuth
}

enum WpAuthMethod {
  APP_PASSWORD      // WordPress Application Password
  PLUGIN            // Our custom WordPress plugin API key
}

enum WpSeoPlugin {
  YOAST
  RANKMATH
  AIOSEO
  NONE
}

enum DeployPlatform {
  GITHUB_PAGES
  VERCEL
  NETLIFY
  OTHER
}
```

---

## Indexes

### Primary Indexes (Auto-created by Prisma on PK and Unique)

- `User.email` (unique)
- `Subscription.userId` (unique)
- `Subscription.stripeCustomerId` (unique)
- `Subscription.stripeSubscriptionId` (unique)
- `GoogleConnection.userId` (unique)
- `KeywordCache.(keyword, country)` (unique composite)
- `ProjectKeyword.(projectId, keyword)` (unique composite)
- `TrackedKeyword.(projectId, keyword, device, country)` (unique composite)
- `RankingHistory.(trackedKeywordId, date, source)` (unique composite)
- `Project.(userId, domain)` (unique composite)
- `Competitor.(projectId, domain)` (unique composite)
- `UsageRecord.(userId, metric, period)` (unique composite)

### Manual Indexes (Performance-Critical)

```prisma
// Fast project listing by user
@@index([userId])                              // on Project

// Fast ranking time-series queries
@@index([trackedKeywordId, date(sort: Desc)])   // on RankingHistory

// Fast crawl page lookups
@@index([crawlJobId, statusCode])               // on CrawlPage

// Fast issue lookups
@@index([crawlPageId, severity])                // on CrawlIssue

// Fast report listing
@@index([projectId, createdAt(sort: Desc)])     // on Report

// Token cleanup
@@index([expiresAt])                            // on RefreshToken

// Usage lookup
@@index([userId, period])                       // on UsageRecord
```

---

## Caching Strategy

### Redis Cache Layers

| Data | Cache Key Pattern | TTL | Reason |
|------|------------------|-----|--------|
| Keyword metrics | `kw:{keyword}:{country}` | 30 days | Metrics don't change daily |
| Domain overview | `dom:{domain}` | 24 hours | Summary data, moderate freshness |
| User session data | `user:{userId}:session` | 15 min | Match JWT access token TTL |
| Plan limits | `plan:{plan}:limits` | 24 hours | Rarely changes |
| Rate limit counters | `rl:{userId}:{endpoint}` | 1 min | Per-endpoint rate limiting |
| Crawl progress | `crawl:{jobId}:progress` | 1 hour | Live progress, short-lived |

### Cache Invalidation Rules

| Event | Action |
|-------|--------|
| User changes plan | Delete `plan:{plan}:limits` for old plan |
| Keyword data refreshed from API | Update `kw:{keyword}:{country}` |
| Crawl starts | Create `crawl:{jobId}:progress` |
| Crawl completes | Delete `crawl:{jobId}:progress` |
| User logs out | Delete `user:{userId}:session` |

---

## Migration Strategy

### Creating Migrations

```bash
# After editing schema.prisma:
cd packages/database
pnpm prisma migrate dev --name <descriptive_name>

# Examples:
pnpm prisma migrate dev --name init
pnpm prisma migrate dev --name add_crawl_tables
pnpm prisma migrate dev --name add_ai_conversation
```

### Migration Naming Convention

```
YYYYMMDDHHMMSS_<descriptive_name>
```

Examples:
- `20260401120000_init`
- `20260405150000_add_crawl_tables`
- `20260410090000_add_ai_conversation`

### Production Migration

```bash
# In CI/CD pipeline or deploy script:
pnpm prisma migrate deploy
```

This runs all pending migrations without generating new ones.

### Rules

1. **Never edit an existing migration file** after it has been applied
2. **Never use `prisma db push`** in production (it doesn't create migration files)
3. **Always review the generated SQL** before applying to production
4. **Back up the database** before running production migrations
5. **Test migrations** on a staging environment first

---

## Seed Data

### Development Seed Script (`prisma/seed.ts`)

Creates test data for local development:

```
Seed data:
  1. Super Admin user (admin@seoplatform.com)
  2. Test user with Pro plan (test@example.com)
  3. Test user with Free plan (free@example.com)
  4. 2 projects per test user
  5. 5 competitors per project
  6. 50 cached keywords with realistic metrics
  7. 20 tracked keywords per project
  8. 90 days of ranking history per tracked keyword
  9. 1 completed crawl job with 50 pages and issues
  10. 1 sample report per project
```

Run with: `pnpm prisma db seed`

---

## Full Prisma Schema

The complete `schema.prisma` file for Phase 1:

```prisma
// ============================================
// PRISMA SCHEMA - Phase 1 MVP
// ============================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// ENUMS
// ============================================

enum Role {
  USER
  ADMIN
  SUPER_ADMIN
}

enum Plan {
  FREE
  PRO
  AGENCY
}

enum BillingCycle {
  MONTHLY
  YEARLY
}

enum SubStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  TRIALING
}

enum UsageMetric {
  KEYWORDS_TRACKED
  PAGES_CRAWLED
  AI_CREDITS
  REPORTS_GENERATED
}

enum Device {
  DESKTOP
  MOBILE
}

enum DataSource {
  GSC
  DATAFORSEO
}

enum CrawlStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum IssueType {
  MISSING_TITLE
  MISSING_H1
  BROKEN_INTERNAL_LINK
  PAGE_NOT_FOUND
  SERVER_ERROR
  HAS_NOINDEX
  REDIRECT_CHAIN
  MISSING_META_DESCRIPTION
  DUPLICATE_TITLE
  DUPLICATE_META_DESCRIPTION
  IMAGE_MISSING_ALT
  SLOW_PAGE
  MULTIPLE_H1
  MISSING_CANONICAL
  TITLE_TOO_LONG
  TITLE_TOO_SHORT
  META_DESCRIPTION_TOO_LONG
  META_DESCRIPTION_TOO_SHORT
  LOW_WORD_COUNT
}

enum IssueSeverity {
  ERROR
  WARNING
  NOTICE
}

enum MessageRole {
  USER
  ASSISTANT
}

enum ReportType {
  WEEKLY
  MONTHLY
  CUSTOM
}

enum ReportStatus {
  PENDING
  GENERATING
  COMPLETED
  FAILED
}

enum SourceType {
  MANUAL
  WORDPRESS
  GITHUB
}

enum WpAuthMethod {
  APP_PASSWORD
  PLUGIN
}

enum WpSeoPlugin {
  YOAST
  RANKMATH
  AIOSEO
  NONE
}

enum DeployPlatform {
  GITHUB_PAGES
  VERCEL
  NETLIFY
  OTHER
}

// ============================================
// AUTH & USERS
// ============================================

model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  passwordHash        String    @map("password_hash")
  name                String?
  role                Role      @default(USER)
  isEmailVerified     Boolean   @default(false) @map("is_email_verified")
  emailVerifyToken    String?   @map("email_verify_token")
  passwordResetToken  String?   @map("password_reset_token")
  passwordResetExpiry DateTime? @map("password_reset_expiry")
  avatarUrl           String?   @map("avatar_url")
  timezone            String    @default("UTC")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  // Relations
  subscription    Subscription?
  googleConnection GoogleConnection?
  projects        Project[]
  refreshTokens   RefreshToken[]
  usageRecords    UsageRecord[]

  @@map("users")
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  tokenHash String   @map("token_hash")
  userAgent String?  @map("user_agent")
  ipAddress String?  @map("ip_address")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tokenHash])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

// ============================================
// BILLING
// ============================================

model Subscription {
  id                   String      @id @default(cuid())
  userId               String      @unique @map("user_id")
  stripeCustomerId     String      @unique @map("stripe_customer_id")
  stripeSubscriptionId String?     @unique @map("stripe_subscription_id")
  plan                 Plan        @default(FREE)
  billingCycle         BillingCycle @default(MONTHLY) @map("billing_cycle")
  status               SubStatus   @default(ACTIVE)
  currentPeriodStart   DateTime?   @map("current_period_start")
  currentPeriodEnd     DateTime?   @map("current_period_end")
  cancelAtPeriodEnd    Boolean     @default(false) @map("cancel_at_period_end")
  createdAt            DateTime    @default(now()) @map("created_at")
  updatedAt            DateTime    @updatedAt @map("updated_at")

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("subscriptions")
}

model UsageRecord {
  id        String      @id @default(cuid())
  userId    String      @map("user_id")
  metric    UsageMetric
  count     Int         @default(0)
  limit     Int
  period    String      // "2026-03" (year-month)
  createdAt DateTime    @default(now()) @map("created_at")
  updatedAt DateTime    @updatedAt @map("updated_at")

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, metric, period])
  @@index([userId, period])
  @@map("usage_records")
}

// ============================================
// PROJECTS
// ============================================

model Project {
  id         String     @id @default(cuid())
  userId     String     @map("user_id")
  domain     String
  name       String
  timezone   String     @default("UTC")
  sourceType SourceType @default(MANUAL) @map("source_type")
  isActive   Boolean    @default(true) @map("is_active")
  createdAt  DateTime   @default(now()) @map("created_at")
  updatedAt  DateTime   @updatedAt @map("updated_at")

  // Relations
  user                User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  competitors         Competitor[]
  projectKeywords     ProjectKeyword[]
  trackedKeywords     TrackedKeyword[]
  crawlJobs           CrawlJob[]
  conversations       AiConversation[]
  reports             Report[]
  wordpressConnection WordPressConnection?
  githubConnection    GitHubConnection?

  @@unique([userId, domain])
  @@index([userId])
  @@map("projects")
}

model Competitor {
  id        String   @id @default(cuid())
  projectId String   @map("project_id")
  domain    String
  name      String?
  createdAt DateTime @default(now()) @map("created_at")

  // Relations
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, domain])
  @@map("competitors")
}

// ============================================
// SOURCE INTEGRATIONS (WordPress + GitHub)
// ============================================

model WordPressConnection {
  id             String       @id @default(cuid())
  projectId      String       @unique @map("project_id")
  siteUrl        String       @map("site_url")
  username       String       // ENCRYPTED at rest
  appPassword    String?      @map("app_password")   // ENCRYPTED at rest
  pluginApiKey   String?      @map("plugin_api_key") // ENCRYPTED at rest
  authMethod     WpAuthMethod @map("auth_method")
  isValid        Boolean      @default(true) @map("is_valid")
  wpVersion      String?      @map("wp_version")
  seoPlugin      WpSeoPlugin? @map("seo_plugin")
  capabilities   Json?
  lastVerifiedAt DateTime?    @map("last_verified_at")
  connectedAt    DateTime     @default(now()) @map("connected_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  // Relations
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("wordpress_connections")
}

model GitHubConnection {
  id              String          @id @default(cuid())
  projectId       String          @unique @map("project_id")
  accessToken     String          @map("access_token") // ENCRYPTED at rest
  repoOwner       String          @map("repo_owner")
  repoName        String          @map("repo_name")
  repoFullName    String          @map("repo_full_name")
  defaultBranch   String          @default("main") @map("default_branch")
  repoUrl         String          @map("repo_url")
  deployUrl       String?         @map("deploy_url")
  deployPlatform  DeployPlatform? @map("deploy_platform")
  webhookId       String?         @map("webhook_id")
  webhookSecret   String?         @map("webhook_secret") // ENCRYPTED at rest
  isValid         Boolean         @default(true) @map("is_valid")
  lastVerifiedAt  DateTime?       @map("last_verified_at")
  connectedAt     DateTime        @default(now()) @map("connected_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")

  // Relations
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("github_connections")
}

// ============================================
// GOOGLE INTEGRATIONS
// ============================================

model GoogleConnection {
  id           String   @id @default(cuid())
  userId       String   @unique @map("user_id")
  accessToken  String   @map("access_token")
  refreshToken String   @map("refresh_token") // ENCRYPTED at rest
  tokenExpiry  DateTime @map("token_expiry")
  scope        String
  gaPropertyId String?  @map("ga_property_id")
  gscSiteUrl   String?  @map("gsc_site_url")
  connectedAt  DateTime @default(now()) @map("connected_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("google_connections")
}

// ============================================
// KEYWORDS
// ============================================

model KeywordCache {
  id           String   @id @default(cuid())
  keyword      String
  country      String   @default("US")
  searchVolume Int?     @map("search_volume")
  difficulty   Int?     // 0-100
  cpc          Float?   // USD
  trend        Json?    // 12-month volume trend array
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@unique([keyword, country])
  @@map("keyword_cache")
}

model ProjectKeyword {
  id        String   @id @default(cuid())
  projectId String   @map("project_id")
  keyword   String
  targetUrl String?  @map("target_url")
  notes     String?
  createdAt DateTime @default(now()) @map("created_at")

  // Relations
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, keyword])
  @@map("project_keywords")
}

// ============================================
// RANK TRACKING
// ============================================

model TrackedKeyword {
  id        String   @id @default(cuid())
  projectId String   @map("project_id")
  keyword   String
  targetUrl String?  @map("target_url")
  device    Device   @default(DESKTOP)
  country   String   @default("US")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  // Relations
  project        Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  rankingHistory RankingHistory[]

  @@unique([projectId, keyword, device, country])
  @@index([projectId])
  @@map("tracked_keywords")
}

model RankingHistory {
  id               String     @id @default(cuid())
  trackedKeywordId String     @map("tracked_keyword_id")
  position         Float?     // Average position (e.g., 7.3). Null = not ranking
  clicks           Int        @default(0)
  impressions      Int        @default(0)
  ctr              Float      @default(0) // 0.0 - 1.0
  date             DateTime
  source           DataSource @default(GSC)

  // Relations
  trackedKeyword TrackedKeyword @relation(fields: [trackedKeywordId], references: [id], onDelete: Cascade)

  @@unique([trackedKeywordId, date, source])
  @@index([trackedKeywordId, date(sort: Desc)])
  @@map("ranking_history")
}

// ============================================
// SITE AUDIT
// ============================================

model CrawlJob {
  id           String      @id @default(cuid())
  projectId    String      @map("project_id")
  status       CrawlStatus @default(QUEUED)
  pagesCrawled Int         @default(0) @map("pages_crawled")
  pagesTotal   Int         @default(0) @map("pages_total")
  pagesLimit   Int         @map("pages_limit")
  errorCount   Int         @default(0) @map("error_count")
  warningCount Int         @default(0) @map("warning_count")
  noticeCount  Int         @default(0) @map("notice_count")
  score        Int?        // 0-100, calculated after completion
  startedAt    DateTime?   @map("started_at")
  completedAt  DateTime?   @map("completed_at")
  createdAt    DateTime    @default(now()) @map("created_at")

  // Relations
  project Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  pages   CrawlPage[]

  @@index([projectId])
  @@map("crawl_jobs")
}

model CrawlPage {
  id                String   @id @default(cuid())
  crawlJobId        String   @map("crawl_job_id")
  url               String
  statusCode        Int?     @map("status_code")
  title             String?
  metaDescription   String?  @map("meta_description")
  h1                String?
  h1Count           Int      @default(0) @map("h1_count")
  wordCount         Int      @default(0) @map("word_count")
  loadTimeMs        Int?     @map("load_time_ms")
  contentType       String?  @map("content_type")
  canonicalUrl      String?  @map("canonical_url")
  hasRobotsNoindex  Boolean  @default(false) @map("has_robots_noindex")
  hasRobotsNofollow Boolean  @default(false) @map("has_robots_nofollow")
  internalLinksCount Int     @default(0) @map("internal_links_count")
  externalLinksCount Int     @default(0) @map("external_links_count")
  imagesCount       Int      @default(0) @map("images_count")
  imagesWithoutAlt  Int      @default(0) @map("images_without_alt")
  crawledAt         DateTime @default(now()) @map("crawled_at")

  // Relations
  crawlJob CrawlJob    @relation(fields: [crawlJobId], references: [id], onDelete: Cascade)
  issues   CrawlIssue[]

  @@index([crawlJobId, statusCode])
  @@map("crawl_pages")
}

model CrawlIssue {
  id          String        @id @default(cuid())
  crawlPageId String        @map("crawl_page_id")
  type        IssueType
  severity    IssueSeverity
  message     String
  details     Json?
  suggestion  String?

  // Relations
  crawlPage CrawlPage @relation(fields: [crawlPageId], references: [id], onDelete: Cascade)

  @@index([crawlPageId, severity])
  @@map("crawl_issues")
}

// ============================================
// AI ASSISTANT
// ============================================

model AiConversation {
  id        String   @id @default(cuid())
  projectId String   @map("project_id")
  title     String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  project  Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  messages AiMessage[]

  @@index([projectId])
  @@map("ai_conversations")
}

model AiMessage {
  id             String      @id @default(cuid())
  conversationId String      @map("conversation_id")
  role           MessageRole
  content        String
  tokensUsed     Int         @default(0) @map("tokens_used")
  createdAt      DateTime    @default(now()) @map("created_at")

  // Relations
  conversation AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("ai_messages")
}

// ============================================
// REPORTS
// ============================================

model Report {
  id        String       @id @default(cuid())
  projectId String       @map("project_id")
  title     String
  type      ReportType   @default(WEEKLY)
  dateFrom  DateTime     @map("date_from")
  dateTo    DateTime     @map("date_to")
  filePath  String?      @map("file_path")
  fileSize  Int?         @map("file_size")
  status    ReportStatus @default(PENDING)
  createdAt DateTime     @default(now()) @map("created_at")

  // Relations
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt(sort: Desc)])
  @@map("reports")
}
```

---

## Data Volume Estimates (Phase 1, first 6 months)

| Table | Rows per project/year | At 100 projects | At 1,000 projects |
|-------|----------------------|-----------------|-------------------|
| `ranking_history` | 182,500 | 18.2M | 182M |
| `crawl_pages` | 10,000 per crawl | 1M (100 crawls) | 10M |
| `crawl_issues` | ~3 per page avg | 3M | 30M |
| `keyword_cache` | Global: ~100K | 100K | 100K |
| `ai_messages` | ~1,000 per project | 100K | 1M |
| All other tables | Low volume | < 50K | < 500K |

**PostgreSQL handles this easily** at Phase 1 scale. Partitioning `ranking_history` by date
is recommended when approaching 100M+ rows (Phase 2/3 concern).
