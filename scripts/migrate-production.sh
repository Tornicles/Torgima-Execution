#!/usr/bin/env bash
# BHUDHI PROMPT 37 — Production migration (Drizzle, not Prisma)
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Starting production migration..."

if command -v pg_dump >/dev/null 2>&1; then
  BACKUP="backup_$(date +%Y%m%d_%H%M%S).sql"
  echo "Creating database backup: $BACKUP"
  pg_dump "$DATABASE_URL" > "$BACKUP"
else
  echo "WARN: pg_dump not found — skipping backup"
fi

echo "Running Drizzle migrations..."
pnpm db:migrate

echo "Applying supplemental Bhudhi indexes (scripts/db-setup.sql)..."
if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db-setup.sql
else
  echo "WARN: psql not found — run scripts/db-setup.sql manually"
fi

echo "Migration complete."
