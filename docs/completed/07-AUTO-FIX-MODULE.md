# Module 7 — GitHub Integration, WordPress Integration & AI Auto-Fix

> **Status:** ✅ Complete
> **Completed:** 2026-04-02
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Three interconnected systems that enable automatic SEO issue fixing:
1. **GitHub Integration** — OAuth connect, repo access, create PRs with AI-generated fixes
2. **WordPress Integration** — Credential-based connect, direct page updates via WP REST API
3. **AI Auto-Fix** — GPT-4o-mini generates fixes for 9 issue types, applies via GitHub PR or WordPress API

---

## How Auto-Fix Works

```
Site Audit finds issue
    ↓
User clicks "🤖 Auto-Fix" on the issue
    ↓
Backend checks project sourceType:
    ├── WORDPRESS → AI generates fix → WP REST API applies it → Done (instant)
    ├── GITHUB → AI generates fix → Creates branch + commit + PR → User merges
    └── MANUAL → Returns suggestion only (can't auto-fix)
```

### Fixable Issue Types (9)

| Issue | What AI Generates |
|-------|------------------|
| MISSING_TITLE | SEO-optimized title from page content |
| TITLE_TOO_LONG / TOO_SHORT | Rewritten title at correct length |
| MISSING_META_DESCRIPTION | Meta description from page content |
| META_DESCRIPTION_TOO_LONG / TOO_SHORT | Rewritten at 120-160 chars |
| MISSING_H1 | H1 heading from page topic |
| IMAGE_MISSING_ALT | Alt text descriptions for images |
| LOW_WORD_COUNT | Additional relevant content |

---

## Backend API Endpoints

### GitHub (6 endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/github/authorize` | JWT | Redirect to GitHub OAuth |
| `GET` | `/api/github/callback` | Public | Handle OAuth callback |
| `GET` | `/api/projects/:id/github/repos` | JWT+Owner | List user's repos |
| `POST` | `/api/projects/:id/github/connect` | JWT+Owner | Connect repo to project |
| `GET` | `/api/projects/:id/github/status` | JWT+Owner | Connection status |
| `DELETE` | `/api/projects/:id/github/disconnect` | JWT+Owner | Disconnect |

### WordPress (4 endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/projects/:id/wordpress/connect` | JWT+Owner | Verify + store encrypted credentials |
| `GET` | `/api/projects/:id/wordpress/status` | JWT+Owner | Connection status + WP version + SEO plugin |
| `POST` | `/api/projects/:id/wordpress/verify` | JWT+Owner | Re-verify credentials |
| `DELETE` | `/api/projects/:id/wordpress/disconnect` | JWT+Owner | Disconnect |

### Auto-Fix (2 endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/projects/:id/fix-issue/:issueId` | JWT+Owner | Apply AI fix (WordPress direct or GitHub PR) |
| `GET` | `/api/projects/:id/fix-issue/:issueId/preview` | JWT+Owner | Preview fix without applying |

---

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/dashboard/projects/[id]/settings` | WordPress + GitHub connection management |
| `/dashboard/projects/[id]/audits/[crawlId]` | Updated — "🤖 Auto-Fix" button on fixable issues, shows PR link or fix status |

### Sidebar Updated
- Added **Settings** link (⚙️) to project navigation

---

## File Inventory

### Backend
```
src/github/
  github.service.ts          — OAuth flow, repo CRUD, file read, PR creation
  github.controller.ts       — 6 endpoints
  github.module.ts

src/wordpress/
  wordpress.service.ts       — Connect/verify, page lookup, meta updates (Yoast/RankMath)
  wordpress.controller.ts    — 4 endpoints
  wordpress.module.ts
  dto/connect-wordpress.dto.ts

src/auto-fix/
  auto-fix.service.ts        — AI fix generation, dispatch to WP or GitHub
  auto-fix.controller.ts     — 2 endpoints (fix + preview)
  auto-fix.module.ts
```

### Frontend
```
pages/dashboard/projects/[id]/
  settings.tsx               — WordPress + GitHub connection UI
  settings.module.css
  audits/[crawlId].tsx       — Updated with Auto-Fix buttons

components/layout/
  Sidebar.tsx                — Added Settings link
```

---

## Environment Variables

```
# GitHub OAuth
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GITHUB_REDIRECT_URI="http://localhost:3000/api/github/callback"

# Already exists
OPENAI_API_KEY="..."         — Used for AI fix generation
ENCRYPTION_KEY="..."         — Used for encrypting GitHub tokens + WP credentials
```

---

## Security

- GitHub access tokens **encrypted with AES-256-GCM** at rest
- WordPress username + app password **encrypted with AES-256-GCM** at rest
- GitHub OAuth uses state parameter for CSRF protection
- WordPress credentials verified before storage
- All fix operations check project ownership via ProjectOwnerGuard

---

## How to Test

### WordPress Auto-Fix
1. Create a project with a WordPress domain
2. Go to project → Settings → connect WordPress (need app password)
3. Run a Site Audit
4. Click "🤖 Auto-Fix" on an issue → fix applied instantly

### GitHub Auto-Fix
1. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`
2. Go to project → Settings → Connect GitHub → authorize → select repo
3. Run a Site Audit
4. Click "🤖 Auto-Fix" → creates a PR with the fix

### Manual Projects
- Auto-Fix button still appears but returns "suggestion only" for MANUAL source type projects
