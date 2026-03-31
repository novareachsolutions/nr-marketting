# syntax=docker/dockerfile:1

# ============================================
# Global Build Arguments
# ============================================
ARG NODE_VERSION=20
ARG DATABASE_URL

# ============================================
# Base Stage – Node + pnpm + Workspace setup
# ============================================
FROM node:${NODE_VERSION}-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Essentials
RUN apk add --no-cache curl bash postgresql-client

WORKDIR /app

# Workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./
COPY packages/ packages/

# App-level package.json
COPY apps/backend/api/package.json apps/backend/api/
COPY apps/frontend/tenent-dashboard/package.json apps/frontend/tenent-dashboard/
COPY apps/frontend/super-admin/package.json apps/frontend/super-admin/
COPY apps/frontend/customer-website/package.json apps/frontend/customer-website/

# ============================================
# Dependencies Stage
# ============================================
FROM base AS dependencies

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================
# Shared Libraries + Prisma Clients
# ============================================
FROM dependencies AS shared-libs

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Prisma schema
COPY packages/database/prisma/ packages/database/prisma/

# Generate Prisma client
RUN echo "🧩 Generating Prisma client..." && \
    cd packages/database && pnpm prisma generate

# Build shared packages
RUN --mount=type=cache,id=turbo,target=/app/node_modules/.cache \
    pnpm turbo run build --filter="@repo/shared-*"

# ============================================
# Common Build Base
# ============================================
FROM shared-libs AS build-base

# Source
COPY apps/ apps/

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# ============================================
# API Production
# ============================================
FROM build-base AS api-production
WORKDIR /app/apps/backend/api

ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN --mount=type=cache,id=nest,target=/app/node_modules/.cache \
    echo "📦 Building api..." && \
    pnpm run build

ENV NODE_OPTIONS="--max-old-space-size=2048"

EXPOSE 3000

CMD ["sh", "-c", "cd /app/packages/database && until pnpm prisma migrate deploy; do echo 'Waiting for DB...'; sleep 2; done && cd /app/apps/backend/api && pnpm run start:prod"]

# ============================================
# API Development
# ============================================
FROM shared-libs AS api-development
WORKDIR /app/apps/backend/api
ENV NODE_ENV=development

EXPOSE 3000
CMD ["sh", "-c", "cd /app/packages/database && until pnpm prisma migrate deploy; do echo 'Waiting for DB...'; sleep 2; done && cd /app/apps/backend/api && pnpm run dev"]

# ============================================
# TENENT-DASHBOARD Production
# ============================================
FROM build-base AS tenent-dashboard-production
WORKDIR /app/apps/frontend/tenent-dashboard

ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN --mount=type=cache,id=next,target=/app/node_modules/.cache \
    echo "🌐 Building tenent-dashboard..." && \
    NEXT_TELEMETRY_DISABLED=1 pnpm next build

ENV NODE_OPTIONS="--max-old-space-size=2048"

EXPOSE 3000
CMD ["pnpm", "run", "start"]

# ============================================
# SUPER-ADMIN Production
# ============================================
FROM build-base AS super-admin-production
WORKDIR /app/apps/frontend/super-admin

ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN --mount=type=cache,id=next,target=/app/node_modules/.cache \
    echo "🌐 Building super-admin..." && \
    NEXT_TELEMETRY_DISABLED=1 pnpm next build

ENV NODE_OPTIONS="--max-old-space-size=2048"

EXPOSE 3001
CMD ["pnpm", "run", "start"]

# ============================================
# CUSTOMER-WEBSITE Production
# ============================================
FROM build-base AS customer-website-production
WORKDIR /app/apps/frontend/customer-website

ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN --mount=type=cache,id=next,target=/app/node_modules/.cache \
    echo "🌐 Building customer-website..." && \
    NEXT_TELEMETRY_DISABLED=1 pnpm next build

ENV NODE_OPTIONS="--max-old-space-size=2048"

EXPOSE 3002
CMD ["pnpm", "run", "start"]
