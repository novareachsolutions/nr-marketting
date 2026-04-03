# Module 4 — Google OAuth & Integrations

> **Status:** ✅ Complete
> **Completed:** 2026-04-01
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Google OAuth 2.0 integration for connecting Google Search Console and Google Analytics 4 accounts. Users authorize via Google consent screen, tokens are encrypted at rest with AES-256-GCM, and access tokens auto-refresh when expired.

---

## What Was Built

### Backend — 7 API endpoints under `/api/google-oauth/`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/google-oauth/authorize` | JWT (query) | Redirect to Google OAuth consent screen |
| `GET` | `/google-oauth/callback` | Public | Handle Google callback, exchange code for tokens, redirect to frontend |
| `GET` | `/google-oauth/status` | JWT | Check if Google is connected, return property IDs |
| `POST` | `/google-oauth/select-properties` | JWT | Set selected GA property + GSC site URL |
| `GET` | `/google-oauth/search-console-sites` | JWT | List verified Search Console sites |
| `GET` | `/google-oauth/analytics-properties` | JWT | List GA4 properties from all accounts |
| `DELETE` | `/google-oauth/disconnect` | JWT | Revoke token at Google, delete connection |

### Security
- **AES-256-GCM encryption** for refresh tokens at rest
- Encryption utility at `src/common/utils/encryption.ts`
- Auto-refresh expired access tokens before API calls
- CSRF protection via state parameter in OAuth flow

### Frontend — Settings/Integrations page

| Route | Description |
|-------|-------------|
| `/settings/integrations` | Google connection status, connect/disconnect buttons, GA property + GSC site dropdowns |

---

## File Inventory

```
Backend:
  src/common/utils/encryption.ts              — AES-256-GCM encrypt/decrypt
  src/google-oauth/google-oauth.service.ts     — OAuth flow, token management, API calls
  src/google-oauth/google-oauth.controller.ts  — 7 endpoints
  src/google-oauth/google-oauth.module.ts      — Module wiring

Frontend:
  pages/settings/integrations.tsx              — Integrations settings page
  pages/settings/integrations.module.css       — Styles
```

### Environment Variables
```
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google-oauth/callback"
ENCRYPTION_KEY=""  # 64 hex chars (32 bytes) for AES-256
```

---

## Known Limitations
- [ ] Google API calls use axios directly (no Google SDK) — works but verbose
- [ ] CSRF state uses userId directly — should use random token stored in Redis for production
- [ ] App needs Google Cloud Console verification for production use (unverified works for testing)
