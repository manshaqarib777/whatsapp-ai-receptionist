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

---

# Schema Change — Milestone 2 (Authentication)

Date: 2026-08-01
Migration: `prisma/migrations/20260801021835_auth`
Status: Applied (local)

## New Tables

| Table | Purpose |
|---|---|
| `users` | Identity. Global, not tenant-scoped. |
| `sessions` | Active logins + `active_organization_id`, IP, user agent |
| `accounts` | Credential and OAuth provider links (`password` holds the hash) |
| `verifications` | Email verification, password reset, magic-link tokens |
| `two_factors` | TOTP secret and backup codes |
| `organizations` | **The tenant** |
| `members` | User ↔ organization with `role` — where RBAC lives |
| `invitations` | Pending invites with expiry |
| `audit_logs` | Append-only security event log |

## Relations

```
User 1─n Session          onDelete: Cascade
User 1─n Account          onDelete: Cascade
User 1─n TwoFactor        onDelete: Cascade
User 1─n Member           onDelete: Cascade
User 1─n Invitation       onDelete: Cascade  (as inviter)
User 1─n AuditLog         onDelete: SetNull  (history survives user deletion)

Organization 1─n Member      onDelete: Cascade
Organization 1─n Invitation  onDelete: Cascade
Organization 1─n AuditLog    onDelete: Cascade
```

`AuditLog.actorId` uses `SetNull` rather than `Cascade` deliberately: deleting a user
must not erase the record of what they did.

## Indexes

Every foreign key is indexed, plus:

| Index | Reason |
|---|---|
| `users.email` (unique) | Sign-in lookup; prevents duplicate accounts |
| `sessions.token` (unique) | Session resolution on every request |
| `sessions.expires_at` | Expired-session sweep |
| `accounts (provider_id, account_id)` (unique) | Prevents duplicate OAuth links |
| `organizations.slug` (unique) | URL resolution |
| `members (organization_id, user_id)` (unique) | One membership per user per org |
| `audit_logs (organization_id, created_at)` | The primary audit query — scoped and ordered |
| `audit_logs (actor_id, created_at)` | "What did this user do?" |
| `verifications.identifier`, `.expires_at` | Token lookup and expiry sweep |

## The `tenant_id` Rule — Exemptions

`DATABASE_RULES.md` requires `tenant_id NOT NULL` on every table. That cannot apply
literally to the tables which *define* tenancy. The exemptions, with reasons:

| Table | Why exempt |
|---|---|
| `organizations` | **It is the tenant.** Its own `id` is the tenant id. |
| `users` | Global. One person may belong to several organizations. |
| `sessions`, `accounts`, `verifications`, `two_factors` | Hang off the user, not off a tenant. |
| `health_checks` | Infrastructure (Milestone 1). |

**Tenant-scoped tables** carry `organization_id NOT NULL`: `members`, `invitations`.
`audit_logs.organization_id` is nullable because some events (signup, failed sign-in)
occur before any organization context exists.

**Every business table from Milestone 4 onward carries `organization_id NOT NULL`.**
This list is the complete set of exemptions; it is not a precedent for new tables.

## Better Auth Generated Schema

The auth models originate from `npx @better-auth/cli generate` but are **not** used as
emitted. The generator produces camelCase columns, no `@map`/`@@map`, and no indexes —
all of which violate `DATABASE_RULES.md`. Every model was mapped by hand and indexed.

**Regenerating overwrites those mappings.** Generate to a scratch file and merge:

```bash
npx @better-auth/cli generate --config src/lib/auth.ts --output prisma/generated-auth.prisma
# then merge by hand into prisma/schema.prisma, preserving @map/@@map and indexes
```

## Rollback Plan

No production data exists. Drop in reverse dependency order:

```sql
DROP TABLE IF EXISTS audit_logs, invitations, members, two_factors,
                     verifications, accounts, sessions, organizations, users CASCADE;
```

Then re-run `npm run db:deploy`. For an environment holding real data, restore from
backup and replay to the target migration — exercised in Milestone 25.

## Verification

`src/features/auth/tests/tenant-isolation.integration.test.ts` (17 tests) and
`audit-log.integration.test.ts` (25 tests) run against real Postgres and prove
cross-tenant isolation, last-owner protection, privilege-escalation refusal, and that
the audit log is append-only and PII-free.
