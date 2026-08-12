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
id               uuid primary key default gen_random_uuid()
organization_id  uuid not null references organizations(id)
branch_id        uuid not null references branches(id)   -- branch-scoped tables
created_at       timestamptz not null default now()
updated_at       timestamptz not null default now()
```

**The tenant column is `organization_id`, not `tenant_id`.** There is no `tenants`
table: `organizations` **is** the tenant (`prisma/schema.prisma` → `Organization`), a
name Better Auth owns and that is not worth fighting. Amended in Milestone 4, when the
word was about to appear on fifty tables.

**Tenancy is two levels.** `branch_id` is `NOT NULL` on every branch-scoped table, and
every organization auto-provisions one default branch — so a single-branch business is
an organization with one branch, and there is exactly one query shape rather than two.
Milestone 18 makes branches user-visible; the isolation boundary exists from Milestone
4. Org-level tables (billing, members, integration credentials) carry no `branch_id`.

**Timestamps are `timestamptz`, and Prisma will not do this for you.** `DateTime` maps
to `timestamp(3)` *without* time zone unless the field is annotated
`@db.Timestamptz(3)`. Every one must be.

Plus `deleted_at timestamptz` on anything user-facing — see below, and note that soft
delete is **not** erasure.

---

## Soft Delete, Audit, History, Versioning

Required by the PRD (Milestone 4). Design these in from the start — retrofitting them
across 20 features is not viable.

**Soft delete is not erasure.** These are two mechanisms that were sharing one name,
and an earlier version of this file demanded both "never hard delete customer data" and
a path to "purge a contact and their messages" — which no single mechanism satisfies.
Separated in Milestone 4:

- **Soft delete** (`deleted_at`) is a product feature: trash and restore. Never
  describe it as erasure, and never offer it as the answer to a deletion request.
- **Erasure** (`redacted_at`) overwrites the PII columns in place and leaves the row
  skeleton, its ids, and its timestamps. Because audit payloads carry no PII, the trail
  still resolves to a real row afterwards — so the organization can prove it honoured
  the request. A hard delete would leave that trail dangling.

Erasure is driven by a registry of redactable columns (`src/lib/db/erasure.ts`), not a
hardcoded list, because later milestones add PII-bearing tables. A test fails if a
model carrying `redacted_at` is not registered.

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

- `organization_id` on **every** business table. `NOT NULL`. Indexed, and first in
  composite indexes. `branch_id` too, on branch-scoped tables.
- Every query filters by it. This is **not** left to each author: the scope is injected
  by a Prisma client extension (`src/lib/db/scoped-prisma.ts`), and repositories take a
  `Scope` they cannot construct themselves. A guarantee this important cannot rest on
  remembering a `where` clause several hundred times.
- The extension **refuses** `findUnique`, `findUniqueOrThrow`, `update`, `delete`, and
  `upsert` on scoped models. Prisma will not accept a tenant predicate alongside a
  unique selector, so those operations cannot be scoped and could return another
  tenant's row. Use `findFirst` / `updateMany` / `deleteMany` with `expectOne`.
- The scope is **ANDed**, never merged, so a caller passing another organization's id
  narrows the result to nothing rather than escaping.
- The registry of which models are scoped is derived from the Prisma DMMF at load time,
  not hand-written — a table added later is scoped the moment it has the column, and an
  omitted table would be an unscoped table.
- Scope is derived server-side from the session row or the WhatsApp phone number id.
  **Never** from a request body.
- Two things bypass the extension and must scope themselves: raw `$queryRaw` (the
  pgvector path), and nested writes — the latter fail closed on a `NOT NULL` violation.
- **Importing `@/lib/prisma` outside the database layer is a lint error.** That client is
  unscoped, so importing it steps around the extension entirely and the whole control
  becomes advisory. The exceptions are allow-listed by path in `eslint.config.mjs`, and
  every one of them runs *before* a scope exists — session resolution, organization
  creation, the liveness probe. Adding a path there is a security decision. A feature
  module is never a valid entry.
- Since RLS is not yet in place, the extension is the **only** isolation layer, not one
  of two. Weigh changes to it accordingly.
- RLS as defence in depth is **deferred to Milestone 23**, where a least-privilege
  database role is already in scope. Prisma's pooled driver adapter has no per-request
  hook, so a policy would need `SET LOCAL` inside an explicit transaction around every
  read; a policy that passes when the setting is absent blocks nothing.
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
- Opt-out and deletion requests must be executable: `eraseContact` in
  `src/lib/db/erasure.ts` redacts a contact and everything they said, in one
  transaction, and reaches rows that were already soft-deleted. This is the purge path
  — soft delete is not it.
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
