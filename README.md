# nr-marketting

A monorepo project with NestJS backends and Next.js frontends.

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Installation

```bash
pnpm install
```

### Development

```bash
# Start all apps in development mode
pnpm dev

# Build all apps
pnpm build

# Type checking
pnpm type-check

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Open Prisma Studio
pnpm db:studio
```

## Project Structure

```
nr-marketting/
├── apps/
│   ├── backend/          # NestJS backend apps
│   └── frontend/         # Next.js frontend apps
├── packages/
│   ├── database/         # Prisma schema and client
│   ├── shared-backend/   # Backend utilities and types
│   ├── shared-frontend/  # Frontend components and hooks
│   ├── shared-common/    # Universal utilities
│   └── tsconfig/         # Shared TypeScript configs
└── turbo.json           # Turborepo configuration
```

## Packages

### @repo/database
Prisma schema, migrations, and database client.

### @repo/shared-backend
Shared backend utilities, middleware, and types.

### @repo/shared-frontend
Shared frontend components, hooks, and utilities.

### @repo/shared-common
Universal utilities that can be used by both frontend and backend.

## Adding New Apps

### Backend App
Create a new NestJS app in `apps/backend/` and add it to `pnpm-workspace.yaml`.

### Frontend App
Create a new Next.js app in `apps/frontend/` and add it to `pnpm-workspace.yaml`.

## License

MIT
