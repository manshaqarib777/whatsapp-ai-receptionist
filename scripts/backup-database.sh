#!/usr/bin/env bash
set -euo pipefail

backup_path="${1:-}"
if [[ -z "$backup_path" ]]; then
  echo "Usage: npm run db:backup -- /absolute/path/war-YYYYMMDD.dump" >&2
  exit 64
fi
if [[ "$backup_path" != /* || "$backup_path" == / || -d "$backup_path" ]]; then
  echo "Backup target must be an absolute file path." >&2
  exit 64
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 78
fi

umask 077
# Prisma commonly appends `?schema=public`; libpq tools reject that Prisma-only
# parameter. The application currently permits only the default public schema.
database_url="${DATABASE_URL%%\?schema=*}"
pg_dump --format=custom --no-owner --no-privileges --file "$backup_path" "$database_url"
sha256sum "$backup_path" > "${backup_path}.sha256"
chmod 600 "$backup_path" "${backup_path}.sha256"
echo "Backup and checksum created at the requested path."
