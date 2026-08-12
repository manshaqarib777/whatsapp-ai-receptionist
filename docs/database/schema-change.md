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

---

# Schema Change — Milestone 4 (Database)

Date: 2026-08-02
Plan: `docs/milestones/MILESTONE_04_PLAN.md` (approved)
Design: `docs/database/er-diagram.md` — 85 tables across all 25 milestones
Status: In progress

## Scope

50 new Tier-1 tables — everything milestones 5–14 need, plus `branches`. The 25 Tier-2
tables are designed in the ER diagram and migrated at their own milestone, per plan
AD-6.

## Infrastructure Change — Postgres image

`postgres:17-alpine` → `pgvector/pgvector:pg17`, in both `docker/docker-compose.yml` and
`.github/workflows/ci.yml`.

Stock Postgres does not ship the `vector` extension. Verified before writing any
migration, per plan risk R-3:

```
before:  btree_gist 1.7, pgcrypto 1.3
after:   btree_gist 1.7, pgcrypto 1.3, vector 0.8.6
```

Same Postgres 17 major version, so the existing data volume carried over untouched — all
11 tables and the `_prisma_migrations` history survived the swap, verified rather than
assumed. No reset was required and none was performed.

Both images had to change together. Had only the local one changed, `CREATE EXTENSION
vector` would have succeeded locally and failed in CI.

## Extensions

| Extension | For |
|---|---|
| `vector` | Knowledge-base embeddings (`knowledge_chunks.embedding`), HNSW index |
| `btree_gist` | Appointment overlap prevention — an exclusion constraint mixing `uuid` equality with `tstzrange` overlap needs GiST support for the scalar column |
| `pgcrypto` | `gen_random_uuid()` — available in PG 17 core, declared explicitly rather than relied on implicitly |

## New Tables

Grouped by originating milestone. Column detail and rationale are in
`docs/database/er-diagram.md`; this section records counts and the decisions a reviewer
needs to check.

| Milestone | Count | Tables |
|---|---|---|
| 4 | 1 | `branches` |
| 5 | 2 | `notifications`, `tasks` |
| 6 | 8 | `whatsapp_accounts`, `contacts`, `conversations`, `messages`, `message_attachments`, `labels`, `conversation_labels`, `conversation_notes` |
| 7 | 5 | `knowledge_sources`, `knowledge_documents`, `knowledge_document_versions`, `knowledge_chunks`, `ingestion_jobs` |
| 8 | 4 | `prompt_templates`, `prompt_template_versions`, `ai_runs`, `ai_run_citations` |
| 9 | 6 | `services`, `resources`, `availability_rules`, `availability_exceptions`, `appointments`, `appointment_reminders` |
| 10 | 7 | `companies`, `pipelines`, `pipeline_stages`, `deals`, `tags`, `taggables`, `activities` |
| 11 | 4 | `quote_templates`, `quotes`, `quote_line_items`, `quote_versions` |
| 12 | 5 | `invoices`, `invoice_line_items`, `payments`, `refunds`, `payment_events` |
| 13 | 4 | `workflows`, `workflow_versions`, `workflow_runs`, `workflow_run_steps` |
| 14 | 4 | `segments`, `whatsapp_message_templates`, `campaigns`, `campaign_recipients` |

**Total: 50.**

## Modified Tables

| Table | Change | Why |
|---|---|---|
| `audit_logs` | Add `diff jsonb` | `DATABASE_RULES.md:83` requires a before/after diff; the Milestone 2 model carries only `metadata`. Column-level allow-list keeps PII out. |
| `organizations` | Add `branches` relation | Every org auto-provisions a `Main` branch. |

## Relations

Full graph in the ER diagram. The `ON DELETE` policy is the part that needs review:

| Policy | Applied to | Reasoning |
|---|---|---|
| `Cascade` | Children genuinely owned by a parent: line items, attachments, versions, run steps, campaign recipients, availability rules | The child is meaningless without the parent and has no independent identity. |
| `Restrict` | Everything else — the default | Deleting a contact that has invoices must fail loudly, not silently erase financial records. |
| `SetNull` | `conversations.assignee_id`, `audit_logs.actor_id` | A departing user must not take conversations or audit history with them. |

Business deletion is soft (`deleted_at`), so these policies mostly govern genuine hard
deletion — which for customer data happens only through the erasure path.

## Indexes

Every foreign key, and every column used in `WHERE`, `ORDER BY`, or `JOIN`.
`organization_id` leads every composite index, per `DATABASE_RULES.md:103`.

The four mandated from day one by `DATABASE_RULES.md:130`:

```
idx_conversations_organization_id_last_message_at
idx_messages_conversation_id_created_at
uq_messages_organization_id_whatsapp_message_id
idx_contacts_organization_id_phone_number
```

Additional indexes needing individual justification, since each costs write throughput:

| Index | Justification |
|---|---|
| `idx_messages_organization_id_created_at` | Cursor pagination on message history across a branch, not just one conversation. |
| `hnsw (embedding vector_cosine_ops)` on `knowledge_chunks` | Similarity search. HNSW over IVFFlat: better recall/latency and no training step. |
| `idx_knowledge_chunks_branch_id` | Branches have separate knowledge (M18); every retrieval filters on it. |
| `idx_appointments_branch_id_starts_at` | Calendar views are always a branch plus a date range. |
| `idx_ai_runs_organization_id_created_at` | M22 reads AI usage by org over a period. |
| `idx_campaign_recipients_campaign_id_status` | Delivery dashboards group by status within a campaign. |
| `idx_workflow_run_steps_scheduled_for` | The delay-node scheduler polls for due steps across all runs. Partial: `WHERE status = 'pending'`. |

## Constraints

- `NOT NULL` by default. Nullable columns each justified in the ER diagram —
  `resources.user_id` (a treatment room has no login) and the optional FKs between
  quote → deal and invoice → quote are the main ones.
- `CHECK` constraints for every status/enum column, restricting to the documented set.
- **`uq_messages_organization_id_whatsapp_message_id`** — makes webhook processing
  idempotent under Meta's retries (`DATABASE_RULES.md:120`).
- **Gateway idempotency**: unique `payments.gateway_payment_id` and
  `payment_events.gateway_event_id`. Five gateways all retry.
- **Partial unique indexes for soft delete**, `... WHERE deleted_at IS NULL`. Without
  these a soft-deleted contact permanently blocks its phone number and a restore
  collides (`DATABASE_RULES.md:80`). Applies to `contacts.phone_number`,
  `branches.slug`, `quotes.number`, `invoices.number`, `labels.name`, `tags.name`.
- **Exactly one default branch per org**: partial unique index on
  `(organization_id) WHERE is_default AND deleted_at IS NULL`.
- **Appointment overlap**: `EXCLUDE USING gist (resource_id WITH =, tstzrange(starts_at,
  ends_at) WITH &&) WHERE (status IN ('booked','confirmed') AND deleted_at IS NULL)`.
  Double-booking is prevented by the database, not by an application check that races
  under concurrency. This is why `btree_gist` is required.
- **Money**: `numeric(15,4)` with a sibling `*_currency` column, per plan AD-3. Never
  `float`.

## Deviations From `DATABASE_RULES.md`

Recorded explicitly rather than slipped in.

1. **Polymorphic references on `taggables` and `activities`** break "foreign keys always"
   (`:118`). A tag applies to contacts, deals, and conversations; a join table per target
   is three tables now and six later. Mitigated by a `CHECK` on the type column
   restricting it to the known set, and an index on `(taggable_type, taggable_id)`. The
   cost is no referential integrity on that column — accepted, and flagged to the user.
2. **`workflow_versions.definition` is JSON**, not normalised into node and edge tables.
   A visual builder saves the whole graph atomically; normalising buys integrity nobody
   queries and costs a multi-table transaction per save. The version row provides the
   auditability that is the actual requirement.
3. **`tenant_id` is named `organization_id`** (`:61`). Already established at Milestone 2
   — `prisma/schema.prisma:133` designates `Organization` as the tenant. The rule file is
   being amended to match rather than the schema being bent to a name better-auth owns.
4. **Hard deletion exists, for erasure only.** `:66` says never hard delete customer
   data; `:182` requires a purge path. These contradict. Resolved per plan AD-4: soft
   delete is trash-and-restore, erasure is redaction in place. No customer row is ever
   `DELETE`d; PII columns are overwritten and `redacted_at` set. The rule file needs
   amending either way.

## Migration Strategy

**Planned as ten domain migrations; delivered as five.** Recorded as a deviation rather
than quietly re-scoped.

The plan split the work by domain (inbox, knowledge, AI, …) on the reasoning that "one
logical change per migration" (`DATABASE_RULES.md:148`) meant one domain per migration.
That does not survive contact with Prisma: `migrate dev` diffs the whole schema at once,
so ten domain migrations would mean editing `schema.prisma` down to one domain, migrating,
adding the next, and repeating — with the cross-domain relations (`Organization` alone
declares 40 back-relations) making the intermediate states invalid. The intermediate
migrations would be fiction, all applied together in one deploy, none independently
revertible because the foreign keys span them.

What was delivered instead is split by genuine dependency order, which is what the rule is
actually protecting:

| # | Migration | Why it is separate |
|---|---|---|
| 1 | `20260802033000_extensions` | `vector` and `btree_gist` types must exist before any table or constraint uses them |
| 2 | `20260802033724_milestone_4_schema` | The 50 tables. One `CREATE`-only unit, no data touched |
| 3 | `20260802034000_timestamptz` | 169 columns to `TIMESTAMPTZ(3)` — a distinct correction, and it touches the Milestone 1 and 2 tables too |
| 4 | `20260802034500_constraints` | Partial indexes, CHECKs, and the EXCLUDE constraint; must follow table creation |
| 5 | `20260802035500_snake_case_lifecycle_stage` | A naming fix, independently revertible |

**A timestamp ordering trap worth knowing about.** Prisma names migration folders from the
system clock, and migrations apply in lexicographic order. `extensions` was first created
by hand as `20260802090000` — a time later that day — which sorted it *after* the
generated schema migration. Locally it had already applied, so everything worked; on a
fresh CI database the schema migration would have run first and `CREATE TABLE ...
vector(1536)` would have failed. Renamed to `20260802033000` with the history row updated
in place. Any hand-created migration folder must be dated relative to the generated ones,
not to the wall clock.

`branches` needed no expand → backfill → contract after all: every branch-scoped table is
created empty in the same migration, so `branch_id NOT NULL` is vacuously satisfied. The
sequence is still documented in the plan so the pattern is established before Milestone
25, when it becomes load-bearing against real data.

## Rollback Plan

No production deployment exists. Per migration, rollback is `prisma migrate reset`
against a local or CI database, then `db:deploy` to the target.

The one migration that would need a real rollback if this were live is #2 — dropping
`branches` after a backfill loses the branch assignment. For a live environment the
sequence is: restore from backup, replay to migration 1, redeploy the previous
application version. Exercised properly in Milestone 25; recorded now so it is not
invented under pressure.

The image change is independently reversible: revert both files to `postgres:17-alpine`.
Only migration 1 depends on it, and the volume is compatible in both directions.

## Query Plans

`DATABASE_RULES.md:170` requires `EXPLAIN ANALYZE` on any query against `messages` or
`conversations` before merging.

Measured against **5,017 conversations and 100,058 messages**, not against the seed. At
seed volume (17 and 58) Postgres sequentially scans everything regardless of what
indexes exist, so a plan taken there proves nothing. The volume tenant was created for
the measurement and deleted afterwards; the row counts above and below confirm it.

**Q1 — inbox list, organization-scoped, newest first, first page**

```
Limit (actual time=0.036..0.115 rows=25)
  ->  Index Scan Backward using conversations_organization_id_last_message_at_idx
        Index Cond: (organization_id = $1)
        Filter: (deleted_at IS NULL)
        Buffers: shared hit=27
Execution Time: 0.184 ms
```

Index scan, and critically **no sort node** — the composite index supplies the ordering,
so paging deeper does not degrade into sorting the tenant's whole conversation list.
27 buffers for 25 rows.

**Q2 — message history within a conversation, cursor-paged**

```
Limit (actual time=0.101..0.104 rows=20)
  ->  Sort  (Sort Method: quicksort  Memory: 26kB)
        ->  Bitmap Heap Scan on messages
              ->  Bitmap Index Scan on messages_conversation_id_created_at_idx
                    Index Cond: ((conversation_id = $1) AND (created_at < $2))
Execution Time: 0.149 ms
```

Index used. The sort node is present because a bitmap scan does not preserve order, and
Postgres chose bitmap over a plain index scan at 20 rows per conversation. On a
conversation long enough for the sort to matter, the planner switches to a backward
index scan and the sort disappears. Recorded rather than tuned: optimising against a
plan the planner will not choose at real sizes would be guesswork.

Both are comfortably inside any reasonable budget. The figures are from a warm local
cache and are index-use evidence, not latency targets — those belong to Milestone 24.

## Verification

- `src/lib/db/scoped-prisma.integration.test.ts` — 32 tests. Cross-tenant and
  cross-branch reads return empty rather than throwing, creates are stamped with the
  real scope over whatever the caller passed, cross-tenant writes affect zero rows,
  unique-selector operations are refused, soft-deleted rows hide by default and are
  reachable for restore and erasure, a trashed phone number is reusable, and a stale
  optimistic-locked write is a 409.
- `src/lib/db/erasure.integration.test.ts` — 12 tests, including that the audit trail
  still resolves to a real row after erasure and that the redaction registry covers
  every model carrying `redacted_at`.
- `src/lib/db/seed.integration.test.ts` — 31 tests turning the `DATABASE_RULES.md` seed
  checklist into assertions, plus four asserting the data is synthetic.
- Constraint behaviour was additionally exercised directly against Postgres before any
  test existed: overlapping booking rejected, adjacent booking accepted, inverted range
  rejected, lowercase currency rejected, a tax rate of `15` rejected where `0.15` is
  meant, and a second default branch rejected.
- Seed determinism: three consecutive runs produce an identical md5 across
  organizations, contacts, conversations, messages, appointments, deals, invoices, and
  quotes.

Not covered here: pgvector similarity ordering has no data to rank until Milestone 7
ingests documents, so the HNSW index is verified as present and correctly typed rather
than by a ranking assertion.
