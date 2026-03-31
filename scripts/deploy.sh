#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/$(whoami)/app}"
COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_NAME="${PROJECT_NAME:-app}"

TAG="${1:-}"
if [[ -z "${TAG}" ]]; then
  echo "❌ Usage: ./scripts/deploy.sh <tag>"
  exit 1
fi

echo "🚀 Deploying tag ${TAG} in ${APP_DIR}"
cd "${APP_DIR}"

export RELEASE_TAG="${TAG}"

# Keep a pointer to the previous tag for rollback
if [[ -f .current_release_tag ]]; then
  cp .current_release_tag .prev_release_tag
fi
echo "${TAG}" > .current_release_tag

# 1) Pull latest images
echo "📥 Pulling images for tag ${TAG}..."
docker compose -f "${COMPOSE_FILE}" pull api tenent-dashboard super-admin customer-website

# 2) Run database migrations
echo "🧩 Running database migrations..."
FIRST_BACKEND="api"
if ! docker compose -f "${COMPOSE_FILE}" run --rm ${FIRST_BACKEND} sh -c 'pnpm prisma migrate deploy'; then
  echo "❌ Migration failed. Rolling back to previous tag..."
  if [[ -f .prev_release_tag ]]; then
    ./scripts/rollback.sh
  fi
  exit 1
fi

# 3) Start/Update services
echo "🔄 Starting containers..."
docker compose -f "${COMPOSE_FILE}" up -d api tenent-dashboard super-admin customer-website

# 4) Wait for services to be healthy
echo "🔍 Waiting for services to be healthy..."
for SERVICE in api tenent-dashboard super-admin customer-website; do
  CONTAINER_NAME="${PROJECT_NAME}-${SERVICE}"
  for i in {1..30}; do
    STATUS="$(docker inspect --format '{{json .State.Health.Status}}' "${CONTAINER_NAME}" 2>/dev/null | tr -d '"')" || true
    if [[ "${STATUS}" == "healthy" ]] || [[ -z "${STATUS}" ]]; then
      echo "✅ ${SERVICE} is healthy"
      break
    fi
    if [[ ${i} -eq 30 ]]; then
      echo "⚠️  ${SERVICE} did not become healthy (timeout)"
    fi
    sleep 3
  done
done

# 5) Cleanup old images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment successful for tag ${TAG}"
echo "📊 Running services:"
docker compose -f "${COMPOSE_FILE}" ps
