# Phase 1 - Google OAuth, GitHub OAuth & Integrations

> **Integrations:** Google Analytics 4 (GA4), Google Search Console (GSC), GitHub API, WordPress REST API
> **Auth Methods:** OAuth 2.0 (Google + GitHub), Application Passwords (WordPress)
> **Cost:** Free (all APIs have generous free tiers)

---

## Table of Contents

- [Overview](#overview)
- [Google Cloud Console Setup](#google-cloud-console-setup)
- [OAuth 2.0 Flow (Step by Step)](#oauth-20-flow-step-by-step)
- [Token Management](#token-management)
- [Google Search Console API](#google-search-console-api)
- [Google Analytics 4 API](#google-analytics-4-api)
- [Property & Site Selection](#property--site-selection)
- [Error Handling](#error-handling)
- [App Verification](#app-verification)
- [API Endpoints](#api-endpoints)
- [GitHub OAuth Integration](#github-oauth-integration)
- [WordPress REST API Integration](#wordpress-rest-api-integration)

---

## Overview

Users connect their **own** Google Analytics and Search Console accounts to the platform.
They never share passwords. They authorize our app via Google's OAuth consent screen.
This is the same flow used by Semrush, HubSpot, Databox, and every other analytics platform.

### What Each API Gives Us

| API | Data | Used In | Cost |
|-----|------|---------|------|
| **Google Search Console** | Keywords, positions, clicks, impressions, CTR | Rank Tracking, Organic Insights | Free |
| **Google Analytics 4** | Sessions, users, bounce rate, traffic by channel/page | Traffic Insights, Dashboard, Reports | Free |

### What We Store

```
google_connections table:
  - accessToken       (short-lived, refreshed automatically)
  - refreshToken      (ENCRYPTED, long-lived, stored permanently)
  - tokenExpiry       (when access token expires)
  - scope             (which permissions were granted)
  - gaPropertyId      (selected GA4 property)
  - gscSiteUrl        (selected Search Console site)
```

---

## Google Cloud Console Setup

### One-Time Setup (Done by You, the Developer)

```
1. Go to https://console.cloud.google.com
2. Create a new project: "SEO Platform"
3. Enable these APIs:
   - Google Search Console API
   - Google Analytics Data API (GA4)
   - Google Analytics Admin API (for listing properties)
4. Go to "OAuth consent screen":
   - App type: External
   - App name: "SEO Platform" (or your brand name)
   - Support email: your email
   - Authorized domains: yourdomain.com
   - Scopes: (add all 3 below)
5. Go to "Credentials" -> "Create Credentials" -> "OAuth 2.0 Client ID":
   - Application type: Web application
   - Authorized redirect URIs:
     - http://localhost:4000/api/google-oauth/callback  (development)
     - https://api.yourdomain.com/api/google-oauth/callback  (production)
6. Copy Client ID and Client Secret to your .env file
```

### OAuth Scopes to Request

```
https://www.googleapis.com/auth/webmasters.readonly
https://www.googleapis.com/auth/analytics.readonly
```

**Always read-only.** Users trust apps more when they see "View" instead of "Manage."
We never need to write data to their GA or GSC accounts.

---

## OAuth 2.0 Flow (Step by Step)

### Visual Flow

```
Browser                  Your Backend               Google
  |                          |                        |
  |  1. Click "Connect"      |                        |
  |------------------------->|                        |
  |                          |                        |
  |  2. Redirect to Google   |                        |
  |<-------------------------|                        |
  |                          |                        |
  |  3. User sees consent    |                        |
  |-------------------------------------------------->|
  |                          |                        |
  |  4. User clicks "Allow"  |                        |
  |<--------------------------------------------------|
  |     (redirect with code) |                        |
  |                          |                        |
  |  5. Code sent to backend |                        |
  |------------------------->|                        |
  |                          |  6. Exchange code      |
  |                          |  for tokens            |
  |                          |----------------------->|
  |                          |                        |
  |                          |  7. Tokens returned    |
  |                          |<-----------------------|
  |                          |                        |
  |                          |  8. Store tokens in DB |
  |                          |                        |
  |  9. Redirect to dashboard|                        |
  |<-------------------------|                        |
```

### Step-by-Step Implementation

**Step 1: User clicks "Connect Google" button**

Frontend redirects to:
```
GET /api/google-oauth/authorize
```

**Step 2: Backend generates Google OAuth URL**

```
Google OAuth URL = https://accounts.google.com/o/oauth2/v2/auth
  ?client_id={GOOGLE_CLIENT_ID}
  &redirect_uri={GOOGLE_REDIRECT_URI}
  &response_type=code
  &scope=https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly
  &access_type=offline        <-- CRITICAL: gives us refresh_token
  &prompt=consent             <-- CRITICAL: always show consent to get refresh_token
  &state={csrf_token}         <-- CSRF protection: random string stored in session/Redis
```

Backend redirects user to this URL.

**Step 3: User sees Google consent screen**

```
"SEO Platform is requesting access to:
  - View your Search Console data
  - View your Google Analytics data

[Allow]  [Deny]"
```

**Step 4: User clicks "Allow"**

Google redirects to:
```
{GOOGLE_REDIRECT_URI}?code={authorization_code}&state={csrf_token}
```

**Step 5: Backend receives callback**

```
GET /api/google-oauth/callback?code={code}&state={state}
```

Backend validates:
1. `state` parameter matches the one we stored (CSRF check)
2. `code` parameter exists

**Step 6: Backend exchanges code for tokens**

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={authorization_code}
&client_id={GOOGLE_CLIENT_ID}
&client_secret={GOOGLE_CLIENT_SECRET}
&redirect_uri={GOOGLE_REDIRECT_URI}
```

**Step 7: Google returns tokens**

```json
{
  "access_token": "ya29.a0AfH6SM...",
  "refresh_token": "1//0dx...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly"
}
```

**Step 8: Backend stores tokens**

```
1. Encrypt refresh_token with AES-256-GCM using ENCRYPTION_KEY env var
2. Store in google_connections table:
   - accessToken = access_token (plain, it expires in 1 hour anyway)
   - refreshToken = encrypted_refresh_token
   - tokenExpiry = now + expires_in seconds
   - scope = scope from response
3. gaPropertyId and gscSiteUrl are set to NULL initially
   (user selects them in the next step)
```

**Step 9: Backend redirects to frontend**

```
Redirect to: {FRONTEND_URL}/settings/integrations?google=connected
```

Frontend shows success message and prompts user to select GA property and GSC site.

---

## Token Management

### Access Token Refresh (Automatic, Silent)

Access tokens expire every hour. Before any Google API call:

```
1. Check: is tokenExpiry < now?
2. If yes: refresh the token
   POST https://oauth2.googleapis.com/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=refresh_token
   &refresh_token={decrypted_refresh_token}
   &client_id={GOOGLE_CLIENT_ID}
   &client_secret={GOOGLE_CLIENT_SECRET}

3. Google returns new access_token (and sometimes new refresh_token)
4. Update DB: new accessToken, new tokenExpiry
5. If new refresh_token provided: encrypt and update in DB
6. Proceed with original API call using new access_token
```

### Token Encryption

```
Algorithm: AES-256-GCM
Key:       ENCRYPTION_KEY env var (32 bytes = 64 hex chars)

Encrypt:
  1. Generate random 16-byte IV
  2. Encrypt plaintext with key + IV
  3. Get auth tag from cipher
  4. Store: base64(IV) + ":" + base64(encrypted) + ":" + base64(authTag)

Decrypt:
  1. Split stored value by ":"
  2. Decode IV, encrypted data, auth tag from base64
  3. Decrypt with key + IV + auth tag
  4. Return plaintext refresh token
```

### Token Revocation (Disconnect Google)

When user clicks "Disconnect Google":
1. Revoke token at Google: `POST https://oauth2.googleapis.com/revoke?token={accessToken}`
2. Delete google_connections record from DB
3. Set `gaPropertyId` and `gscSiteUrl` to null on related projects

---

## Google Search Console API

### What It Provides

- **All keywords** your site appears for on Google (not just ones you track)
- **Average position** per keyword (e.g., 7.3)
- **Clicks** and **impressions** per keyword
- **Click-through rate (CTR)** per keyword
- **16 months** of historical data from the day of connection
- Filter by **device** (mobile/desktop) and **country**

### API Endpoint Used

```
POST https://searchconsole.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query

Headers:
  Authorization: Bearer {access_token}

Body:
{
  "startDate": "2026-03-01",
  "endDate": "2026-03-31",
  "dimensions": ["query", "date", "device", "country"],
  "rowLimit": 25000,
  "startRow": 0,
  "dimensionFilterGroups": [
    {
      "filters": [
        {
          "dimension": "country",
          "expression": "usa"
        }
      ]
    }
  ]
}
```

### Response Format

```json
{
  "rows": [
    {
      "keys": ["best running shoes", "2026-03-15", "DESKTOP", "usa"],
      "clicks": 45,
      "impressions": 1200,
      "ctr": 0.0375,
      "position": 4.2
    },
    {
      "keys": ["running shoes review", "2026-03-15", "MOBILE", "usa"],
      "clicks": 12,
      "impressions": 800,
      "ctr": 0.015,
      "position": 8.7
    }
  ]
}
```

### How We Use GSC Data

| Use Case | API Call | Stored In |
|----------|---------|-----------|
| Daily rank sync | Query last 7 days, all keywords | `ranking_history` table |
| Rank tracking dashboard | Read from DB | Displayed in charts |
| Keyword discovery | Query all keywords for domain | Suggest keywords to track |
| Organic traffic insights | Match keywords to pages | Merged with GA data |

### GSC API Limits

| Limit | Value |
|-------|-------|
| Queries per day | 1,200 per site per day |
| Rows per query | 25,000 max |
| Date range | Up to 16 months back |
| Dimensions | query, page, device, country, date |

**Pagination:** If more than 25,000 rows, increment `startRow` by 25,000 and make another request.

### GSC Site URL Format

GSC uses a specific format for site URLs:
- **Domain property:** `sc-domain:example.com` (covers all subdomains)
- **URL prefix:** `https://www.example.com/` (specific prefix only)

When listing available sites, show both formats and let user choose.

---

## Google Analytics 4 API

### What It Provides

- **Sessions**, **users**, **new users** per day
- **Bounce rate**, **session duration**
- **Traffic by channel** (organic, direct, social, paid, referral)
- **Traffic by page** (which pages get the most visits)
- **Traffic by country/city**
- **Real-time active users** (optional, nice for dashboard)

### API Endpoint Used (GA4 Data API)

```
POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport

Headers:
  Authorization: Bearer {access_token}

Body:
{
  "dateRanges": [
    {
      "startDate": "2026-03-01",
      "endDate": "2026-03-31"
    }
  ],
  "metrics": [
    { "name": "sessions" },
    { "name": "totalUsers" },
    { "name": "newUsers" },
    { "name": "bounceRate" },
    { "name": "averageSessionDuration" }
  ],
  "dimensions": [
    { "name": "date" }
  ],
  "orderBys": [
    {
      "dimension": { "dimensionName": "date" },
      "desc": false
    }
  ]
}
```

### Common GA4 Reports We Need

**1. Traffic Overview (Dashboard)**
```
Metrics: sessions, totalUsers, newUsers, bounceRate, averageSessionDuration
Dimensions: date
Date range: last 30 days
```

**2. Traffic by Channel**
```
Metrics: sessions, totalUsers
Dimensions: sessionDefaultChannelGroup
Date range: last 30 days
```

**3. Top Pages by Traffic**
```
Metrics: sessions, screenPageViews
Dimensions: pagePath
Date range: last 30 days
Order by: sessions DESC
Limit: 20
```

**4. Traffic by Country**
```
Metrics: sessions, totalUsers
Dimensions: country
Date range: last 30 days
Order by: sessions DESC
Limit: 20
```

### GA4 API Limits

| Limit | Value |
|-------|-------|
| Requests per day | 50,000 per project |
| Requests per minute per property | 10 |
| Rows per response | 100,000 max |
| Concurrent requests | 10 per property |

The per-minute limit is the most relevant constraint. Space out requests per property.

### GA4 Property ID Format

GA4 uses numeric property IDs: `properties/123456789`

When listing available properties, use the **GA4 Admin API**:

```
GET https://analyticsadmin.googleapis.com/v1beta/accountSummaries

Returns list of accounts -> each has properties -> user selects one
```

---

## Property & Site Selection

After OAuth connection, the user needs to select which GA4 property and GSC site to use.

### Flow

```
Step 1: User completes Google OAuth (tokens stored)

Step 2: Frontend calls GET /api/google-oauth/available-sites
        Backend uses tokens to:
        a. List GA4 properties via Admin API
        b. List GSC sites via Sites API

Step 3: Frontend shows selection dropdown:
        "Select your Google Analytics property: [dropdown]"
        "Select your Search Console site:       [dropdown]"

Step 4: User selects and submits
        POST /api/google-oauth/select-properties {
          gaPropertyId: "properties/123456789",
          gscSiteUrl: "sc-domain:example.com"
        }

Step 5: Backend stores selections in google_connections table
```

### Listing GSC Sites

```
GET https://www.googleapis.com/webmasters/v3/sites

Headers:
  Authorization: Bearer {access_token}

Response:
{
  "siteEntry": [
    {
      "siteUrl": "https://www.example.com/",
      "permissionLevel": "siteOwner"
    },
    {
      "siteUrl": "sc-domain:example.com",
      "permissionLevel": "siteOwner"
    }
  ]
}
```

### Listing GA4 Properties

```
GET https://analyticsadmin.googleapis.com/v1beta/accountSummaries

Headers:
  Authorization: Bearer {access_token}

Response:
{
  "accountSummaries": [
    {
      "name": "accountSummaries/123",
      "account": "accounts/456",
      "displayName": "My Company",
      "propertySummaries": [
        {
          "property": "properties/789",
          "displayName": "My Website - GA4",
          "propertyType": "PROPERTY_TYPE_ORDINARY"
        }
      ]
    }
  ]
}
```

---

## Error Handling

### Common Google API Errors

| HTTP Code | Meaning | Action |
|-----------|---------|--------|
| `401` | Access token expired or invalid | Refresh token and retry once |
| `403` | Permission denied or quota exceeded | Check scope, check quota, show error |
| `404` | Property/site not found | User may have removed access in Google |
| `429` | Rate limited | Implement exponential backoff |
| `500/503` | Google server error | Retry with exponential backoff (max 3 retries) |

### Token Refresh Failure

If refresh token is rejected (user revoked access in Google account settings):

```
1. Mark GoogleConnection as invalid (or delete it)
2. Set gaPropertyId and gscSiteUrl to null
3. Notify user: "Your Google connection has expired. Please reconnect."
4. Stop all background jobs (GSC sync) for this user's projects
```

### Exponential Backoff Implementation

```
Retry delays: 1s, 2s, 4s (max 3 retries)

For 429 errors: respect Retry-After header if present
For 500/503 errors: use exponential backoff
For 401 errors: refresh token first, then retry once (no backoff)
For 400/403/404: do NOT retry (client error, retrying won't help)
```

---

## App Verification

### Why Verification Is Needed

Google OAuth apps in "testing" mode are limited to 100 users. Before going beyond that:

1. Google reviews your OAuth consent screen
2. They check your privacy policy, terms of service, and homepage
3. They verify you're using the minimum required scopes
4. They may request a video demo of how you use the data

### Verification Timeline

- **Submission to approval: 1-6 weeks** (varies widely)
- **Start this process early** — don't wait until launch day

### Requirements for Verification

- [ ] Published privacy policy URL on your domain
- [ ] Published terms of service URL on your domain
- [ ] Homepage explaining what your app does
- [ ] App logo (120x120 PNG)
- [ ] Justify each OAuth scope requested
- [ ] Demo video showing the consent flow and how data is used (if requested)

### Verification Scopes

Since we request `readonly` scopes only, the review is simpler. Apps requesting
`manage` or `write` scopes face stricter scrutiny.

---

## API Endpoints

### GET /api/google-oauth/authorize

Redirects user to Google OAuth consent screen.

**Query Parameters:**
- None (user must be authenticated via JWT)

**Response:** 302 redirect to Google OAuth URL

---

### GET /api/google-oauth/callback

Handles OAuth callback from Google.

**Query Parameters:**
- `code` — Authorization code from Google
- `state` — CSRF token for validation

**Response:** 302 redirect to frontend with success/error status

---

### GET /api/google-oauth/status

Check if Google is connected and which properties are selected.

**Success (200):**
```json
{
  "success": true,
  "data": {
    "isConnected": true,
    "gaPropertyId": "properties/123456789",
    "gaPropertyName": "My Website - GA4",
    "gscSiteUrl": "sc-domain:example.com",
    "scope": "webmasters.readonly analytics.readonly",
    "connectedAt": "2026-03-15T10:30:00.000Z"
  }
}
```

---

### GET /api/google-oauth/available-sites

List available GA4 properties and GSC sites for selection.

**Success (200):**
```json
{
  "success": true,
  "data": {
    "gaProperties": [
      {
        "propertyId": "properties/123456789",
        "displayName": "My Website - GA4",
        "accountName": "My Company"
      }
    ],
    "gscSites": [
      {
        "siteUrl": "sc-domain:example.com",
        "permissionLevel": "siteOwner"
      },
      {
        "siteUrl": "https://www.example.com/",
        "permissionLevel": "siteOwner"
      }
    ]
  }
}
```

---

### POST /api/google-oauth/select-properties

Save user's selected GA4 property and GSC site.

**Request:**
```json
{
  "gaPropertyId": "properties/123456789",
  "gscSiteUrl": "sc-domain:example.com"
}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "message": "Google properties configured successfully"
  }
}
```

---

### DELETE /api/google-oauth/disconnect

Disconnect Google account (revoke tokens, clear data).

**Success (200):**
```json
{
  "success": true,
  "data": {
    "message": "Google account disconnected"
  }
}
```

---

## Data Freshness & Sync Strategy

### GSC Data Delay

Google Search Console data has a **2-3 day delay**. Data for March 31 becomes available around April 2-3.

This means:
- Daily sync job should query data for `today - 5 days` to `today - 2 days`
- Always re-fetch the last 5 days to catch any late-arriving data
- Don't show "today's rankings" — show "latest available" with date label

### GA4 Data Delay

GA4 data is available within **24-48 hours** for standard reports.

Real-time data (active users right now) is available instantly but with limited dimensions.

### Sync Schedule

| Data | Sync Time | Date Range Queried | Stored In |
|------|-----------|-------------------|-----------|
| GSC rankings | Daily 2 AM | Last 7 days | `ranking_history` |
| GA4 traffic overview | Daily 3 AM | Yesterday | Cached in Redis (24h TTL) |
| GA4 traffic by page | Daily 3 AM | Yesterday | Cached in Redis (24h TTL) |
| GA4 traffic by channel | Daily 3 AM | Yesterday | Cached in Redis (24h TTL) |

Longer date ranges (30 days, 90 days) are fetched on-demand when user views the dashboard, then cached.

---

## GitHub OAuth Integration

### Overview

Users connect their GitHub repositories to enable auto-fix via PR, deploy detection,
and source file analysis. Uses standard GitHub OAuth 2.0 (Web application flow).

### GitHub Developer Setup (One-Time)

```
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - Application name: "SEO Platform"
   - Homepage URL: https://yourdomain.com
   - Authorization callback URL: http://localhost:4000/api/github/callback (dev)
                                 https://api.yourdomain.com/api/github/callback (prod)
4. Copy Client ID and Client Secret to .env
```

### OAuth Flow

```
1. User clicks "Connect GitHub" on project settings page
   GET /api/github/authorize?projectId={projectId}

2. Backend generates GitHub OAuth URL:
   https://github.com/login/oauth/authorize
     ?client_id={GITHUB_CLIENT_ID}
     &redirect_uri={GITHUB_REDIRECT_URI}
     &scope=repo
     &state={projectId}:{csrf_token}

3. User sees GitHub consent screen:
   "SEO Platform wants access to your repositories"
   [Authorize]

4. User clicks Authorize -> GitHub redirects to:
   {GITHUB_REDIRECT_URI}?code={code}&state={projectId}:{csrf_token}

5. Backend exchanges code for token:
   POST https://github.com/login/oauth/access_token
   Headers: Accept: application/json
   Body: { client_id, client_secret, code }

   Response: { access_token: "gho_xxxx", token_type: "bearer", scope: "repo" }

6. Backend stores encrypted token, redirects to repo selection page
```

### GitHub OAuth Scope

```
repo    — Full control of private repositories
          (read code, create branches, open PRs, manage webhooks)
```

Only `repo` scope is needed. It covers:
- Reading repository contents
- Creating branches and commits
- Opening and managing pull requests
- Creating and managing webhooks

### Token Storage

GitHub OAuth tokens **do not expire** (unless user revokes access).
No refresh token flow needed — simpler than Google OAuth.
Store the access token encrypted with AES-256-GCM (same as Google refresh tokens).

### Repository Selection

After OAuth completes, user selects which repo corresponds to their project:

```
GET https://api.github.com/user/repos?sort=updated&per_page=30
Headers: Authorization: Bearer {access_token}

Response: array of repos with name, full_name, html_url, default_branch, etc.
```

Show dropdown: user picks repo -> backend stores repoOwner, repoName, defaultBranch.

### Deploy URL Auto-Detection

After repo is selected, detect where the site is deployed:

```
1. Check for GitHub Pages:
   GET /repos/{owner}/{repo}/pages
   If 200: deployUrl = response.html_url, platform = GITHUB_PAGES

2. Check for CNAME file (custom domain):
   GET /repos/{owner}/{repo}/contents/CNAME
   If 200: deployUrl = file contents, platform = GITHUB_PAGES

3. Check for Vercel:
   GET /repos/{owner}/{repo}/contents/vercel.json
   If 200: platform = VERCEL
   Also check: GET /repos/{owner}/{repo}/deployments (Vercel creates deployments)

4. Check for Netlify:
   GET /repos/{owner}/{repo}/contents/netlify.toml
   If 200: platform = NETLIFY

5. If none detected: platform = OTHER, user enters deploy URL manually
```

### Webhook Setup

Auto-create a webhook when repo is connected:

```
POST /repos/{owner}/{repo}/hooks
Headers: Authorization: Bearer {access_token}
Body: {
  "name": "web",
  "active": true,
  "events": ["push"],
  "config": {
    "url": "{API_URL}/api/github/webhook",
    "content_type": "json",
    "secret": "{generated_secret}",
    "insecure_ssl": "0"
  }
}
```

Store the returned `hook_id` and `secret` (encrypted) for later management.

### Webhook Verification

```
1. GitHub sends POST to /api/github/webhook
2. Read X-Hub-Signature-256 header
3. Compute HMAC-SHA256 of raw body using stored webhook_secret
4. Compare: if signatures match -> process event
5. If not -> return 401
```

### Webhook Events to Handle

| Event | Action |
|-------|--------|
| `push` to default branch | Wait 2 min, queue re-crawl of project |
| `push` to fix branch | No action (PR not merged yet) |

### GitHub API Rate Limits

| Type | Limit |
|------|-------|
| Authenticated requests | 5,000 per hour per token |
| Creating content/commits | 5,000 per hour |
| Webhooks per repo | 20 max |

5,000/hour is very generous. No special handling needed at MVP scale.

### Disconnecting GitHub

```
1. Delete webhook from repo:
   DELETE /repos/{owner}/{repo}/hooks/{webhookId}
2. Delete GitHubConnection record from DB
3. Set project.sourceType back to MANUAL
```

---

## WordPress REST API Integration

### Overview

Users connect WordPress sites to enable auto-fix (update meta tags, alt text)
and content publishing directly from the SEO platform. No OAuth needed —
WordPress uses Application Passwords or a custom plugin API key.

### WordPress REST API Discovery

Before connecting, verify the site is WordPress:

```
GET https://mysite.com/wp-json/

If 200 + JSON response with "name", "url", "namespaces" -> it's WordPress
If 404 or HTML response -> not WordPress (or REST API disabled)
```

### Connection Verification

```
After user enters credentials:

1. Test the connection:
   GET https://mysite.com/wp-json/wp/v2/posts?per_page=1
   Headers: Authorization: Basic base64(username:appPassword)

2. If 200 -> credentials are valid
   If 401 -> wrong username or password
   If 403 -> REST API restricted (user needs to enable it)
   If 404 -> not a WordPress site or REST API disabled

3. Detect WordPress version:
   Response header: X-WP-Version or from /wp-json/ response

4. Detect SEO plugin:
   GET /wp-json/yoast/v1 -> YOAST
   GET /wp-json/rankmath/v1 -> RANKMATH
   GET /wp-json/aioseo/v1 -> AIOSEO
   All 404 -> NONE

5. Determine capabilities based on user role + detected plugins
6. Store encrypted credentials + metadata
```

### WordPress Application Password

Built into WordPress 5.6+ (no plugin needed):

```
User creates it at:
  WordPress Admin -> Users -> Your Profile -> Application Passwords

  Enter name: "SEO Platform"
  Click "Add New Application Password"
  WordPress shows: "xxxx xxxx xxxx xxxx xxxx xxxx"
  (24-character password, shown once)

This password works with HTTP Basic Auth for the REST API only.
It CANNOT be used to log into wp-admin (safe).
```

### Authentication Header

```
Authorization: Basic base64("admin:xxxx xxxx xxxx xxxx xxxx xxxx")
```

### SEO Plugin Detection & Meta Updates

| SEO Plugin | How to Read Meta | How to Write Meta |
|-----------|-----------------|------------------|
| **Yoast** | `GET /yoast/v1/get_head?url={url}` | `POST /wp/v2/posts/{id}` with `meta: { _yoast_wpseo_title, _yoast_wpseo_metadesc }` |
| **RankMath** | `GET /rankmath/v1/getHead?url={url}` | `POST /wp/v2/posts/{id}` with `meta: { rank_math_title, rank_math_description }` |
| **AIOSEO** | `GET /aioseo/v1/post?id={id}` | `POST /wp/v2/posts/{id}` with `meta: { _aioseo_title, _aioseo_description }` |
| **None** | Read `<title>` and `<meta>` from HTML | Not possible without plugin (user needs to install Yoast/RankMath) |

### Security Considerations

- WordPress credentials (username + app password) encrypted with AES-256-GCM
- App Passwords have limited scope (REST API only, can't log into admin)
- Users can revoke the Application Password from their WordPress profile at any time
- Periodic re-verification checks (weekly cron) to detect revoked credentials
- Never store the main WordPress password — only Application Passwords

### Error Handling

| Error | Meaning | Action |
|-------|---------|--------|
| `401` | Credentials invalid or revoked | Mark connection as invalid, notify user |
| `403` | User role doesn't have permission | Show which permission is needed |
| `404` | Endpoint not found (REST API disabled) | Guide user to enable REST API |
| `500` | WordPress server error | Retry once, then show error |
| `ECONNREFUSED` | Site is down | Show "WordPress site not reachable" |

### WordPress Connection Health Check

Weekly cron job:
```
For each WordPress connection:
  1. GET /wp-json/wp/v2/posts?per_page=1 with stored credentials
  2. If 401/403: mark isValid = false, send email to user
  3. If 200: update lastVerifiedAt, keep isValid = true
  4. If timeout/error: retry next cycle
```
