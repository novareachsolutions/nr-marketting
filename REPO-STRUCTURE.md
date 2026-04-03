# NR Marketing — Repository Structure

## Workspace Dependency Graph

Shows which internal `@repo/*` packages each app/package **reuses**.

```
@repo/tsconfig  (base TS configs — reused by ALL packages & apps)
    ^
    |
@repo/shared-common  (constants, types, validation, formatting)
    ^           ^
    |           |
    |       @repo/shared-frontend  (UI components, hooks, API client)
    |           ^       ^       ^
    |           |       |       |
    |       customer-  super-  tenent-
    |       website    admin   dashboard
    |
@repo/shared-backend  (logger, response helpers, pagination types)
    ^
    |
@repo/database  (Prisma client & schema)
    ^
    |
@repo/api  (NestJS backend — uses database + shared-backend + shared-common)
```

---

## Full Directory Tree

```
nr-marketting/
├── .dockerignore
├── .env.example
├── .gitignore
├── .npmrc
├── Dockerfile
├── README.md
├── package.json                          # Root — devDeps: turbo, typescript
├── pnpm-lock.yaml
├── pnpm-workspace.yaml                   # Defines apps/** and packages/** workspaces
├── turbo.json
├── docker-compose.local.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml
│
├── scripts/
│   ├── deploy.sh
│   └── rollback.sh
│
├── docs/
│   ├── ENVIRONMENT.md
│   └── phase1/
│       ├── README.md
│       ├── 01-OVERVIEW-AND-ARCHITECTURE.md
│       ├── 02-DATABASE-SCHEMA.md
│       ├── 03-AUTH-AND-BILLING.md
│       ├── 04-GOOGLE-OAUTH-AND-INTEGRATIONS.md
│       ├── 05-CORE-MODULES.md
│       ├── 06-AI-AND-CONTENT.md
│       ├── 07-REPORTS-AND-ALERTS.md
│       ├── 08-API-REFERENCE.md
│       ├── 09-BACKGROUND-JOBS.md
│       ├── 10-FRONTEND-ARCHITECTURE.md
│       └── 11-INFRASTRUCTURE-AND-DEVOPS.md
│
├── apps/
│   ├── backend/
│   │   └── api/                          # @repo/api — NestJS Backend
│   │       │                             # Reuses: @repo/database, @repo/shared-backend,
│   │       │                             #         @repo/shared-common, @repo/tsconfig
│   │       ├── nest-cli.json
│   │       ├── package.json
│   │       ├── tsconfig.json             # extends @repo/tsconfig/nestjs.json
│   │       ├── tsconfig.build.json
│   │       ├── .eslintrc.js
│   │       ├── .prettierrc
│   │       ├── src/
│   │       │   ├── main.ts               # Entry — imports NestFactory, AppModule
│   │       │   ├── app.module.ts         # Root module — imports AppController, AppService, ConfigModule
│   │       │   ├── app.controller.ts     # Routes — imports AppService
│   │       │   ├── app.controller.spec.ts
│   │       │   └── app.service.ts        # Business logic
│   │       └── test/
│   │           ├── app.e2e-spec.ts
│   │           └── jest-e2e.json
│   │
│   └── frontend/
│       ├── customer-website/             # @repo/customer-website — Next.js Customer Site
│       │   │                             # Reuses: @repo/shared-frontend, @repo/shared-common, @repo/tsconfig
│       │   ├── next.config.js
│       │   ├── package.json
│       │   ├── tsconfig.json             # extends @repo/tsconfig/nextjs.json
│       │   ├── pages/
│       │   │   ├── index.tsx             # Imports: next/head, next/image, next/font/google
│       │   │   ├── _app.tsx              # Imports: @repo/shared-frontend (setGlobalToast, ToastInstance),
│       │   │   │                         #          @tanstack/react-query (QueryClient, QueryClientProvider)
│       │   │   ├── _document.tsx         # Imports: next/document
│       │   │   └── api/
│       │   │       └── hello.ts          # API route — imports next (NextApiRequest, NextApiResponse)
│       │   ├── styles/
│       │   │   ├── globals.css           # Reused by _app.tsx
│       │   │   └── Home.module.css       # Reused by index.tsx
│       │   └── public/
│       │       ├── next.svg
│       │       └── vercel.svg
│       │
│       ├── super-admin/                  # @repo/super-admin — Next.js Super Admin Dashboard
│       │   │                             # Reuses: @repo/shared-frontend, @repo/shared-common, @repo/tsconfig
│       │   ├── next.config.js
│       │   ├── package.json
│       │   ├── tsconfig.json             # extends @repo/tsconfig/nextjs.json
│       │   ├── pages/
│       │   │   ├── index.tsx             # Imports: next/head, next/image, next/font/google
│       │   │   ├── _app.tsx              # Imports: @repo/shared-frontend (setGlobalToast, ToastInstance),
│       │   │   │                         #          @tanstack/react-query (QueryClient, QueryClientProvider)
│       │   │   ├── _document.tsx         # Imports: next/document
│       │   │   └── api/
│       │   │       └── hello.ts
│       │   ├── styles/
│       │   │   ├── globals.css
│       │   │   └── Home.module.css
│       │   └── public/
│       │       ├── next.svg
│       │       └── vercel.svg
│       │
│       └── tenent-dashboard/             # @repo/tenent-dashboard — Next.js Tenant Dashboard
│           │                             # Reuses: @repo/shared-frontend, @repo/shared-common, @repo/tsconfig
│           ├── next.config.js
│           ├── package.json
│           ├── tsconfig.json             # extends @repo/tsconfig/nextjs.json
│           ├── pages/
│           │   ├── index.tsx             # Imports: next/head, next/image, next/font/google
│           │   ├── _app.tsx              # Imports: @repo/shared-frontend (setGlobalToast, ToastInstance),
│           │   │                         #          @tanstack/react-query (QueryClient, QueryClientProvider)
│           │   ├── _document.tsx         # Imports: next/document
│           │   └── api/
│           │       └── hello.ts
│           ├── styles/
│           │   ├── globals.css
│           │   └── Home.module.css
│           └── public/
│               ├── next.svg
│               └── vercel.svg
│
└── packages/
    ├── database/                         # @repo/database — Prisma DB Client
    │   │                                 # Reuses: @repo/tsconfig
    │   ├── package.json                  # Deps: @prisma/client
    │   ├── tsconfig.json
    │   ├── prisma/
    │   │   └── schema.prisma             # DB schema — defines all models
    │   └── src/
    │       └── index.ts                  # Exports: PrismaClient singleton + all Prisma types
    │                                     # Reused by: @repo/api
    │
    ├── shared-backend/                   # @repo/shared-backend — Backend Utilities
    │   │                                 # Reuses: @repo/shared-common, @repo/tsconfig
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts                  # Barrel — re-exports ./utils + ./types
    │       │                             # Reused by: @repo/api
    │       ├── types/
    │       │   └── index.ts              # Exports: PaginationParams, PaginatedResponse interfaces
    │       └── utils/
    │           ├── index.ts              # Barrel — re-exports ./logger + ./response
    │           ├── logger.ts             # Exports: Logger class (console-based)
    │           └── response.ts           # Exports: ApiResponse interface, success/error helpers
    │
    ├── shared-common/                    # @repo/shared-common — Universal Shared Code
    │   │                                 # Reuses: @repo/tsconfig
    │   │                                 # MOST REUSED PACKAGE — used by backend + all frontends
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts                  # Barrel — re-exports ./utils + ./constants + ./types
    │       │                             # Reused by: @repo/api, @repo/shared-backend,
    │       │                             #   @repo/shared-frontend, customer-website,
    │       │                             #   super-admin, tenent-dashboard
    │       ├── constants/
    │       │   └── index.ts              # Exports: APP_NAME, API_VERSION, DEFAULT_PAGE_SIZE, MAX_FILE_SIZE
    │       ├── types/
    │       │   └── index.ts              # Exports: BaseEntity, Nullable, Optional interfaces
    │       └── utils/
    │           ├── index.ts              # Barrel — re-exports ./validation + ./formatting
    │           ├── formatting.ts         # Exports: formatDate(), capitalize(), truncate()
    │           └── validation.ts         # Exports: isEmail(), isValidUrl(), isEmpty()
    │
    ├── shared-frontend/                  # @repo/shared-frontend — Shared UI Layer
    │   │                                 # Reuses: @repo/shared-common, @repo/tsconfig
    │   │                                 # Reused by: customer-website, super-admin, tenent-dashboard
    │   ├── package.json                  # Deps: axios, @tanstack/react-query, react, react-dom
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts                  # Barrel — re-exports ./components + ./hooks + ./utils + ./api
    │       ├── api/
    │       │   ├── index.ts              # Barrel — re-exports apiClient + useApi hooks
    │       │   ├── apiClient.ts          # Exports: axios instance, setAccessToken(), clearAccessToken(),
    │       │   │                         #          setGlobalToast(), showSuccessToast(), showWarningToast()
    │       │   │                         #          Reused by: useApi.ts, all frontend _app.tsx files
    │       │   └── useApi.ts             # Exports: useGet(), usePost(), usePatch(), useDelete(), usePut(),
    │       │                             #          BusinessLogicError class
    │       │                             #          Imports: apiClient.ts, @tanstack/react-query
    │       ├── components/
    │       │   ├── index.ts              # Barrel — re-exports ./Button
    │       │   └── Button.tsx            # Exports: Button component
    │       ├── hooks/
    │       │   ├── index.ts              # Barrel — re-exports ./useLocalStorage
    │       │   └── useLocalStorage.ts    # Exports: useLocalStorage() hook
    │       └── utils/
    │           ├── index.ts              # Barrel — re-exports ./cn
    │           └── cn.ts                 # Exports: cn() — classname merge utility
    │
    └── tsconfig/                         # @repo/tsconfig — Shared TypeScript Configs
        │                                 # MOST FOUNDATIONAL — reused by ALL packages & apps
        ├── package.json
        ├── base.json                     # Base config — extended by all others
        ├── nestjs.json                   # Extended by: apps/backend/api
        ├── nextjs.json                   # Extended by: customer-website, super-admin, tenent-dashboard
        └── react-library.json            # Extended by: shared-frontend
```

---

## Reuse Summary Table

| Package | Reused By |
|---|---|
| `@repo/tsconfig` | **ALL** packages and apps (base TS config) |
| `@repo/shared-common` | `@repo/api`, `@repo/shared-backend`, `@repo/shared-frontend`, `customer-website`, `super-admin`, `tenent-dashboard` |
| `@repo/shared-frontend` | `customer-website`, `super-admin`, `tenent-dashboard` |
| `@repo/shared-backend` | `@repo/api` |
| `@repo/database` | `@repo/api` |

### Key Shared Files

| File | What It Exports | Who Uses It |
|---|---|---|
| `shared-common/src/utils/validation.ts` | `isEmail()`, `isValidUrl()`, `isEmpty()` | Backend + all frontends |
| `shared-common/src/utils/formatting.ts` | `formatDate()`, `capitalize()`, `truncate()` | Backend + all frontends |
| `shared-common/src/constants/index.ts` | `APP_NAME`, `API_VERSION`, `DEFAULT_PAGE_SIZE`, `MAX_FILE_SIZE` | Backend + all frontends |
| `shared-common/src/types/index.ts` | `BaseEntity`, `Nullable`, `Optional` | Backend + all frontends |
| `shared-frontend/src/api/apiClient.ts` | Axios instance, `setAccessToken()`, `setGlobalToast()` | All 3 frontend apps via `_app.tsx` |
| `shared-frontend/src/api/useApi.ts` | `useGet()`, `usePost()`, `usePatch()`, `useDelete()`, `usePut()` | All 3 frontend apps |
| `shared-frontend/src/components/Button.tsx` | `Button` component | All 3 frontend apps |
| `shared-frontend/src/hooks/useLocalStorage.ts` | `useLocalStorage()` hook | All 3 frontend apps |
| `shared-backend/src/utils/logger.ts` | `Logger` class | Backend API |
| `shared-backend/src/utils/response.ts` | `ApiResponse`, `success()`, `error()` helpers | Backend API |
| `database/src/index.ts` | `PrismaClient` singleton + all Prisma types | Backend API |
