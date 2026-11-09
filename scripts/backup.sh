#!/usr/bin/env bash
# Full database backup with pg_dump (custom format, compressed) into ./backups/.
# Uses BACKUP_DATABASE_URL, else DATABASE_URL. Prefer Neon's direct (non "-pooler") connection string for dumps.
# Restore into an EMPTY database with:  pg_restore --no-owner --clean --if-exists -d "<target url>" backups/<file>.dump
# Backups hold members' personal and health data: keep them encrypted and out of git (./backups is ignored).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${BACKUP_DATABASE_URL:-}${DATABASE_URL:-}" ] && [ -f .env.local ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2-)"
fi
URL="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
[ -n "$URL" ] || { echo "Set BACKUP_DATABASE_URL or DATABASE_URL." >&2; exit 1; }
command -v pg_dump >/dev/null || { echo "pg_dump not found. Install the PostgreSQL client tools (version 17 or newer)." >&2; exit 1; }
mkdir -p backups
FILE="backups/repcount-$(date -u +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$URL"
chmod 600 "$FILE"
pg_restore --list "$FILE" > /dev/null   # fails if the dump is unreadable
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"
# Keep the 14 newest backups.
ls -1t backups/repcount-*.dump | tail -n +15 | xargs -r rm -f
