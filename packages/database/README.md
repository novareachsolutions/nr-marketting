# @repo/database

Shared Prisma database client and schema.

## Usage

```typescript
import { prisma } from '@repo/database';

// Use prisma client
const users = await prisma.user.findMany();
```

## Commands

```bash
# Generate Prisma Client
pnpm db:generate

# Create and apply migrations
pnpm db:migrate

# Push schema changes without migration
pnpm db:push

# Open Prisma Studio
pnpm db:studio
```
