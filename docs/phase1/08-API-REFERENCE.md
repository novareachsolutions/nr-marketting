# Phase 1 - API Reference

> **Base URL:** `http://localhost:4000/api` (dev) / `https://api.yourdomain.com/api` (prod)
> **Auth:** Bearer JWT in Authorization header (except public routes)
> **Format:** JSON request/response

---

## Table of Contents

- [Standard Response Format](#standard-response-format)
- [Error Response Format](#error-response-format)
- [Authentication Headers](#authentication-headers)
- [Pagination](#pagination)
- [Complete Endpoint List](#complete-endpoint-list)
- [Endpoint Details by Module](#endpoint-details-by-module)

---

## Standard Response Format

Every API response follows this envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "perPage": 50,
    "total": 1200
  },
  "error": null
}
```

- `success`: `true` for 2xx responses, `false` for 4xx/5xx
- `data`: The actual response payload (object, array, or null on error)
- `meta`: Present only for paginated responses
- `error`: `null` on success, error details on failure

---

## Error Response Format

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [
      { "field": "email", "message": "must be a valid email address" }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body/params failed validation |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but no permission (wrong role/plan/ownership) |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource (e.g., email already registered) |
| `PLAN_LIMIT_EXCEEDED` | 403 | Usage exceeds plan limit |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `EXTERNAL_API_ERROR` | 502 | DataForSEO/Google/Claude API failure |

---

## Authentication Headers

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Public Routes (No Auth Required)

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/verify-email
GET  /api/health
POST /api/billing/webhook          (Stripe webhook, verified by signature)
POST /api/github/webhook           (GitHub webhook, verified by signature)
```

All other routes require a valid JWT access token.

---

## Pagination

### Request

```
GET /api/projects/:id/keywords?page=2&perPage=50&sortBy=searchVolume&sortOrder=desc
```

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number (1-indexed) |
| `perPage` | 50 | Items per page (max 100) |
| `sortBy` | varies | Column to sort by |
| `sortOrder` | `desc` | `asc` or `desc` |

### Response Meta

```json
{
  "meta": {
    "page": 2,
    "perPage": 50,
    "total": 1200,
    "totalPages": 24,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

## Complete Endpoint List

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register new account |
| POST | `/auth/login` | Login, get tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |
| GET | `/auth/verify-email` | Verify email address |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Set new password |
| POST | `/auth/resend-verification` | Resend verification email |
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/me` | Update profile (name, timezone) |

### Billing
| Method | Path | Description |
|--------|------|-------------|
| GET | `/billing/subscription` | Get current subscription |
| GET | `/billing/usage` | Get current usage vs limits |
| POST | `/billing/create-checkout-session` | Start Stripe checkout |
| POST | `/billing/create-portal-session` | Open Stripe portal |
| POST | `/billing/webhook` | Stripe webhook (internal) |

### Projects
| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List user's projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project + dashboard summary |
| PUT | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Delete project + all data |
| GET | `/projects/:id/competitors` | List competitors |
| POST | `/projects/:id/competitors` | Add competitor |
| DELETE | `/projects/:id/competitors/:cId` | Remove competitor |

### Google OAuth
| Method | Path | Description |
|--------|------|-------------|
| GET | `/google-oauth/authorize` | Redirect to Google consent |
| GET | `/google-oauth/callback` | Handle OAuth callback |
| GET | `/google-oauth/status` | Check connection status |
| GET | `/google-oauth/available-sites` | List GA properties + GSC sites |
| POST | `/google-oauth/select-properties` | Save selected properties |
| DELETE | `/google-oauth/disconnect` | Disconnect Google |

### WordPress Integration
| Method | Path | Description |
|--------|------|-------------|
| POST | `/projects/:id/wordpress/connect` | Connect WordPress site (verify + store creds) |
| GET | `/projects/:id/wordpress/status` | Check WP connection status + capabilities |
| POST | `/projects/:id/wordpress/verify` | Re-verify credentials are working |
| DELETE | `/projects/:id/wordpress/disconnect` | Disconnect WordPress |
| POST | `/projects/:id/wordpress/fix-issue/:issueId` | Auto-fix a crawl issue via WP REST API |
| POST | `/projects/:id/wordpress/publish-content` | Publish AI-generated content to WordPress |

### GitHub Integration
| Method | Path | Description |
|--------|------|-------------|
| GET | `/github/authorize` | Redirect to GitHub OAuth consent |
| GET | `/github/callback` | Handle GitHub OAuth callback |
| GET | `/projects/:id/github/repos` | List user's GitHub repos (for selection) |
| POST | `/projects/:id/github/connect` | Select repo + set up deploy webhook |
| GET | `/projects/:id/github/status` | Check GitHub connection status |
| DELETE | `/projects/:id/github/disconnect` | Disconnect GitHub + remove webhook |
| POST | `/projects/:id/github/fix-issue/:issueId` | Create PR to fix a crawl issue |
| POST | `/github/webhook` | GitHub webhook receiver (push/deploy events) |

### Domain Overview
| Method | Path | Description |
|--------|------|-------------|
| GET | `/domain-overview` | Get domain metrics (any domain) |

### Keywords
| Method | Path | Description |
|--------|------|-------------|
| GET | `/keywords/search` | Keyword overview (volume, difficulty) |
| GET | `/keywords/suggestions` | Keyword suggestions (magic tool) |
| GET | `/projects/:id/keywords` | List saved keywords |
| POST | `/projects/:id/keywords` | Save keyword to project |
| DELETE | `/projects/:id/keywords/:kwId` | Remove keyword |

### Rank Tracking
| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/:id/rankings` | List tracked keywords + positions |
| GET | `/projects/:id/rankings/history` | Position history for a keyword |
| POST | `/projects/:id/rankings/track` | Start tracking keyword(s) |
| DELETE | `/projects/:id/rankings/:tkId` | Stop tracking keyword |
| POST | `/projects/:id/rankings/sync` | Manual GSC sync |

### Traffic Insights
| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/:id/traffic-insights` | Merged GA + GSC traffic data |

### Site Audit
| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/:id/crawls` | List crawl jobs |
| POST | `/projects/:id/crawls` | Start new crawl |
| GET | `/projects/:id/crawls/:crawlId` | Get crawl results |
| GET | `/projects/:id/crawls/:crawlId/issues` | List issues |
| GET | `/projects/:id/crawls/:crawlId/pages` | List pages |
| GET | `/projects/:id/crawls/:crawlId/compare` | Compare with previous |
| DELETE | `/projects/:id/crawls/:crawlId` | Cancel running crawl |

### AI Assistant
| Method | Path | Description |
|--------|------|-------------|
| POST | `/projects/:id/ai/chat` | Send message (SSE stream) |
| GET | `/projects/:id/ai/conversations` | List conversations |
| GET | `/projects/:id/ai/conversations/:cId` | Get conversation messages |
| DELETE | `/projects/:id/ai/conversations/:cId` | Delete conversation |
| GET | `/projects/:id/ai/insights` | Dashboard insight cards |

### Topic Research
| Method | Path | Description |
|--------|------|-------------|
| POST | `/projects/:id/topics/research` | Generate topic ideas |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| POST | `/projects/:id/reports/generate` | Generate PDF report |
| GET | `/projects/:id/reports` | List reports |
| GET | `/projects/:id/reports/:rId` | Get report metadata |
| GET | `/projects/:id/reports/:rId/download` | Download PDF |
| DELETE | `/projects/:id/reports/:rId` | Delete report |

### Alerts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/:id/alerts` | List alert configs |
| POST | `/projects/:id/alerts` | Create alert |
| PUT | `/projects/:id/alerts/:aId` | Update alert |
| DELETE | `/projects/:id/alerts/:aId` | Delete alert |
| GET | `/projects/:id/alerts/history` | Alert event log |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (public) |

---

## Endpoint Details by Module

### Query Parameters Reference

**Domain Overview:**
```
GET /api/domain-overview?domain=example.com&country=US
  - domain (required): Target domain
  - country (optional, default: US): ISO 3166-1 alpha-2 code
```

**Keyword Search:**
```
GET /api/keywords/search?q=running+shoes&country=US
  - q (required): Keyword to research
  - country (optional, default: US): Country code
```

**Keyword Suggestions:**
```
GET /api/keywords/suggestions?q=running+shoes&country=US&limit=50&page=1
  - q (required): Seed keyword
  - country (optional, default: US)
  - limit (optional, default: 50, max: 100)
  - page (optional, default: 1)
```

**Rankings List:**
```
GET /api/projects/:id/rankings?page=1&perPage=50&sortBy=position&sortOrder=asc&device=DESKTOP
  - page, perPage: pagination
  - sortBy: position | keyword | change | clicks | impressions
  - sortOrder: asc | desc
  - device: DESKTOP | MOBILE (optional filter)
```

**Ranking History:**
```
GET /api/projects/:id/rankings/history?trackedKeywordId=tk123&days=30
  - trackedKeywordId (required): Which keyword
  - days (optional, default: 30): How many days of history
```

**Traffic Insights:**
```
GET /api/projects/:id/traffic-insights?dateFrom=2026-03-01&dateTo=2026-03-31
  - dateFrom (required): Period start
  - dateTo (required): Period end
```

**Crawl Issues:**
```
GET /api/projects/:id/crawls/:crawlId/issues?severity=ERROR&type=MISSING_TITLE&page=1&perPage=50
  - severity (optional): ERROR | WARNING | NOTICE
  - type (optional): IssueType enum value
  - page, perPage: pagination
```

**Crawl Pages:**
```
GET /api/projects/:id/crawls/:crawlId/pages?statusCode=404&page=1&perPage=50
  - statusCode (optional): Filter by HTTP status
  - page, perPage: pagination
```

---

## WebSocket Events

### Connection

```
Client connects to: ws://localhost:4000
Namespace: /crawl
Auth: { token: "jwt_access_token" }
```

### Events (Server -> Client)

| Event | When | Payload |
|-------|------|---------|
| `crawl:progress` | Each page crawled | `{ crawlJobId, pagesCrawled, pagesTotal, errorsFound, percentage, lastUrl }` |
| `crawl:completed` | Crawl finished | `{ crawlJobId, pagesCrawled, score, errorCount, warningCount, noticeCount, duration }` |
| `crawl:failed` | Crawl error | `{ crawlJobId, error }` |

### Events (Client -> Server)

| Event | When | Payload |
|-------|------|---------|
| `crawl:subscribe` | Join crawl updates | `{ crawlJobId }` |
| `crawl:unsubscribe` | Leave crawl updates | `{ crawlJobId }` |

---

## Rate Limits Summary

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| Auth (login/register) | 5 req | 15 min |
| Keyword search | 30 req | 1 min |
| Keyword suggestions | 20 req | 1 min |
| Domain overview | 20 req | 1 min |
| Start crawl | 3 req | 1 hour |
| AI chat | 20 req | 1 hour |
| Report generation | 5 req | 1 hour |
| All other endpoints | 100 req | 1 min |

Rate limit headers returned on every response:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1711900060
```
