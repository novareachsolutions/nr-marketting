# Phase 1 MVP - Overview & Architecture

> **Timeline:** Months 1-3
> **Goal:** A working SEO platform that real users can pay for.
> **Core Principle:** Build the 20% that delivers 80% of value.

---

## Table of Contents

- [What We're Building](#what-were-building)
- [Phase 1 Scope](#phase-1-scope)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [System Architecture Diagram](#system-architecture-diagram)
- [Service Communication](#service-communication)
- [Multi-Tenancy Model](#multi-tenancy-model)
- [Security Model](#security-model)
- [Environment Configuration](#environment-configuration)
- [Development Workflow](#development-workflow)

---

## What We're Building

A **multi-tenant SaaS SEO platform** that covers the core SEO workflow:

1. **Discover keywords** people search for (Keyword Research)
2. **Track where you rank** on Google for those keywords (Rank Tracking)
3. **Find what's broken** on your website (Site Audit)
4. **Get AI-powered insights** and content suggestions (AI Assistant)
5. **Generate PDF reports** for clients (Reporting)

This is the same core that Semrush, Ahrefs, and Moz are built around. Phase 1 delivers a complete, usable product covering these fundamentals.

---

## Phase 1 Scope

### Modules Included

| # | Module | Data Source | Build Type |
|---|--------|------------|-----------|
| 1 | **Auth & User Management** | Own DB | Build yourself |
| 2 | **Billing & Subscriptions** | Stripe API | Build yourself |
| 3 | **Project / Workspace** | Own DB | Build yourself |
| 4 | **Google OAuth (GA + GSC)** | Google APIs | Build yourself |
| 5 | **WordPress Integration** | WordPress REST API | API integration |
| 6 | **GitHub Integration** | GitHub API + OAuth | API integration |
| 7 | **Domain Overview** | DataForSEO API | API integration |
| 8 | **Keyword Overview** | DataForSEO API | API integration |
| 9 | **Keyword Magic Tool** | DataForSEO API | API integration |
| 10 | **Position Tracking / Rank Tracking** | Google Search Console API | Free API |
| 11 | **Organic Traffic Insights** | GSC + GA API merged | Free API |
| 12 | **Site Audit (Crawler)** | None (self-built) | Build yourself |
| 13 | **AI Copilot / Assistant** | Claude API | AI integration |
| 14 | **Topic Research** | Claude API + DataForSEO | AI + API |
| 15 | **Basic PDF Reports** | Puppeteer | Build yourself |

### Modules NOT in Phase 1

- Backlink Analytics (Phase 2)
- Backlink Audit / Gap (Phase 2)
- On-Page SEO Checker (Phase 2)
- AI Visibility Dashboard (Phase 2)
- Content Writer / Optimizer (Phase 2)
- Social Media tools (Phase 3)
- Local SEO tools (Phase 3)
- Advertising Research (Phase 2)
- Link Building (Phase 2)
- White-label Reporting (Phase 3)
- Shopify / Wix / Webflow integrations (Phase 3)

---

## Tech Stack

### Backend

| Layer | Technology | Why |
|-------|-----------|-----|
| **Runtime** | Node.js 20 LTS | JavaScript everywhere, large ecosystem |
| **Framework** | NestJS 10 | Modular, TypeScript-first, built-in DI, guards, interceptors |
| **ORM** | Prisma 5 | Type-safe queries, auto-generated client, migration system |
| **Database** | PostgreSQL 15 | ACID, JSON support, full-text search, battle-tested |
| **Cache / Queue** | Redis 7 | In-memory cache + BullMQ job queue backend |
| **Job Queue** | BullMQ | Reliable background jobs with retry, priority, concurrency |
| **Auth** | JWT (access + refresh tokens) | Stateless, scalable, industry standard |
| **Validation** | class-validator + class-transformer | Decorator-based DTO validation in NestJS |
| **WebSocket** | Socket.io (via @nestjs/websockets) | Real-time crawl progress to frontend |
| **HTTP Client** | Axios | API calls to DataForSEO, Google APIs |
| **HTML Parser** | Cheerio | jQuery-like DOM parsing for site audit crawler |
| **PDF Generation** | Puppeteer | Render styled HTML to PDF for reports |
| **Email** | SendGrid / Nodemailer | Transactional emails (auth, alerts, reports) |
| **Logging** | Pino (via nestjs-pino) | Structured JSON logging, fast |
| **Testing** | Jest + Supertest | Unit + integration + e2e tests |

### Frontend

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 14 (Pages Router) | SSR, file-based routing, API routes |
| **Language** | TypeScript | Type safety across the stack |
| **State** | TanStack Query (React Query) v5 | Server state management, caching, refetching |
| **HTTP Client** | Axios | Shared with backend, interceptors for auth |
| **UI Library** | Tailwind CSS + shadcn/ui | Utility-first CSS, pre-built accessible components |
| **Charts** | Recharts | React-native charting, good for SEO dashboards |
| **Tables** | TanStack Table | Headless table with sorting, filtering, pagination |
| **Forms** | React Hook Form + Zod | Performant forms with schema validation |
| **Icons** | Lucide React | Clean, consistent icon set |
| **Toast/Notifications** | Sonner | Simple toast notifications |
| **Date Handling** | date-fns | Lightweight date formatting and manipulation |

### Infrastructure

| Layer | Technology | Why |
|-------|-----------|-----|
| **Containerization** | Docker + Docker Compose | Consistent dev/prod environments |
| **Build System** | Turborepo | Monorepo task orchestration, caching |
| **Package Manager** | pnpm 8 | Fast, disk-efficient, workspace support |
| **CI/CD** | GitHub Actions | Automated testing, building, deployment |
| **Hosting** | VPS (Hetzner/DigitalOcean) or AWS | Cost-effective for MVP |
| **Reverse Proxy** | Nginx or Traefik | SSL termination, load balancing |
| **SSL** | Let's Encrypt (Certbot) | Free SSL certificates |
| **Monitoring** | Uptime Kuma + Pino logs | Basic uptime monitoring + structured logs |

### Third-Party Services

| Service | Purpose | Cost at MVP |
|---------|---------|------------|
| **DataForSEO** | Keywords, domain data | $10-50/month (pay-per-use) |
| **Google Search Console API** | Rank tracking (own site) | Free |
| **Google Analytics API** | Traffic data (own site) | Free |
| **Google OAuth** | GA + GSC user authorization | Free |
| **GitHub API + OAuth** | Repo access, PRs, webhooks | Free |
| **WordPress REST API** | Read/write posts, meta, media | Free (built into WordPress) |
| **Stripe** | Billing, subscriptions | 2.9% + 30c per txn |
| **SendGrid / Postmark** | Transactional email | Free tier -> $20/month |
| **Anthropic Claude API** | AI assistant, topic research | $20-50/month |

**Total Phase 1 running cost: ~$30-150/month** (before paying users)

---

## Monorepo Structure

```
nr-marketting/
|
|-- apps/
|   |-- backend/
|   |   |-- api/                          # NestJS API (port 4000)
|   |   |   |-- src/
|   |   |   |   |-- main.ts               # Bootstrap (CORS, validation, swagger)
|   |   |   |   |-- app.module.ts         # Root module
|   |   |   |   |
|   |   |   |   |-- common/               # Shared backend utilities
|   |   |   |   |   |-- guards/
|   |   |   |   |   |   |-- jwt-auth.guard.ts
|   |   |   |   |   |   |-- roles.guard.ts
|   |   |   |   |   |   |-- plan-limit.guard.ts
|   |   |   |   |   |-- interceptors/
|   |   |   |   |   |   |-- transform.interceptor.ts
|   |   |   |   |   |   |-- logging.interceptor.ts
|   |   |   |   |   |-- decorators/
|   |   |   |   |   |   |-- current-user.decorator.ts
|   |   |   |   |   |   |-- roles.decorator.ts
|   |   |   |   |   |-- filters/
|   |   |   |   |   |   |-- http-exception.filter.ts
|   |   |   |   |   |-- pipes/
|   |   |   |   |   |   |-- parse-uuid.pipe.ts
|   |   |   |   |   |-- dto/
|   |   |   |   |   |   |-- pagination.dto.ts
|   |   |   |   |   |   |-- api-response.dto.ts
|   |   |   |   |   |-- constants/
|   |   |   |   |       |-- plan-limits.ts
|   |   |   |   |       |-- cache-keys.ts
|   |   |   |   |
|   |   |   |   |-- modules/
|   |   |   |   |   |-- auth/
|   |   |   |   |   |   |-- auth.module.ts
|   |   |   |   |   |   |-- auth.controller.ts
|   |   |   |   |   |   |-- auth.service.ts
|   |   |   |   |   |   |-- strategies/
|   |   |   |   |   |   |   |-- jwt.strategy.ts
|   |   |   |   |   |   |   |-- jwt-refresh.strategy.ts
|   |   |   |   |   |   |-- dto/
|   |   |   |   |   |   |   |-- register.dto.ts
|   |   |   |   |   |   |   |-- login.dto.ts
|   |   |   |   |   |   |   |-- refresh-token.dto.ts
|   |   |   |   |   |   |   |-- forgot-password.dto.ts
|   |   |   |   |   |   |   |-- reset-password.dto.ts
|   |   |   |   |   |   |-- guards/
|   |   |   |   |   |       |-- jwt-auth.guard.ts
|   |   |   |   |   |       |-- jwt-refresh.guard.ts
|   |   |   |   |   |
|   |   |   |   |   |-- users/
|   |   |   |   |   |   |-- users.module.ts
|   |   |   |   |   |   |-- users.controller.ts
|   |   |   |   |   |   |-- users.service.ts
|   |   |   |   |   |   |-- dto/
|   |   |   |   |   |       |-- update-user.dto.ts
|   |   |   |   |   |       |-- user-response.dto.ts
|   |   |   |   |   |
|   |   |   |   |   |-- billing/
|   |   |   |   |   |   |-- billing.module.ts
|   |   |   |   |   |   |-- billing.controller.ts
|   |   |   |   |   |   |-- billing.service.ts
|   |   |   |   |   |   |-- stripe-webhook.controller.ts
|   |   |   |   |   |   |-- dto/
|   |   |   |   |   |       |-- create-checkout.dto.ts
|   |   |   |   |   |       |-- subscription-response.dto.ts
|   |   |   |   |   |
|   |   |   |   |   |-- projects/
|   |   |   |   |   |   |-- projects.module.ts
|   |   |   |   |   |   |-- projects.controller.ts
|   |   |   |   |   |   |-- projects.service.ts
|   |   |   |   |   |   |-- dto/
|   |   |   |   |   |       |-- create-project.dto.ts
|   |   |   |   |   |       |-- update-project.dto.ts
|   |   |   |   |   |       |-- project-response.dto.ts
|   |   |   |   |   |
|   |   |   |   |   |-- google-oauth/
|   |   |   |   |   |   |-- google-oauth.module.ts
|   |   |   |   |   |   |-- google-oauth.controller.ts
|   |   |   |   |   |   |-- google-oauth.service.ts
|   |   |   |   |   |   |-- google-analytics.service.ts
|   |   |   |   |   |   |-- google-search-console.service.ts
|   |   |   |   |   |   |-- dto/
|   |   |   |   |   |       |-- oauth-callback.dto.ts
|   |   |   |   |   |
|   |   |   |   |   |-- wordpress/
|   |   |   |   |   |   |-- wordpress.module.ts
|   |   |   |   |   |   |-- wordpress.controller.ts
|   |   |   |   |   |   |-- wordpress.service.ts
|   |   |   |   |   |   |-- wp-api-client.service.ts
|   |   |   |   |   |   |-- wp-auto-fix.service.ts
|   |   |   |   |   |   |-- dto/
|   |   |   |   |   |       |-- connect-wordpress.dto.ts
|   |   |   |   |   |       |-- fix-issue.dto.ts
|   |   |   |   |   |       |-- publish-content.dto.ts
|   |   |   |   |   |
|   |   |   |   |   |-- github/
|   |   |   |   |   |   |-- github.module.ts
|   |   |   |   |   |   |-- github.controller.ts
|   |   |   |   |   |   |-- github.service.ts
|   |   |   |   |   |   |-- github-api-client.service.ts
|   |   |   |   |   |   |-- github-auto-fix.service.ts
|   |   |   |   |   |   |-- github-webhook.controller.ts
|   |   |   |   |   |   |-- dto/
|   |   |   |   |   |       |-- connect-github.dto.ts
|   |   |   |   |   |       |-- fix-issue.dto.ts
|   |   |   |   |   |
|   |   |   |   |   |-- keywords/
|   |   |   |   |   |   |-- keywords.module.ts
|   |   |   |   |   |   |-- keywords.controller.ts
|   |   |   |   |   |   |-- keywords.service.ts
|   |   |   |   |   |   |-- dataforseo.service.ts
|   |   |   |   |   |   |-- dto/
|   |   |   |   |   |       |-- search-keywords.dto.ts
|   |   |   |   |   |       |-- save-keyword.dto.ts
|   |   |   |   |   |       |-- keyword-response.dto.ts
|   |   |   |   |   |
|   |   |   |   |   |-- domain-overview/
|   |   |   |   |   |   |-- domain-overview.module.ts
|   |   |   |   |   |   |-- domain-overview.controller.ts
|   |   |   |   |   |   |-- domain-overview.service.ts
|   |   |   |   |   |
|   |   |   |   |   |-- rank-tracking/
|   |   |   |   |   |   |-- rank-tracking.module.ts
|   |   |   |   |   |   |-- rank-tracking.controller.ts
|   |   |   |   |   |   |-- rank-tracking.service.ts
|   |   |   |   |   |   |-- gsc-sync.processor.ts      # BullMQ worker
|   |   |   |   |   |   |-- dto/
|   |   |   |   |   |       |-- track-keyword.dto.ts
|   |   |   |   |   |       |-- ranking-history.dto.ts
|   |   |   |   |   |
|   |   |   |   |   |-- traffic-insights/
|   |   |   |   |   |   |-- traffic-insights.module.ts
|   |   |   |   |   |   |-- traffic-insights.controller.ts
|   |   |   |   |   |   |-- traffic-insights.service.ts
|   |   |   |   |   |
|   |   |   |   |   |-- site-audit/
|   |   |   |   |   |   |-- site-audit.module.ts
|   |   |   |   |   |   |-- site-audit.controller.ts
|   |   |   |   |   |   |-- site-audit.service.ts
|   |   |   |   |   |   |-- crawler.processor.ts        # BullMQ worker
|   |   |   |   |   |   |-- page-analyzer.service.ts
|   |   |   |   |   |   |-- score-calculator.service.ts
|   |   |   |   |   |   |-- site-audit.gateway.ts       # WebSocket gateway
|   |   |   |   |   |   |-- dto/
|   |   |   |   |   |       |-- start-crawl.dto.ts
|   |   |   |   |   |       |-- crawl-result.dto.ts
|   |   |   |   |   |
|   |   |   |   |   |-- ai-assistant/
|   |   |   |   |   |   |-- ai-assistant.module.ts
|   |   |   |   |   |   |-- ai-assistant.controller.ts
|   |   |   |   |   |   |-- ai-assistant.service.ts
|   |   |   |   |   |   |-- claude.service.ts
|   |   |   |   |   |   |-- dto/
|   |   |   |   |   |       |-- ask-assistant.dto.ts
|   |   |   |   |   |       |-- topic-research.dto.ts
|   |   |   |   |   |
|   |   |   |   |   |-- reports/
|   |   |   |   |   |   |-- reports.module.ts
|   |   |   |   |   |   |-- reports.controller.ts
|   |   |   |   |   |   |-- reports.service.ts
|   |   |   |   |   |   |-- pdf-generator.service.ts
|   |   |   |   |   |   |-- report-templates/
|   |   |   |   |   |   |   |-- weekly-report.hbs
|   |   |   |   |   |   |   |-- executive-summary.hbs
|   |   |   |   |   |   |-- dto/
|   |   |   |   |   |       |-- generate-report.dto.ts
|   |   |   |   |   |
|   |   |   |   |   |-- health/
|   |   |   |   |       |-- health.module.ts
|   |   |   |   |       |-- health.controller.ts
|   |   |   |   |
|   |   |   |   |-- config/
|   |   |   |       |-- configuration.ts
|   |   |   |       |-- validation.ts
|   |   |   |
|   |   |   |-- test/
|   |   |   |-- package.json
|   |   |   |-- nest-cli.json
|   |   |   |-- tsconfig.json
|   |
|   |-- frontend/
|       |-- tenant-dashboard/              # Main user-facing app (port 3000)
|       |-- super-admin/                   # Platform admin panel (port 3001)
|       |-- customer-website/              # Marketing/landing pages (port 3002)
|
|-- packages/
|   |-- database/                          # Prisma schema + client
|   |   |-- prisma/
|   |   |   |-- schema.prisma
|   |   |   |-- migrations/
|   |   |   |-- seed.ts
|   |   |-- src/
|   |       |-- index.ts                   # PrismaClient singleton export
|   |
|   |-- shared-common/                     # Types, constants, utils (shared everywhere)
|   |-- shared-backend/                    # Backend-only utilities
|   |-- shared-frontend/                   # Frontend components, hooks, API client
|   |-- tsconfig/                          # Shared TypeScript configs
|
|-- scripts/
|   |-- deploy.sh
|   |-- rollback.sh
|
|-- docs/
|   |-- phase1/                            # This documentation
|
|-- docker-compose.dev.yml
|-- docker-compose.prod.yml
|-- docker-compose.local.yml
|-- Dockerfile
|-- turbo.json
|-- pnpm-workspace.yaml
|-- package.json
```

---

## System Architecture Diagram

```
                                    INTERNET
                                       |
                              +--------+--------+
                              |   Nginx / CDN   |
                              +--------+--------+
                                       |
                    +------------------+------------------+
                    |                  |                  |
             +------+------+   +------+------+   +------+------+
             |   Tenant    |   | Super Admin |   |  Customer   |
             |  Dashboard  |   |   Panel     |   |  Website    |
             |  (Next.js)  |   |  (Next.js)  |   |  (Next.js)  |
             |  :3000      |   |  :3001      |   |  :3002      |
             +------+------+   +------+------+   +------+------+
                    |                  |                  |
                    +------------------+------------------+
                                       |
                              +--------+--------+
                              |   NestJS API    |
                              |   :4000         |
                              +--------+--------+
                                       |
                    +------------------+------------------+
                    |                  |                  |
             +------+------+   +------+------+   +------+------+
             | PostgreSQL  |   |    Redis    |   |   BullMQ    |
             |  :5432      |   |   :6379     |   |   Workers   |
             +-------------+   +-------------+   +-------------+
                                                         |
                                          +--------------+--------------+
                                          |              |              |
                                    +-----+----+  +-----+----+  +-----+----+
                                    | GSC Sync |  |  Crawl   |  |  Report  |
                                    | Worker   |  |  Worker  |  |  Worker  |
                                    +----------+  +----------+  +----------+

EXTERNAL SERVICES:
  - DataForSEO API (keywords, domain data)
  - Google Search Console API (rank data)
  - Google Analytics API (traffic data)
  - Google OAuth (user authorization)
  - Stripe API (billing)
  - Claude API (AI assistant)
  - SendGrid (email)
```

---

## Service Communication

### Frontend -> Backend

All frontend apps communicate with the backend via **REST API over HTTPS**.

```
Frontend (any)  -->  GET/POST/PUT/DELETE  -->  NestJS API (:4000)
                     Authorization: Bearer <jwt_access_token>
```

- Every request includes JWT access token in Authorization header
- Access token expires in 15 minutes
- Frontend auto-refreshes via `/api/auth/refresh` endpoint
- All responses follow standard envelope format (see API Reference doc)

### Backend -> Database

```
NestJS Service  -->  Prisma Client  -->  PostgreSQL (:5432)
```

- Prisma Client generated from schema at build time
- Connection pooling handled by Prisma (default: 10 connections)
- All queries are parameterized (SQL injection safe by default)

### Backend -> Redis

```
NestJS Service  -->  ioredis client  -->  Redis (:6379)
```

Used for:
1. **Caching** - Keyword data (30-day TTL), domain overviews (24h TTL)
2. **Job Queue** - BullMQ stores jobs in Redis
3. **Rate Limiting** - Per-user API rate limit counters
4. **WebSocket** - Socket.io adapter for multi-instance pub/sub (future)

### Backend -> External APIs

```
NestJS Service  -->  Axios HTTP  -->  DataForSEO / Google / Stripe / Claude
```

- All external API calls go through dedicated service classes
- Each service handles auth, retries, error mapping, and response parsing
- API keys stored in environment variables, never in code

### Background Jobs

```
NestJS Controller  -->  BullMQ Queue (Redis)  -->  BullMQ Worker Process
                                                         |
                                                    Processes job
                                                    Stores result in DB
                                                    Emits WebSocket event (if applicable)
```

---

## Multi-Tenancy Model

### Architecture: Shared Database, Row-Level Isolation

One database, one schema. Every table is scoped by `userId` or `projectId`.
User A can never see User B's data because every query filters by ownership.

```
User A  -->  SELECT * FROM projects WHERE user_id = 'user_a_id'   (sees only their data)
User B  -->  SELECT * FROM projects WHERE user_id = 'user_b_id'   (sees only their data)
```

### Ownership Enforcement

Every API route that accesses project data enforces ownership via middleware:

```typescript
// Simplified ownership check (runs before every project route)
async function verifyProjectOwnership(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: userId }
  });
  if (!project) throw new ForbiddenException('Access denied');
  return project;
}
```

### Data Isolation Rules

| Table | Scoped By | Enforcement |
|-------|-----------|------------|
| `users` | Self (own row) | JWT identity |
| `projects` | `userId` | Ownership guard |
| `competitors` | `projectId` | Project ownership |
| `projectKeywords` | `projectId` | Project ownership |
| `trackedKeywords` | `projectId` | Project ownership |
| `rankingHistory` | `trackedKeywordId` -> `projectId` | Nested ownership |
| `crawlJobs` | `projectId` | Project ownership |
| `crawlPages` | `crawlJobId` -> `projectId` | Nested ownership |
| `crawlIssues` | `crawlPageId` -> `crawlJobId` -> `projectId` | Nested ownership |
| `reports` | `projectId` | Project ownership |
| `keywordCache` | Global (shared) | No user data, safe to share |

### Why Shared DB (Not Schema-per-Tenant)

- **Simplicity:** One migration path, one connection pool, one backup strategy
- **Cost:** No per-tenant database overhead
- **Scale:** Handles thousands of tenants easily with proper indexing
- **Standard:** This is how Semrush, Ahrefs, HubSpot, and most SaaS platforms work

Schema-per-tenant or DB-per-tenant only makes sense for enterprise clients with contractual data isolation requirements. Not needed for Phase 1.

---

## Security Model

### Authentication

- **JWT Access Token:** 15-minute expiry, stored in memory (not localStorage)
- **JWT Refresh Token:** 30-day expiry, stored in HttpOnly cookie, rotated on each use
- **Password Hashing:** bcrypt with 12 salt rounds
- **Email Verification:** Required before full account access
- **Rate Limiting:** 5 login attempts per 15 minutes per IP

### Authorization

- **Role-Based:** `USER`, `ADMIN`, `SUPER_ADMIN`
- **Plan-Based:** Feature limits enforced per subscription tier
- **Ownership-Based:** Users can only access their own projects and data

### Data Protection

- **Encryption at Rest:** Google refresh tokens encrypted with AES-256-GCM before storage
- **Encryption in Transit:** HTTPS everywhere (TLS 1.3)
- **SQL Injection:** Prevented by Prisma parameterized queries
- **XSS:** Next.js auto-escapes by default + CSP headers
- **CSRF:** SameSite cookie flag + CORS whitelist
- **Input Validation:** class-validator on every DTO

### API Security

- **CORS:** Whitelist only frontend origins
- **Helmet:** Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- **Rate Limiting:** Per-user and per-IP via @nestjs/throttler
- **Request Size:** 10MB max body size (for log file uploads in future)
- **Stripe Webhooks:** Signature verification on every webhook

---

## Environment Configuration

### Required Environment Variables (Phase 1)

```bash
# ============================================
# APPLICATION
# ============================================
PROJECT_NAME=nr-marketting
NODE_ENV=development                    # development | production | test
API_PORT=4000
API_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000

# ============================================
# DATABASE
# ============================================
DATABASE_USER=postgres
DATABASE_PASSWORD=<strong-password>
DATABASE_NAME=seo_platform_db
DATABASE_PORT=5432
DATABASE_URL=postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@postgres:5432/${DATABASE_NAME}

# ============================================
# REDIS
# ============================================
REDIS_URL=redis://redis:6379
REDIS_PORT=6379

# ============================================
# JWT / AUTH
# ============================================
JWT_ACCESS_SECRET=<random-64-char-string>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_SECRET=<different-random-64-char-string>
JWT_REFRESH_EXPIRY=30d

# ============================================
# ENCRYPTION (for storing Google refresh tokens)
# ============================================
ENCRYPTION_KEY=<random-32-byte-hex-string>   # 64 hex characters

# ============================================
# GOOGLE OAUTH
# ============================================
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google-oauth/callback

# ============================================
# DATAFORSEO
# ============================================
DATAFORSEO_LOGIN=<your-login>
DATAFORSEO_PASSWORD=<your-password>

# ============================================
# STRIPE
# ============================================
STRIPE_SECRET_KEY=sk_test_<your-key>
STRIPE_WEBHOOK_SECRET=whsec_<your-secret>
STRIPE_PRICE_PRO_MONTHLY=price_<id>
STRIPE_PRICE_PRO_YEARLY=price_<id>
STRIPE_PRICE_AGENCY_MONTHLY=price_<id>
STRIPE_PRICE_AGENCY_YEARLY=price_<id>

# ============================================
# GITHUB OAUTH (for GitHub repo integration)
# ============================================
GITHUB_CLIENT_ID=<from-github-developer-settings>
GITHUB_CLIENT_SECRET=<from-github-developer-settings>
GITHUB_REDIRECT_URI=http://localhost:4000/api/github/callback
GITHUB_WEBHOOK_URL=http://localhost:4000/api/github/webhook

# ============================================
# CLAUDE / ANTHROPIC
# ============================================
ANTHROPIC_API_KEY=sk-ant-<your-key>

# ============================================
# EMAIL (SendGrid or SMTP)
# ============================================
SENDGRID_API_KEY=SG.<your-key>
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=SEO Platform

# ============================================
# FRONTEND (Next.js public vars)
# ============================================
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_<your-key>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same-as-above>
```

### Environment-Specific Overrides

| Variable | Development | Production |
|----------|-----------|-----------|
| `NODE_ENV` | development | production |
| `DATABASE_URL` | localhost / docker internal | managed DB URL |
| `API_URL` | http://localhost:4000 | https://api.yourdomain.com |
| `FRONTEND_URL` | http://localhost:3000 | https://app.yourdomain.com |
| `GOOGLE_REDIRECT_URI` | http://localhost:4000/... | https://api.yourdomain.com/... |
| `JWT_ACCESS_EXPIRY` | 15m | 15m |
| `STRIPE_SECRET_KEY` | sk_test_... | sk_live_... |

---

## Development Workflow

### First-Time Setup

```bash
# 1. Clone repo
git clone <repo-url>
cd nr-marketting

# 2. Copy env
cp .env.example .env
# Fill in all values

# 3. Install dependencies
pnpm install

# 4. Start infrastructure (Postgres + Redis)
docker compose -f docker-compose.local.yml up -d

# 5. Run database migrations
pnpm db:migrate

# 6. Generate Prisma client
pnpm db:generate

# 7. Start all services in dev mode
pnpm dev
```

### Daily Development

```bash
# Start infra if not running
docker compose -f docker-compose.local.yml up -d

# Start all services with hot reload
pnpm dev

# This starts:
#   - NestJS API on :4000 (hot reload)
#   - Tenant Dashboard on :3000 (hot reload)
#   - Super Admin on :3001 (hot reload)
#   - Customer Website on :3002 (hot reload)
```

### Common Commands

```bash
pnpm dev              # Start all services
pnpm build            # Build all packages and apps
pnpm lint             # Lint all packages and apps
pnpm type-check       # TypeScript check all packages and apps

pnpm db:migrate       # Create + run new migration
pnpm db:generate      # Regenerate Prisma client after schema change
pnpm db:studio        # Open Prisma Studio (DB GUI) on :5555

# Run tests for specific app
cd apps/backend/api && pnpm test
cd apps/backend/api && pnpm test:e2e
```

### Git Workflow

```
main
  |-- develop
        |-- feature/auth-module
        |-- feature/keyword-research
        |-- feature/site-audit
        |-- fix/crawl-dedup-bug
```

- `main` — production-ready code, deploy on merge
- `develop` — integration branch, all features merge here first
- `feature/*` — one branch per module/feature
- `fix/*` — bug fix branches
- PRs require passing CI (lint + type-check + tests) before merge

---

## What Success Looks Like (Phase 1 Exit Criteria)

- [ ] User can register, verify email, log in, manage profile
- [ ] User can subscribe to Free / Pro / Agency via Stripe
- [ ] User can create a project with a domain (manual, WordPress, or GitHub)
- [ ] User can connect Google Analytics and Search Console via OAuth
- [ ] User can connect a WordPress site (Application Password or plugin)
- [ ] User can connect a GitHub repo via OAuth and select repository
- [ ] User can auto-fix SEO issues via WordPress API (update meta, alt tags)
- [ ] User can create PRs to fix SEO issues via GitHub
- [ ] Auto re-crawl triggers on GitHub deploy (webhook)
- [ ] User can search keywords and see volume, difficulty, CPC
- [ ] User can see keyword suggestions (magic tool)
- [ ] User can see domain overview (traffic, keywords, backlinks summary)
- [ ] User can track keyword rankings over time (from GSC)
- [ ] User can see organic traffic insights (GA + GSC merged)
- [ ] User can run a site audit crawl and see issues with health score
- [ ] User can see real-time crawl progress via WebSocket
- [ ] User can ask AI assistant for SEO recommendations
- [ ] User can get topic/content ideas from AI
- [ ] User can generate a basic PDF report
- [ ] Plan limits are enforced (keywords, pages, AI credits)
- [ ] Super admin can manage users and view platform stats
- [ ] All API endpoints return consistent response format
- [ ] Background jobs run reliably (GSC sync, crawl queue)
- [ ] Error handling and logging are in place
