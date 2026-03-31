#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/$(whoami)/app}"
COMPOSE_FILE="docker-compose.prod.yml"

cd "${APP_DIR}"

if [[ ! -f .prev_release_tag ]]; then
  echo "❌ No .prev_release_tag found; cannot rollback."
  exit 1
fi

export RELEASE_TAG="$(cat .prev_release_tag)"
echo "🔄 Rolling back to ${RELEASE_TAG}"

# Pull previous images
echo "📥 Pulling images for tag ${RELEASE_TAG}..."
docker compose -f "${COMPOSE_FILE}" pull api tenent-dashboard super-admin customer-website

# Restart services
echo "🔄 Restarting services..."
docker compose -f "${COMPOSE_FILE}" up -d api tenent-dashboard super-admin customer-website

# Swap tag pointers
cp .prev_release_tag .current_release_tag

echo "✅ Rolled back to ${RELEASE_TAG}"
echo "📊 Running services:"
docker compose -f "${COMPOSE_FILE}" ps
