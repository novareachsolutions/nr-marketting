# Phase 1 - Authentication & Billing

> **Auth:** JWT (access + refresh tokens) with email verification
> **Billing:** Stripe Checkout + Customer Portal + Webhooks
> **Plans:** Free, Pro ($49/mo), Agency ($199/mo)

---

## Table of Contents

- [Authentication System](#authentication-system)
- [Registration Flow](#registration-flow)
- [Login Flow](#login-flow)
- [Token Management](#token-management)
- [Email Verification](#email-verification)
- [Password Reset](#password-reset)
- [Role-Based Access Control](#role-based-access-control)
- [Rate Limiting](#rate-limiting)
- [Billing System](#billing-system)
- [Subscription Plans](#subscription-plans)
- [Plan Limits](#plan-limits)
- [Stripe Integration](#stripe-integration)
- [Webhook Handling](#webhook-handling)
- [Usage Tracking](#usage-tracking)
- [Auth API Endpoints](#auth-api-endpoints)
- [Billing API Endpoints](#billing-api-endpoints)

---

## Authentication System

### Architecture Overview

```
Client (Browser)
    |
    |--- POST /api/auth/login { email, password }
    |
    v
NestJS AuthController
    |
    |--- Validate credentials (bcrypt compare)
    |--- Generate JWT access token (15 min TTL)
    |--- Generate refresh token (30 day TTL)
    |--- Store refresh token hash in DB
    |--- Set refresh token as HttpOnly cookie
    |
    v
Response:
    Body:    { accessToken, user }
    Cookie:  refreshToken (HttpOnly, Secure, SameSite=Strict)
```

### Why This Token Strategy

| Decision | Reason |
|----------|--------|
| Access token in response body, stored in memory | XSS can't steal it from memory; page refresh requires re-auth via refresh token |
| Refresh token in HttpOnly cookie | JavaScript can't read it; only sent automatically to `/api/auth/refresh` |
| Short access token (15 min) | Limits damage window if token is leaked |
| Long refresh token (30 days) | Good UX — users don't re-login constantly |
| Token rotation on refresh | Old refresh token invalidated; if stolen token is used after rotation, both are invalidated |
| Refresh token hash stored (not raw) | If DB is breached, attacker can't forge tokens |

---

## Registration Flow

```
Step 1: User submits registration form
        POST /api/auth/register { email, password, name }

Step 2: Backend validates:
        - Email format valid
        - Email not already registered
        - Password meets requirements (min 8 chars, 1 uppercase, 1 number)

Step 3: Backend creates:
        - User record (isEmailVerified: false)
        - Subscription record (plan: FREE, stripeCustomerId from Stripe)
        - UsageRecords for current month (initialized to 0)
        - Random emailVerifyToken (64-char hex string)

Step 4: Backend sends verification email:
        To: user@example.com
        Subject: "Verify your email address"
        Body: "Click here to verify: {FRONTEND_URL}/verify-email?token={token}"

Step 5: Response:
        { success: true, message: "Check your email to verify your account" }

Step 6: User clicks link in email
        GET /api/auth/verify-email?token={token}

Step 7: Backend:
        - Finds user by emailVerifyToken
        - Sets isEmailVerified = true
        - Clears emailVerifyToken
        - Redirects to frontend login page with success message
```

### Password Requirements

```
Minimum 8 characters
At least 1 uppercase letter
At least 1 lowercase letter
At least 1 number
Maximum 128 characters
```

### Password Hashing

```
Algorithm: bcrypt
Salt rounds: 12
Library: bcryptjs (pure JS, no native deps, works everywhere)

Hash:    bcrypt.hash(password, 12) -> stored in DB
Compare: bcrypt.compare(inputPassword, storedHash) -> true/false
```

---

## Login Flow

```
Step 1: User submits login form
        POST /api/auth/login { email, password }

Step 2: Backend validates:
        - User exists with this email
        - Password matches hash (bcrypt compare)
        - Email is verified (if not, return error with "verify email first" message)

Step 3: Backend generates tokens:
        - accessToken:  JWT { sub: userId, role: role, plan: plan }, expires 15 min
        - refreshToken: Random 64-byte hex string, expires 30 days

Step 4: Backend stores refresh token:
        - SHA-256 hash the raw refresh token
        - Store hash in refresh_tokens table with userId, expiry, user-agent, IP
        - Delete any expired tokens for this user (cleanup)

Step 5: Response:
        Body:    { accessToken, user: { id, email, name, role, plan } }
        Cookie:  Set-Cookie: refreshToken={raw_token}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=2592000
```

### Access Token Payload (JWT)

```json
{
  "sub": "clxyz123abc",        // userId
  "email": "user@example.com",
  "role": "USER",
  "plan": "PRO",
  "iat": 1711900000,           // issued at
  "exp": 1711900900            // expires (15 min later)
}
```

### Token Refresh Flow

```
Step 1: Frontend detects 401 response (access token expired)

Step 2: Frontend calls POST /api/auth/refresh
        (refresh token sent automatically via cookie)

Step 3: Backend validates:
        - Cookie contains refresh token
        - SHA-256(token) exists in refresh_tokens table
        - Token is not expired
        - Token belongs to an active user

Step 4: Token rotation:
        - DELETE old refresh token hash from DB
        - Generate NEW refresh token
        - Store NEW hash in DB
        - Generate NEW access token

Step 5: Response:
        Body:    { accessToken }
        Cookie:  Set-Cookie: refreshToken={new_raw_token}; ...

Step 6: Frontend retries the original failed request with new access token
```

### Why Token Rotation Matters

If an attacker steals a refresh token and the real user also uses their token:
- Whichever uses it second will find it already consumed (deleted from DB)
- This signals a potential theft
- Backend can optionally invalidate ALL refresh tokens for that user (force re-login everywhere)

---

## Email Verification

### Email Template: Verify Email

```
Subject: Verify your email address

Hi {name},

Thanks for signing up! Please verify your email address by clicking the link below:

{FRONTEND_URL}/verify-email?token={emailVerifyToken}

This link expires in 24 hours.

If you didn't create an account, you can safely ignore this email.

— SEO Platform Team
```

### Resend Verification Email

```
POST /api/auth/resend-verification { email }

Rate limited: 3 per hour per email address
```

### Verification Token Expiry

- Token is valid for 24 hours
- After 24 hours, user must request a new verification email
- Token is single-use (cleared after verification)

---

## Password Reset

### Flow

```
Step 1: User clicks "Forgot password?"
        POST /api/auth/forgot-password { email }

Step 2: Backend:
        - Generate random 64-char hex token
        - Store hash of token in user.passwordResetToken
        - Set user.passwordResetExpiry to now + 1 hour
        - Send email with reset link
        - Always respond 200 (don't reveal if email exists)

Step 3: User clicks link in email
        Frontend shows reset form at: /reset-password?token={token}

Step 4: User submits new password
        POST /api/auth/reset-password { token, newPassword }

Step 5: Backend:
        - Find user where SHA-256(token) matches passwordResetToken
        - Check passwordResetExpiry > now
        - Hash new password with bcrypt
        - Update passwordHash
        - Clear passwordResetToken and passwordResetExpiry
        - Invalidate ALL refresh tokens for this user (force re-login everywhere)
        - Return success
```

### Email Template: Password Reset

```
Subject: Reset your password

Hi {name},

You requested a password reset. Click the link below to choose a new password:

{FRONTEND_URL}/reset-password?token={resetToken}

This link expires in 1 hour.

If you didn't request this, your account is still secure — no action needed.

— SEO Platform Team
```

---

## Role-Based Access Control

### Roles

| Role | Description | Access |
|------|------------|--------|
| `USER` | Regular customer | Own projects and data only |
| `ADMIN` | Team admin (future) | Team members' data |
| `SUPER_ADMIN` | Platform operator | All data, super-admin panel |

### Permission Matrix (Phase 1)

| Action | USER | ADMIN | SUPER_ADMIN |
|--------|------|-------|-------------|
| Create/manage own projects | Yes | Yes | Yes |
| View own data | Yes | Yes | Yes |
| Connect Google OAuth | Yes | Yes | Yes |
| Run site audits | Yes | Yes | Yes |
| Use AI assistant | Yes | Yes | Yes |
| Generate reports | Yes | Yes | Yes |
| View all users | No | No | Yes |
| Manage subscriptions | No | No | Yes |
| View platform analytics | No | No | Yes |
| Impersonate users | No | No | Yes |

### NestJS Guard Implementation

```
Request Flow:
  1. JwtAuthGuard       -> Validates JWT, extracts user
  2. RolesGuard         -> Checks user.role against @Roles() decorator
  3. PlanLimitGuard     -> Checks usage against plan limits
  4. ProjectOwnerGuard  -> Verifies user owns the requested project
  5. Controller method  -> Executes business logic
```

### Guard Order (Applied via decorators on each route)

```typescript
// Example: Only Pro+ users who own the project can start a crawl
@Post(':projectId/crawls')
@UseGuards(JwtAuthGuard, RolesGuard, PlanLimitGuard, ProjectOwnerGuard)
@Roles(Role.USER, Role.ADMIN, Role.SUPER_ADMIN)
@PlanLimit(UsageMetric.PAGES_CRAWLED)
async startCrawl(@Param('projectId') projectId: string) { ... }
```

---

## Rate Limiting

### Global Rate Limits

| Scope | Limit | Window | Applied To |
|-------|-------|--------|-----------|
| Global per IP | 100 requests | 1 minute | All endpoints |
| Auth endpoints | 5 requests | 15 minutes | /api/auth/login, /register |
| Keyword search | 30 requests | 1 minute | /api/keywords/research |
| Site audit start | 3 requests | 1 hour | /api/projects/:id/crawls |
| AI assistant | 20 requests | 1 hour | /api/ai/* |
| Report generation | 5 requests | 1 hour | /api/reports/generate |
| Forgot password | 3 requests | 1 hour | /api/auth/forgot-password |
| Resend verification | 3 requests | 1 hour | /api/auth/resend-verification |

### Implementation

Using `@nestjs/throttler` with Redis store for distributed rate limiting.

```
Key format:  rl:{ip}:{endpoint}   or   rl:{userId}:{endpoint}
Storage:     Redis with TTL matching the window
Response:    429 Too Many Requests with Retry-After header
```

---

## Billing System

### Overview

```
User signs up -> FREE plan (automatic, no Stripe checkout)
User upgrades -> Stripe Checkout Session -> Payment -> Webhook -> DB updated
User manages  -> Stripe Customer Portal (cancel, change plan, update card)
```

### Why Stripe

- Industry standard for SaaS billing
- Handles PCI compliance (credit card data never touches your server)
- Built-in Customer Portal (users manage their own subscriptions)
- Webhooks for reliable state synchronization
- Supports monthly + yearly billing, trials, prorations

---

## Subscription Plans

### Plan Pricing

| Plan | Monthly | Yearly (per month) | Yearly (total) | Savings |
|------|---------|-------------------|----------------|---------|
| **Free** | $0 | $0 | $0 | — |
| **Pro** | $49/mo | $39/mo | $468/yr | 20% |
| **Agency** | $199/mo | $159/mo | $1,908/yr | 20% |

---

## Plan Limits

### Feature Limits by Plan

| Feature | Free | Pro | Agency |
|---------|------|-----|--------|
| Projects | 1 | 5 | 25 |
| Tracked keywords per project | 10 | 100 | 1,000 |
| Pages per site audit crawl | 100 | 10,000 | 100,000 |
| Keyword searches per day | 10 | 500 | Unlimited |
| AI assistant messages per month | 10 | 200 | Unlimited |
| Reports per month | 1 | 20 | Unlimited |
| Competitors per project | 2 | 5 | 10 |
| Crawls per month | 2 | 10 | 50 |
| Report white-label | No | No | Yes |
| Team members | 1 | 3 | 10 |
| Data retention | 3 months | 12 months | 24 months |

### Limits Configuration (Backend Constant)

```typescript
const PLAN_LIMITS = {
  FREE: {
    maxProjects: 1,
    maxTrackedKeywordsPerProject: 10,
    maxPagesPerCrawl: 100,
    maxKeywordSearchesPerDay: 10,
    maxAiMessagesPerMonth: 10,
    maxReportsPerMonth: 1,
    maxCompetitorsPerProject: 2,
    maxCrawlsPerMonth: 2,
    whiteLabel: false,
    maxTeamMembers: 1,
    dataRetentionMonths: 3,
  },
  PRO: {
    maxProjects: 5,
    maxTrackedKeywordsPerProject: 100,
    maxPagesPerCrawl: 10_000,
    maxKeywordSearchesPerDay: 500,
    maxAiMessagesPerMonth: 200,
    maxReportsPerMonth: 20,
    maxCompetitorsPerProject: 5,
    maxCrawlsPerMonth: 10,
    whiteLabel: false,
    maxTeamMembers: 3,
    dataRetentionMonths: 12,
  },
  AGENCY: {
    maxProjects: 25,
    maxTrackedKeywordsPerProject: 1_000,
    maxPagesPerCrawl: 100_000,
    maxKeywordSearchesPerDay: -1, // unlimited
    maxAiMessagesPerMonth: -1,    // unlimited
    maxReportsPerMonth: -1,       // unlimited
    maxCompetitorsPerProject: 10,
    maxCrawlsPerMonth: 50,
    whiteLabel: true,
    maxTeamMembers: 10,
    dataRetentionMonths: 24,
  },
};
```

**Note:** `-1` means unlimited. Guard checks: `if (limit !== -1 && usage >= limit) throw 403`.

---

## Stripe Integration

### Setup Requirements

1. **Stripe Account** with products and prices configured
2. **4 Stripe Price IDs** (Pro monthly, Pro yearly, Agency monthly, Agency yearly)
3. **Webhook endpoint** registered in Stripe dashboard
4. **Customer Portal** enabled in Stripe dashboard settings

### Stripe Objects Mapping

| Stripe Object | Our DB Field | When Created |
|---------------|-------------|-------------|
| `Customer` | `subscription.stripeCustomerId` | On user registration |
| `Subscription` | `subscription.stripeSubscriptionId` | After checkout completion |
| `Price` | Referenced by env vars | Pre-configured in Stripe dashboard |

### Checkout Flow (Upgrade to Paid Plan)

```
Step 1: User clicks "Upgrade to Pro" on pricing page
        POST /api/billing/create-checkout-session { plan: "PRO", cycle: "MONTHLY" }

Step 2: Backend creates Stripe Checkout Session:
        stripe.checkout.sessions.create({
          customer: user's stripeCustomerId,
          mode: 'subscription',
          line_items: [{ price: STRIPE_PRICE_PRO_MONTHLY, quantity: 1 }],
          success_url: '{FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}',
          cancel_url: '{FRONTEND_URL}/billing/cancelled',
          metadata: { userId: user.id },
        })

Step 3: Backend returns checkout URL
        { url: "https://checkout.stripe.com/c/pay/cs_test_..." }

Step 4: Frontend redirects user to Stripe Checkout page
        window.location.href = checkoutUrl;

Step 5: User completes payment on Stripe's hosted page

Step 6: Stripe sends webhook: checkout.session.completed
        Backend processes webhook (see Webhook Handling below)

Step 7: User redirected to success page
        Frontend shows "Subscription activated!" message
```

### Customer Portal Flow (Manage Subscription)

```
Step 1: User clicks "Manage Subscription" in settings
        POST /api/billing/create-portal-session

Step 2: Backend creates Stripe Portal Session:
        stripe.billingPortal.sessions.create({
          customer: user's stripeCustomerId,
          return_url: '{FRONTEND_URL}/settings/billing',
        })

Step 3: Backend returns portal URL

Step 4: Frontend redirects user to Stripe's Customer Portal
        User can: update payment method, switch plans, cancel, view invoices

Step 5: Any changes trigger Stripe webhooks -> backend processes them
```

---

## Webhook Handling

### Webhook Security

```
Step 1: Stripe sends POST to /api/billing/webhook
Step 2: Backend reads raw request body (NOT parsed JSON)
Step 3: Verify signature using STRIPE_WEBHOOK_SECRET:
        stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
Step 4: If signature invalid -> return 400
Step 5: If valid -> process event
Step 6: Return 200 (always return 200 quickly, process async if needed)
```

### Events to Handle

| Stripe Event | Action |
|-------------|--------|
| `checkout.session.completed` | Activate subscription: set plan, status=ACTIVE, period dates |
| `invoice.paid` | Extend subscription period, reset monthly usage counters |
| `invoice.payment_failed` | Set status=PAST_DUE, send warning email, start 7-day grace period |
| `customer.subscription.updated` | Update plan, billing cycle, period dates, cancelAtPeriodEnd |
| `customer.subscription.deleted` | Set plan=FREE, status=CANCELLED, clear Stripe subscription ID |

### Webhook Processing Logic

```
Event: checkout.session.completed
  1. Extract userId from session.metadata
  2. Extract subscriptionId from session.subscription
  3. Retrieve subscription details from Stripe
  4. Update DB:
     - subscription.stripeSubscriptionId = subscriptionId
     - subscription.plan = PRO or AGENCY (based on price ID)
     - subscription.status = ACTIVE
     - subscription.currentPeriodStart = subscription.current_period_start
     - subscription.currentPeriodEnd = subscription.current_period_end
  5. Update usage records with new limits
  6. Send welcome email for new plan

Event: invoice.paid
  1. Find user by stripeCustomerId
  2. Update subscription period dates
  3. Reset monthly usage counters to 0
  4. Log payment for admin dashboard

Event: invoice.payment_failed
  1. Find user by stripeCustomerId
  2. Set subscription.status = PAST_DUE
  3. Send email: "Your payment failed. Update your card within 7 days."
  4. After 7 days (checked by cron): if still PAST_DUE, downgrade to FREE

Event: customer.subscription.deleted
  1. Find user by stripeCustomerId
  2. Set subscription.plan = FREE
  3. Set subscription.status = CANCELLED
  4. Clear stripeSubscriptionId
  5. Reduce usage limits to FREE tier
  6. Send email: "Your subscription has been cancelled"
```

### Webhook Idempotency

Stripe may send the same webhook multiple times. Handle this by:
1. Checking if the action was already applied (e.g., plan already matches)
2. Using database transactions for atomic updates
3. Logging webhook event IDs to detect duplicates

---

## Usage Tracking

### How Usage Is Tracked

Every feature that has a plan limit increments a counter in the `usage_records` table.

```
Example: User searches for a keyword
  1. PlanLimitGuard checks: usageRecords.find(userId, KEYWORDS_TRACKED, "2026-03")
  2. If count >= limit -> throw 403 "Plan limit reached"
  3. If count < limit  -> allow request, increment count by 1
```

### Usage Reset

- Monthly usage counters reset to 0 when `invoice.paid` webhook fires
- For Free plan users: reset on the 1st of each month via cron job

### Usage Endpoint

```
GET /api/billing/usage

Response:
{
  "plan": "PRO",
  "period": "2026-03",
  "usage": {
    "KEYWORDS_TRACKED": { "count": 45, "limit": 100 },
    "PAGES_CRAWLED": { "count": 2300, "limit": 10000 },
    "AI_CREDITS": { "count": 12, "limit": 200 },
    "REPORTS_GENERATED": { "count": 3, "limit": 20 }
  }
}
```

---

## Auth API Endpoints

### POST /api/auth/register

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "MySecurePass1",
  "name": "John Doe"
}
```

**Validation:**
- `email`: valid email format, max 255 chars
- `password`: min 8, max 128, 1 uppercase, 1 lowercase, 1 number
- `name`: optional, max 100 chars

**Success (201):**
```json
{
  "success": true,
  "data": {
    "message": "Registration successful. Check your email to verify your account."
  }
}
```

**Errors:**
- `409` — Email already registered
- `400` — Validation failed

---

### POST /api/auth/login

Authenticate and receive tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "MySecurePass1"
}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "clxyz123abc",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER",
      "plan": "PRO",
      "isEmailVerified": true
    }
  }
}
```
+ `Set-Cookie: refreshToken=...`

**Errors:**
- `401` — Invalid credentials
- `403` — Email not verified (include resend link in response)
- `429` — Too many attempts

---

### POST /api/auth/refresh

Get new access token using refresh token cookie.

**Request:** No body. Refresh token sent via cookie.

**Success (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```
+ New `Set-Cookie: refreshToken=...`

**Errors:**
- `401` — Invalid or expired refresh token

---

### POST /api/auth/logout

Invalidate refresh token.

**Request:** No body. Refresh token sent via cookie. Access token in Authorization header.

**Success (200):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```
+ `Set-Cookie: refreshToken=; Max-Age=0` (clear cookie)

---

### GET /api/auth/verify-email?token={token}

Verify email address.

**Success:** Redirect to `{FRONTEND_URL}/login?verified=true`

**Errors:**
- `400` — Invalid or expired token -> Redirect to `{FRONTEND_URL}/login?verified=false`

---

### POST /api/auth/forgot-password

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Success (200):** Always returns success (don't reveal if email exists)
```json
{
  "success": true,
  "data": {
    "message": "If an account exists with this email, a reset link has been sent."
  }
}
```

---

### POST /api/auth/reset-password

Set new password using reset token.

**Request:**
```json
{
  "token": "abc123def456...",
  "newPassword": "MyNewSecurePass1"
}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successful. Please log in with your new password."
  }
}
```

**Errors:**
- `400` — Invalid or expired token
- `400` — Password doesn't meet requirements

---

### GET /api/auth/me

Get current user profile. Requires authentication.

**Headers:** `Authorization: Bearer {accessToken}`

**Success (200):**
```json
{
  "success": true,
  "data": {
    "id": "clxyz123abc",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER",
    "plan": "PRO",
    "isEmailVerified": true,
    "timezone": "UTC",
    "avatarUrl": null,
    "createdAt": "2026-03-01T00:00:00.000Z"
  }
}
```

---

## Billing API Endpoints

### POST /api/billing/create-checkout-session

Create a Stripe Checkout session for upgrading.

**Request:**
```json
{
  "plan": "PRO",
  "billingCycle": "MONTHLY"
}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
  }
}
```

---

### POST /api/billing/create-portal-session

Create a Stripe Customer Portal session.

**Success (200):**
```json
{
  "success": true,
  "data": {
    "portalUrl": "https://billing.stripe.com/p/session/..."
  }
}
```

---

### GET /api/billing/subscription

Get current subscription details.

**Success (200):**
```json
{
  "success": true,
  "data": {
    "plan": "PRO",
    "billingCycle": "MONTHLY",
    "status": "ACTIVE",
    "currentPeriodStart": "2026-03-01T00:00:00.000Z",
    "currentPeriodEnd": "2026-04-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false
  }
}
```

---

### GET /api/billing/usage

Get current usage against plan limits.

**Success (200):**
```json
{
  "success": true,
  "data": {
    "plan": "PRO",
    "period": "2026-03",
    "usage": {
      "KEYWORDS_TRACKED": { "count": 45, "limit": 100 },
      "PAGES_CRAWLED": { "count": 2300, "limit": 10000 },
      "AI_CREDITS": { "count": 12, "limit": 200 },
      "REPORTS_GENERATED": { "count": 3, "limit": 20 }
    }
  }
}
```

---

### POST /api/billing/webhook

Stripe webhook endpoint. **Not called by frontend — called by Stripe directly.**

- Requires raw body (not JSON parsed)
- Verified via Stripe signature
- Returns 200 immediately
- Processes event asynchronously

---

## Security Checklist

- [ ] Passwords hashed with bcrypt (12 rounds)
- [ ] Refresh tokens stored as SHA-256 hashes
- [ ] Access tokens short-lived (15 min)
- [ ] Refresh tokens in HttpOnly, Secure, SameSite=Strict cookies
- [ ] Token rotation on every refresh
- [ ] All auth endpoints rate limited
- [ ] Password reset tokens expire in 1 hour
- [ ] Email verification tokens expire in 24 hours
- [ ] Forgot password doesn't reveal if email exists
- [ ] Stripe webhooks verified by signature
- [ ] GitHub webhooks verified by HMAC-SHA256 signature
- [ ] Stripe Customer Portal for self-service (card data never touches our server)
- [ ] WordPress credentials encrypted with AES-256-GCM at rest
- [ ] GitHub OAuth tokens encrypted with AES-256-GCM at rest
- [ ] All sensitive env vars (secrets, keys) not committed to git
- [ ] CORS configured to allow only frontend origins
