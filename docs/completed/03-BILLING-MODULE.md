# Module 3 — Billing & Subscriptions

> **Status:** ✅ Complete
> **Completed:** 2026-04-01
> **Scope:** Backend (NestJS + Stripe) + Frontend (Next.js)

---

## Overview

Stripe-powered billing system with 3 plans (Free, Pro, Agency), monthly/yearly billing cycles, Stripe Checkout for upgrades, Customer Portal for self-service management, and webhook-driven subscription lifecycle handling.

---

## What Was Built

### Backend (NestJS API)

**Billing Endpoints — 5 routes under `/api/billing/`**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/billing/create-checkout-session` | JWT | Create Stripe Checkout session for plan upgrade |
| `POST` | `/api/billing/create-portal-session` | JWT | Create Stripe Customer Portal session for self-service |
| `GET` | `/api/billing/subscription` | JWT | Get current subscription details (plan, status, period) |
| `GET` | `/api/billing/usage` | JWT | Get usage vs plan limits for current billing period |
| `POST` | `/api/billing/webhook` | Stripe signature | Handle Stripe webhook events (no JWT, verified by signature) |

**Stripe Integration:**

- **Stripe Customer** created on user registration (real Stripe API call, falls back to temp ID if Stripe not configured)
- **Checkout Sessions** created with user's Stripe customer ID, plan price ID, and userId in metadata
- **Customer Portal** for self-service subscription management (change plan, update card, cancel, view invoices)
- **Raw body parsing** enabled in NestJS for webhook signature verification

**Webhook Events Handled:**

| Stripe Event | Action |
|-------------|--------|
| `checkout.session.completed` | Activate subscription: set plan, status=ACTIVE, period dates, update usage limits |
| `invoice.paid` | Extend subscription period, reset monthly usage counters to 0 |
| `invoice.payment_failed` | Set status=PAST_DUE (email notification TODO) |
| `customer.subscription.updated` | Update plan, billing cycle, period dates, cancelAtPeriodEnd flag |
| `customer.subscription.deleted` | Downgrade to FREE, status=CANCELLED, clear Stripe subscription ID, reduce limits |

**Usage Tracking:**

- Usage records tracked per user, per metric, per month (period format: "2026-04")
- 4 metrics: KEYWORDS_TRACKED, PAGES_CRAWLED, AI_CREDITS, REPORTS_GENERATED
- Limits auto-updated when plan changes via webhook
- Counters reset to 0 when `invoice.paid` fires (new billing period)
- `-1` stored as `999999` in DB to represent unlimited

**Plan Pricing:**

| Plan | Monthly | Yearly (per month) | Yearly (total) |
|------|---------|-------------------|----------------|
| Free | $0 | $0 | $0 |
| Pro | $49/mo | $39/mo | $468/yr |
| Agency | $199/mo | $159/mo | $1,908/yr |

**Price ID Mapping (via env vars):**

```
STRIPE_PRICE_PRO_MONTHLY     → PRO plan, monthly billing
STRIPE_PRICE_PRO_YEARLY      → PRO plan, yearly billing
STRIPE_PRICE_AGENCY_MONTHLY  → AGENCY plan, monthly billing
STRIPE_PRICE_AGENCY_YEARLY   → AGENCY plan, yearly billing
```

---

### Frontend (Tenant Dashboard)

**Pages:**

| Route | Description |
|-------|-------------|
| `/billing` | Pricing page — 3 plan cards, monthly/yearly toggle with "Save 20%" badge, upgrade buttons, manage portal link |
| `/billing/success` | Post-checkout success page with dashboard redirect |
| `/billing/cancelled` | Checkout cancelled page with "View Plans" and "Dashboard" links |

**Design:**
- Plan cards with feature lists, pricing, and CTA buttons
- "Most Popular" badge on Pro plan
- Monthly/yearly toggle with smooth transition
- Current plan highlighted with green "Current Plan" badge
- "Open Billing Portal" button for paid users to self-manage
- Dashboard nav: plan badge is now a clickable link to `/billing`

---

## File Inventory

### Backend — `apps/backend/api/src/`

```
billing/
  billing.module.ts            — Module definition, exports BillingService
  billing.controller.ts        — 5 endpoints (checkout, portal, subscription, usage, webhook)
  billing.service.ts           — Stripe integration, webhook handlers, usage tracking
  dto/
    index.ts                   — Barrel export
    create-checkout.dto.ts     — plan (PRO|AGENCY) + billingCycle (MONTHLY|YEARLY)
```

### Frontend — `apps/frontend/tenent-dashboard/pages/`

```
billing/
  index.tsx                    — Pricing page with plans grid
  index.module.css             — Pricing page styles
  success.tsx                  — Post-checkout success page
  cancelled.tsx                — Checkout cancelled page
```

### Modified Files

```
Backend:
  src/app.module.ts            — Added BillingModule to imports
  src/main.ts                  — Enabled rawBody: true for webhook signature verification
  src/auth/auth.module.ts      — Added BillingModule import (forwardRef) for Stripe customer creation
  src/auth/auth.service.ts     — Register now creates real Stripe customer via BillingService
  .env                         — Added Stripe config vars
  .env.example                 — Added Stripe config template
  package.json                 — Added stripe dependency

Frontend:
  pages/dashboard/index.tsx    — Plan badge now links to /billing page
```

---

## Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `stripe` | ^14.14.0 | Stripe Node.js SDK for checkout, portal, webhooks |

---

## Environment Variables Required

```bash
# Stripe (get from https://dashboard.stripe.com)
STRIPE_SECRET_KEY="sk_test_..."           # API secret key
STRIPE_WEBHOOK_SECRET="whsec_..."         # Webhook signing secret
STRIPE_PRICE_PRO_MONTHLY="price_..."      # Pro monthly price ID
STRIPE_PRICE_PRO_YEARLY="price_..."       # Pro yearly price ID
STRIPE_PRICE_AGENCY_MONTHLY="price_..."   # Agency monthly price ID
STRIPE_PRICE_AGENCY_YEARLY="price_..."    # Agency yearly price ID
```

---

## Stripe Setup Instructions

1. Create a [Stripe account](https://dashboard.stripe.com)
2. Create 2 Products: **Pro** and **Agency**
3. Add 2 Prices per product: monthly + yearly
4. Copy the 4 price IDs into `.env`
5. Copy the API secret key into `STRIPE_SECRET_KEY`
6. For local webhook testing, install [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```
7. Copy the webhook secret from CLI output into `STRIPE_WEBHOOK_SECRET`
8. Enable Customer Portal in Stripe Dashboard → Settings → Customer Portal

---

## Known Limitations / TODOs

- [ ] **Email notifications** — payment failed and cancellation emails not sent yet (email service not integrated)
- [ ] **Grace period enforcement** — PAST_DUE accounts should auto-downgrade to FREE after 7 days (needs cron job)
- [ ] **Webhook idempotency** — event IDs not logged for duplicate detection yet
- [ ] **Settings/billing page** — no dedicated `/settings/billing` page showing subscription details (portal link exists on pricing page)
- [ ] **Usage display** — `/billing/usage` endpoint exists but no frontend UI for viewing usage meters yet
- [ ] **Trial support** — TRIALING status exists in schema but trial flow not implemented
- [ ] **Without Stripe keys** — app works on FREE plan; upgrade buttons show error; registration falls back to temp customer ID

---

## How to Test

### Without Stripe (basic flow)
1. Open `http://localhost:3001/billing` — see pricing page with 3 plans
2. Current plan (FREE) shows green "Current Plan" badge
3. Monthly/yearly toggle works with price updates
4. Clicking upgrade shows error (Stripe not configured) — expected

### With Stripe (full flow)
1. Set up Stripe env vars as described above
2. Start Stripe CLI: `stripe listen --forward-to localhost:3000/api/billing/webhook`
3. Register a new user — Stripe customer created automatically
4. Go to `/billing` → click "Upgrade to Pro"
5. Complete checkout with test card `4242 4242 4242 4242`
6. Redirected to `/billing/success`
7. Dashboard plan badge updates to "PRO"
8. Go to `/billing` → click "Open Billing Portal" to manage subscription
