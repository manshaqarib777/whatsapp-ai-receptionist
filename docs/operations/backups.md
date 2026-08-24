# Database backups and restore verification

Milestone 23 supplies local, provider-neutral PostgreSQL procedures. This is tooling,
not a claim that a production schedule exists. A production operator must configure
encrypted storage, schedule, retention, monitoring, and restore drills in the chosen
platform before launch.

## Create a backup

Set `DATABASE_URL` through the environment and choose an absolute path outside the
repository:

```bash
npm run db:backup -- /secure/backups/war-2026-08-24.dump
```

The script uses PostgreSQL custom format, excludes ownership/privileges, applies a
restrictive umask, and creates a SHA-256 checksum beside the dump. Encrypt the dump
with the organization-approved KMS before copying it off-host. Never commit a dump.
The `pg_dump`/`pg_restore` client major version must match the server major version;
use the database container or provider-supplied client when the host client is older.

## Verify a restore

Create an empty disposable database whose name ends in `_restore_test`, then run:

```bash
npm run db:verify-restore -- /secure/backups/war-2026-08-24.dump \
  postgresql://localhost:5433/war_restore_test
```

The suffix guard prevents accidental restoration over a normal database. The verifier
checks the checksum, restores with `--exit-on-error`, and proves completed migrations
are readable. Inspect application invariants, then explicitly drop only that disposable
database.

## Production policy required before deployment

- Daily encrypted backups, point-in-time recovery where supported, 30-day rolling
  retention, geographically separate copy, and access limited to the recovery role.
- Alert on missed backups and checksum failures. Never include credentials in alert text.
- Quarterly restore drills into isolated infrastructure, recording recovery time and
  recovery point. A backup that has not restored successfully is unverified.
- Rotation/deletion must follow legal holds and privacy obligations.
