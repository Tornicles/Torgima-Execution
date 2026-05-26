#!/usr/bin/env bash
# BHUDHI PROMPT 37 — Production database backup
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required"
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump is required"
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-backups}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/bhudhi_backup_$DATE.sql"

mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
gzip -f "$BACKUP_FILE"

find "$BACKUP_DIR" -name "bhudhi_backup_*.sql.gz" -mtime +30 -delete 2>/dev/null || true

echo "Backup created: ${BACKUP_FILE}.gz"
