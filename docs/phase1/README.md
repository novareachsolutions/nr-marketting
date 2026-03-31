# Phase 1 MVP Documentation

> **SEO Platform — Complete Implementation Guide**
> **Timeline:** Months 1-3
> **Goal:** Working SaaS product that real users can pay for
> **Core:** Keyword Research + Rank Tracking + Site Audit = 80% of value

---

## Documents

| # | Document | What It Covers |
|---|----------|---------------|
| 01 | [Overview & Architecture](01-OVERVIEW-AND-ARCHITECTURE.md) | Tech stack, monorepo structure, system diagram, multi-tenancy, security model, environment config, dev workflow |
| 02 | [Database Schema](02-DATABASE-SCHEMA.md) | All 18 tables, full Prisma schema, enums, indexes, caching strategy, migrations, seed data, data volume estimates |
| 03 | [Auth & Billing](03-AUTH-AND-BILLING.md) | JWT auth flow, registration, login, token rotation, email verification, password reset, Stripe integration, plan limits, usage tracking, webhook handling |
| 04 | [Google OAuth, GitHub OAuth & Integrations](04-GOOGLE-OAUTH-AND-INTEGRATIONS.md) | Google OAuth 2.0 flow, GitHub OAuth flow, WordPress REST API connection, token encryption, GSC/GA4 API usage, webhook setup, deploy detection |
| 05 | [Core Modules](05-CORE-MODULES.md) | Project/Workspace (with WordPress + GitHub integrations, auto-fix, PR creation), Domain Overview, Keyword Research, Rank Tracking, Organic Traffic Insights, Site Audit |
| 06 | [AI & Content](06-AI-AND-CONTENT.md) | AI Copilot/Assistant, Topic Research, Claude API integration, prompt engineering, streaming, cost management |
| 07 | [Reports & Alerts](07-REPORTS-AND-ALERTS.md) | PDF report structure, Puppeteer pipeline, Handlebars templates, alert types, alert processing, email templates |
| 08 | [API Reference](08-API-REFERENCE.md) | All endpoints, standard response format, error codes, pagination, query parameters, WebSocket events, rate limits |
| 09 | [Background Jobs](09-BACKGROUND-JOBS.md) | BullMQ queues, all job definitions, cron schedule, retry strategies, staggering, error handling, monitoring |
| 10 | [Frontend Architecture](10-FRONTEND-ARCHITECTURE.md) | Route structure (all 3 apps), layout system, auth flow, data fetching with React Query, page specifications, component library, charts |
| 11 | [Infrastructure & DevOps](11-INFRASTRUCTURE-AND-DEVOPS.md) | Server requirements, Docker production setup, Nginx config, SSL, CI/CD pipeline, deployment, backups, monitoring, security hardening, scaling strategy, cost estimates |

---

## Quick Reference

### Phase 1 Modules

| Module | Data Source | Cost |
|--------|------------|------|
| Auth & Billing | Own DB + Stripe | Stripe fees only |
| Project/Workspace | Own DB | Free |
| Google OAuth (GA + GSC) | Google APIs | Free |
| WordPress Integration | WordPress REST API | Free |
| GitHub Integration | GitHub API + OAuth | Free |
| Domain Overview | DataForSEO | Pay-per-use |
| Keyword Research (Overview + Magic Tool) | DataForSEO | Pay-per-use |
| Rank Tracking | GSC API | Free |
| Organic Traffic Insights | GSC + GA merged | Free |
| Site Audit (Crawler) | Self-built, no API | Free |
| AI Copilot + Topic Research | Claude API | ~$20-50/mo |
| PDF Reports | Puppeteer (self-built) | Free |
| Alerts | Own DB + SendGrid | Free tier |

### Tech Stack Summary

```
Backend:    NestJS 10 + Prisma 5 + PostgreSQL 15 + Redis 7 + BullMQ
Frontend:   Next.js 14 + Tailwind CSS + shadcn/ui + TanStack Query
AI:         Claude API (Haiku + Sonnet)
Data:       DataForSEO + Google GSC/GA APIs
Integrations: WordPress REST API + GitHub API/OAuth
Billing:    Stripe
Email:      SendGrid
Infra:      Docker + Nginx + GitHub Actions
```

### Monthly Costs (MVP)

```
Infrastructure:  ~$16 (Hetzner VPS)
DataForSEO:      ~$10-50
Claude API:      ~$20-50
Total:           ~$47-117/month
Break-even:      3 Pro subscribers ($49/mo each)
```

---

## Implementation Order

Recommended build sequence within Phase 1:

```
Week 1-2:  Database schema + Auth + Project CRUD
Week 3:    Google OAuth + GitHub OAuth + Billing (Stripe)
Week 4:    WordPress Integration + GitHub Integration (connect, auto-fix, PR creation)
Week 5-6:  Keyword Research (DataForSEO integration)
Week 6-7:  Rank Tracking (GSC sync + history charts)
Week 7-8:  Site Audit (crawler + WebSocket progress + WP/GitHub auto-fix buttons)
Week 9:    Domain Overview + Traffic Insights
Week 10:   AI Assistant + Topic Research
Week 11:   Reports (PDF generation) + Alerts
Week 12:   Testing, bug fixes, deployment, launch
```

---

## Exit Criteria (Phase 1 Complete When)

- [ ] User can register, verify email, log in
- [ ] User can subscribe to Free / Pro / Agency
- [ ] User can create projects (manual domain, WordPress, or GitHub)
- [ ] User can connect Google Analytics + Search Console
- [ ] User can connect WordPress site (auto-fix issues, publish content)
- [ ] User can connect GitHub repo (auto-PR fixes, deploy re-crawl)
- [ ] User can search keywords (volume, difficulty, CPC)
- [ ] User can get keyword suggestions
- [ ] User can see domain overview for any domain
- [ ] User can track keyword rankings over time
- [ ] User can see organic traffic insights (GA + GSC)
- [ ] User can run site audit and see health score + issues
- [ ] User can see real-time crawl progress
- [ ] User can chat with AI assistant
- [ ] User can generate topic ideas
- [ ] User can generate PDF reports
- [ ] User receives email alerts on ranking drops / site down
- [ ] Plan limits are enforced correctly
- [ ] All APIs return consistent response format
- [ ] Background jobs run reliably
- [ ] Deployed and accessible on production domain
