# Schema Change — Milestone 1 (Initial)

Date: 2026-08-01
Migration: `prisma/migrations/20260801001459_init`
Status: Applied (local)

---

## New Tables

### `health_checks`

Infrastructure table. Its only purpose is to prove that migrations apply and that the
Prisma client round-trips against a real database.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary key, `gen_random_uuid()` default |
| `checked_at` | `timestamptz` | `NOT NULL`, `now()` default |

---

## Relations

None. This table is intentionally standalone.

---

## Indexes

Primary key only.

No additional indexes: the table holds a handful of rows and is never queried by a
predicate. `.claude/DATABASE_RULES.md` requires each index to be justified — there is
no justification for one here.

---

## Rule Exemption — `tenant_id`

`.claude/DATABASE_RULES.md` requires `tenant_id NOT NULL` on every table.
`health_checks` is **exempt** because it stores no tenant data and is never read in a
tenant-scoped context.

**This is not a precedent.** Every business table from Milestone 2 onward carries
`tenant_id`, and the exemption is recorded here so that it is visible rather than
inferred from the schema.

---

## Deliberately Not Created

Tenants, users, sessions, conversations, messages, contacts, audit logs.

Those belong to Milestone 2 (Authentication) and Milestone 4 (Database). Creating them
now would be implementing future-milestone scope, which `RULES.md` §2 forbids.

---

## Migration Strategy

| Environment | Command |
|---|---|
| Local | `npm run db:migrate` (`prisma migrate dev`) |
| CI / Production | `npm run db:deploy` (`prisma migrate deploy`) |

Prisma 7 note: the connection URL lives in `prisma.config.ts` for the CLI and is
supplied to `PrismaClient` through the `@prisma/adapter-pg` driver adapter at runtime.
`url` is no longer permitted in `schema.prisma`.

---

## Rollback Plan

This is the initial migration and the table holds no business data.

**Rollback:** drop the database and re-run migrations.

```bash
npm run db:down
docker volume rm docker_war_postgres_data
npm run db:up
npm run db:deploy
```

For any environment holding real data, the rollback is the standard one: restore from
backup, then replay migrations to the target version. That path is exercised and
documented in Milestone 25 (Production), where backups are configured.

---

## Verification

Covered by `src/features/health/tests/health.integration.test.ts`:

- The `health_checks` table exists in `information_schema`.
- A row round-trips: create → read → delete.
- `SELECT 1` succeeds against the live connection.

These tests **fail** rather than skip when the database is unreachable.
