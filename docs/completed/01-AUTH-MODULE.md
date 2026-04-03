 # Module 1 — Authentication & User Management

> **Status:** ✅ Complete
> **Completed:** 2026-04-01
> **Scope:** Backend (NestJS) + Frontend (Next.js) + Shared API Client

---

## Overview

Full JWT-based authentication system with email/password registration, token rotation, role-based access control, and a polished dark/light themed UI.

---

## What Was Built

### Backend (NestJS API)

**Auth Endpoints — 9 routes under `/api/auth/`**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | Public | Create account, hash password (bcrypt 12 rounds), create FREE subscription + usage records |
| `POST` | `/api/auth/login` | Public | Validate credentials, return JWT access token (15m) + refresh token cookie (30d) |
| `POST` | `/api/auth/refresh` | Cookie | Token rotation — invalidate old refresh token, issue new pair |
| `POST` | `/api/auth/logout` | JWT | Delete refresh token from DB, clear cookie |
| `GET` | `/api/auth/verify-email?token=` | Public | Verify email, redirect to frontend login |
| `POST` | `/api/auth/resend-verification` | Public | Generate new verification token (doesn't reveal if email exists) |
| `POST` | `/api/auth/forgot-password` | Public | Send reset link (doesn't reveal if email exists) |
| `POST` | `/api/auth/reset-password` | Public | Validate reset token, update password, invalidate all sessions |
| `GET` | `/api/auth/me` | JWT | Return current user profile with plan info |

**Security Implementation:**
- Passwords hashed with **bcrypt (12 rounds)**
- Refresh tokens stored as **SHA-256 hashes** (raw tokens never stored)
- Access tokens: **15 minute TTL**, signed with JWT_SECRET
- Refresh tokens: **30 day TTL**, HttpOnly + Secure + SameSite=Strict cookie
- **Token rotation** on every refresh (old token invalidated)
- Password reset tokens **hashed before storage**, expire in 1 hour
- Forgot password **never reveals** whether email exists
- **Rate limiting** via `@nestjs/throttler` (100 req/min global, 5 req/15min on auth)

**Guards & Decorators:**
- `JwtAuthGuard` — Protects routes requiring authentication
- `RolesGuard` — Checks `@Roles()` decorator against user role (USER, ADMIN, SUPER_ADMIN)
- `@CurrentUser()` — Param decorator to extract user from request
- `@Roles()` — Metadata decorator for role-based access

---

### Frontend (Tenant Dashboard)

**Pages — 6 routes**

| Route | File | Description |
|-------|------|-------------|
| `/` | `pages/index.tsx` | Auto-redirect to `/dashboard` (authenticated) or `/login` (unauthenticated) |
| `/login` | `pages/login.tsx` | Email + password form, "forgot password" link, email verified banner |
| `/register` | `pages/register.tsx` | Name + email + password + confirm password with client-side validation |
| `/forgot-password` | `pages/forgot-password.tsx` | Email-only form, success message on submit |
| `/reset-password` | `pages/reset-password.tsx` | Token from URL query + new password with confirm |
| `/dashboard` | `pages/dashboard/index.tsx` | Protected page — top nav, stats grid, empty project state |

**Design System:**
- **Dark theme** (default) + **Light theme** with CSS custom properties
- Indigo accent (`#6366f1` light / `#818cf8` dark)
- Inter font family, smooth transitions, consistent border radius/shadows
- No FOUC — theme applied via inline script before React hydrates
- Responsive: split-screen auth layout on desktop (brand panel + form), form-only on mobile

**UI Components:**

| Component | Description |
|-----------|-------------|
| `AuthLayout` | Split-screen layout — gradient brand panel (left) with features list + form panel (right) |
| `AuthGuard` | HOC that redirects unauthenticated users to `/login` |
| `InputField` | Styled input with label, error state, password show/hide toggle |
| `ThemeToggle` | Dark/light mode button with localStorage persistence |
| `Toast` / `ToastContainer` | Notification system wired into shared-frontend's `setGlobalToast` |
| `AuthContext` | React context providing `user`, `login`, `register`, `logout`, `forgotPassword`, `resetPassword` |

---

### Shared Package Updates

**`packages/shared-frontend/src/api/apiClient.ts`:**
- Base URL updated to `http://localhost:3000/api`
- Refresh endpoint changed from `/auth/refresh-token` to `/auth/refresh`
- Response shape aligned to `{ success: true, data: { accessToken } }`

---

## File Inventory

### Backend — `apps/backend/api/src/`

```
prisma/
  prisma.module.ts          — Global module exporting PrismaService
  prisma.service.ts          — NestJS-wrapped PrismaClient with lifecycle hooks

auth/
  auth.module.ts             — Wires JWT + Passport + service + strategy
  auth.controller.ts         — 9 endpoints, cookie handling, redirects
  auth.service.ts            — All business logic (register, login, refresh, logout, verify, reset)
  dto/
    index.ts                 — Barrel export
    register.dto.ts          — email + password (strength rules) + optional name
    login.dto.ts             — email + password
    forgot-password.dto.ts   — email only
    reset-password.dto.ts    — token + newPassword
  interfaces/
    jwt-payload.interface.ts — JWT token payload shape
  strategies/
    jwt.strategy.ts          — Passport JWT strategy, validates user from DB
  guards/
    jwt-auth.guard.ts        — Protects routes requiring auth
    roles.guard.ts           — RBAC check against @Roles() decorator
  decorators/
    roles.decorator.ts       — @Roles() metadata decorator
    current-user.decorator.ts — @CurrentUser() param decorator
```

### Frontend — `apps/frontend/tenent-dashboard/`

```
context/
  AuthContext.tsx             — Global auth state + API methods

components/
  auth/
    AuthLayout.tsx            — Split-screen auth page layout
    AuthLayout.module.css     — Styles for auth layout
    AuthGuard.tsx             — Route protection wrapper
  ui/
    InputField.tsx            — Form input component
    InputField.module.css     — Input styles
    ThemeToggle.tsx           — Dark/light mode switcher
    ThemeToggle.module.css    — Toggle button styles
    Toast.tsx                 — Toast notification system
    Toast.module.css          — Toast styles

pages/
  _app.tsx                    — QueryClient + AuthProvider + Toast wiring
  _document.tsx               — HTML shell with Inter font + theme script
  index.tsx                   — Root redirect
  login.tsx                   — Login page
  register.tsx                — Registration page
  forgot-password.tsx         — Forgot password page
  reset-password.tsx          — Reset password page
  dashboard/
    index.tsx                 — Protected dashboard page
    index.module.css          — Dashboard styles

styles/
  globals.css                 — Design system: CSS variables, dark/light themes, base styles
```

### Config Files Modified

```
apps/backend/api/
  package.json                — Added auth deps (bcryptjs, @nestjs/jwt, passport, etc.)
  .env                        — Added JWT_SECRET, FRONTEND_URL, NODE_ENV
  .env.example                — Updated with all auth config vars
  src/app.module.ts           — Imported PrismaModule, AuthModule, ThrottlerModule
  src/main.ts                 — Added cookie-parser, global prefix /api, CORS

apps/frontend/tenent-dashboard/
  .env.local                  — Updated API URL to include /api prefix
  .env.local.example          — Same

packages/shared-frontend/src/api/
  apiClient.ts                — Base URL, refresh endpoint, response shape

packages/database/prisma/
  schema.prisma               — Removed custom output path for pnpm compatibility
```

---

## Dependencies Added

### Backend (`apps/backend/api`)

| Package | Purpose |
|---------|---------|
| `@nestjs/jwt` | JWT token signing/verification |
| `@nestjs/passport` | Passport integration for NestJS |
| `@nestjs/throttler` | Rate limiting |
| `@prisma/client` | Database ORM client |
| `bcryptjs` | Password hashing |
| `cookie-parser` | Parse refresh token cookies |
| `passport` | Authentication framework |
| `passport-jwt` | JWT strategy for Passport |
| `@types/bcryptjs` | TypeScript types |
| `@types/cookie-parser` | TypeScript types |
| `@types/passport-jwt` | TypeScript types |

---

## Known Limitations / TODOs

- [ ] **Email service not integrated** — verification and password reset emails are not sent; users must be manually verified via Prisma Studio
- [ ] **Stripe customer ID** — registration creates a placeholder `temp_*` ID; needs real Stripe integration (Billing module)
- [ ] **Rate limiting** — configured but not Redis-backed yet (in-memory only); will need Redis store for distributed deployments
- [ ] **PlanLimitGuard** — not yet implemented; will be added in the Billing/Projects module
- [ ] **ProjectOwnerGuard** — not yet implemented; will be added in the Projects module

---

## How to Test

1. Start Docker containers: `docker compose -f docker-compose.local.yml up -d`
2. Generate Prisma: `cd packages/database && pnpm prisma generate`
3. Run migration: `pnpm prisma migrate dev --name init`
4. Start backend: `cd apps/backend/api && pnpm dev` (port 3000)
5. Start frontend: `cd apps/frontend/tenent-dashboard && pnpm dev` (port 3001)
6. Open `http://localhost:3001` → redirects to login
7. Register → manually verify email in Prisma Studio (`pnpm prisma studio`)
8. Login → redirected to dashboard
