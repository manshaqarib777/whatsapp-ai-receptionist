# Database Rules

**Postgres + Prisma.** Local Postgres runs in Docker. `prisma/schema.prisma` is the
single source of truth for the schema; migrations are generated from it, never
hand-applied.

Milestone 4 owns the full schema design: every table, indexes, relations, constraints,
soft delete, audit logs, history, versioning, an **ER diagram**, generated migrations,
and seeded dummy data.

---

## Before Any Database Change

Create `/docs/database/schema-change.md` explaining:

- New tables
- Relations
- Indexes
- Migration strategy
- Rollback plan

**Never directly modify production schema.** All changes go through a reviewed,
versioned migration.

---

## No Direct Database Access

```
Forbidden:  Component → Database

Allowed:    Component → API → Service → Repository → Database
```

- Only repositories import the DB client or write SQL.
- Services call repositories. Services never build queries.
- No ORM calls in controllers, hooks, or components.

---

## Naming

```
tables            snake_case, plural         conversations, messages
columns           snake_case                 created_at, tenant_id
primary key       id                         uuid
foreign key       <table_singular>_id        conversation_id
booleans          is_ / has_                 is_escalated, has_consent
timestamps        _at                        created_at, delivered_at
indexes           idx_<table>_<cols>         idx_messages_conversation_id
unique            uq_<table>_<cols>
```

---

## Every Table Requires

```sql
id           uuid primary key default gen_random_uuid()
tenant_id    uuid not null references tenants(id)
created_at   timestamptz not null default now()
updated_at   timestamptz not null default now()
```

Plus `deleted_at timestamptz` on anything user-facing — soft delete, never hard delete
customer data.

---

## Soft Delete, Audit, History, Versioning

Required by the PRD (Milestone 4). Design these in from the start — retrofitting them
across 20 features is not viable.

**Soft delete**
- `deleted_at timestamptz` on every user-facing table.
- Every read filters `deleted_at IS NULL` by default. A repository that forgets this is
  a data-leak bug — enforce it in a shared base query, not per call site.
- Unique constraints must account for it, or a restored row collides.

**Audit log**
- Append-only `audit_logs`: actor, tenant, entity, entity id, action, before/after
  diff, IP, timestamp.
- Never updated, never deleted. No PII in the diff payload.
- Written for: auth events, permission changes, settings changes, human takeover,
  outbound sends, exports, deletions, billing changes.

**History**
- Entities that users reason about over time (quotes, invoices, knowledge-base
  articles, workflow definitions) keep row-level history in a `<entity>_versions`
  table. Do not overwrite and hope the audit log is enough.

**Versioning**
- `version int not null default 1` on concurrently-edited entities, incremented on
  write, checked on update. Reject stale writes with 409 rather than silently
  clobbering a colleague's edit.

---

## Multi-Tenancy

- `tenant_id` on **every** table. `NOT NULL`. Indexed, and first in composite indexes.
- Every query filters by `tenant_id`. A repository method without a `tenantId`
  parameter is a bug.
- `tenant_id` is derived server-side from the session or the WhatsApp phone number id.
  **Never** from a request body.
- Enable RLS as defence in depth. Application-level scoping is still mandatory.
- A query that can return another tenant's row is a security incident, not a defect.

---

## Constraints

Enforce invariants in the database, not only in code:

- `NOT NULL` by default; nullable requires justification.
- Foreign keys always, with explicit `ON DELETE` behaviour.
- `CHECK` constraints for enums and ranges.
- Unique constraint on `(tenant_id, whatsapp_message_id)` — this is what makes webhook
  processing idempotent under Meta's retries.
- Money as `numeric`, never `float`. Timestamps as `timestamptz`, always UTC.

---

## Indexes

Index every foreign key and every column used in a `WHERE`, `ORDER BY`, or `JOIN`.

Required from day one:
```
idx_conversations_tenant_id_last_message_at
idx_messages_conversation_id_created_at
uq_messages_tenant_id_whatsapp_message_id
idx_contacts_tenant_id_phone_number
```

Justify each index in the schema-change doc — indexes cost write throughput.
Use `CREATE INDEX CONCURRENTLY` for existing large tables.

---

## Migrations

- `prisma migrate dev` locally, `prisma migrate deploy` in CI/production. Never
  `db push` outside a throwaway local database, and never against a shared one.
- Forward-only, versioned, committed. Never edit an applied migration.
- One logical change per migration.
- Every migration has a tested rollback plan documented, even if the rollback is
  "restore from backup and replay".
- Expand → migrate → contract for anything breaking:
  1. Add the new nullable column, deploy.
  2. Backfill in batches, deploy dual-write.
  3. Switch reads, deploy.
  4. Drop the old column in a later migration.
- Never `DROP` a column or table in the same release that stops using it.
- Test every migration on a branch database with production-shaped volume first.

---

## Queries

- Parameterised always. Raw SQL only via `$queryRaw` with tagged-template parameters —
  string-concatenated SQL is forbidden.
- `select` explicit columns. Never return the whole model by default, and never leak a
  column the caller did not ask for.
- Every list endpoint is paginated. Cursor-based for message history.
- No N+1: use `include`/`select` or a batched query. Prisma's lazy relations make N+1
  the default failure mode — verify with query logs, not by inspection.
- `EXPLAIN ANALYZE` any query on `messages` or `conversations` before merging.
- `$transaction` for multi-write operations. Keep them short — never hold a transaction
  across an AI call or an HTTP request.

---

## Data Retention & PII

- Message bodies are customer PII. See `SECURITY_RULES.md`.
- Store the minimum. No storing media blobs in Postgres — reference blob storage.
- Retention policy per tenant, enforced by a scheduled job, documented in
  `/docs/database/`.
- Opt-out and deletion requests must be executable: a documented, tested path to purge
  a contact and their messages.
- Seeds and fixtures use synthetic data only. Never a copy of production.

---

## Seed Data

The PRD's definition of done requires **dummy data covering realistic business
scenarios**. A seed of `user1 / test test` does not satisfy it.

`prisma/seed.ts` must produce a database someone can demo from:

- Multiple tenants, and at least one with multiple branches.
- Users across every role, so RBAC is visible.
- Conversations in every state: unread, assigned, escalated, resolved, archived —
  with realistic message volume and timestamps spread over weeks, not all `now()`.
- Contacts with and without consent, including an opted-out contact.
- Appointments past, upcoming, cancelled, rescheduled, recurring, across timezones.
- Enough CRM, quote, and invoice records that charts and funnels render meaningfully.
- Deliberate edge cases: a very long message, an attachment, an emoji-only message,
  a failed delivery, a right-to-left name, a 60-character company name.

Deterministic — a fixed seed, so screenshots and E2E tests are reproducible.
Synthetic throughout: no real phone numbers, no real customer text.
