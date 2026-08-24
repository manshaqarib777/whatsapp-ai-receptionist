#!/usr/bin/env bash
set -euo pipefail

backup_path="${1:-}"
restore_url="${2:-}"
if [[ -z "$backup_path" || -z "$restore_url" ]]; then
  echo "Usage: npm run db:verify-restore -- /absolute/path/backup.dump postgresql://.../name_restore_test" >&2
  exit 64
fi
if [[ "$restore_url" != *"_restore_test"* ]]; then
  echo "Refusing restore: disposable database URL must end in _restore_test." >&2
  exit 64
fi

sha256sum --check "${backup_path}.sha256"
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname "$restore_url" "$backup_path"
psql "$restore_url" --no-psqlrc --tuples-only --command "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;"
echo "Restore verified. Drop the explicitly named disposable database when review is complete."
