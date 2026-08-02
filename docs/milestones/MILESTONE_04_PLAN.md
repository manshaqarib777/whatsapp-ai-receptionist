# Milestone 4 — Database

Created: 2026-08-02
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 4`
Status: **Approved 2026-08-02.** Both open questions answered — branches are real
isolation boundaries, and the Tier 1 / Tier 2 split is accepted. See Open Questions for
the recorded answers.

---

## Objective

Design and migrate the persistent data model for the whole product, so that every
milestone from 5 onward adds features on top of a schema rather than reshaping one.

True after this milestone, and not true now:

- A `branches` table exists and every branch-scoped table carries `branch_id NOT NULL`,
  so Milestone 18 (Multi Branch) is a UI and permissions feature rather than a migration
  across the entire database.
- Tenant scoping is enforced in one place — a Prisma client extension — rather than by
  remembering a `where` clause at each of several hundred call sites.
- Soft delete, audit, history, and optimistic-lock versioning exist as reusable
  mechanisms with tests, not as conventions repeated per table.
- The right-to-erasure path is implemented and tested, and does not destroy the audit
  trail.
- `pgvector` is installed and a similarity query is proven against seeded data, so
  Milestone 7 is a retrieval feature and not an infrastructure change.
- `npm run db:seed` produces a database a person can demo from and a screenshot test can
  rely on: deterministic, multi-tenant, multi-branch, every conversation state.
- An ER diagram covering **all 25 milestones** is committed and rendered.

Measurable: migrations apply from empty to head in CI; the seed runs deterministically;
a cross-tenant read is proven impossible by test; `EXPLAIN ANALYZE` on the two hot
queries uses an index.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 4`:

```
Database

Design

Every table

Indexes

Relations

Constraints

Soft Delete

Audit Logs

History

Versioning

Create ER Diagram.

Generate migrations.

Seed dummy data.

Run tests.

STOP
```

---

## Architecture Decisions

### AD-1 — Tenancy is two-level, and both levels are `NOT NULL`

`organization_id` is already established as the tenant key: `prisma/schema.prisma:133`
designates `Organization` as **the** tenant and records the exemption from the
`tenant_id` naming in `DATABASE_RULES.md:61`. That is settled and this milestone
follows it — the rule file will be amended to say `organization_id`, since the word is
about to appear on roughly seventy tables.

Branch scoping is the new decision. Every org auto-provisions a `Main` branch on
creation, and branch-scoped tables carry `branch_id NOT NULL`.

**Rejected: nullable `branch_id`.** It looks cheaper and costs more — every query grows
an `OR branch_id IS NULL`, and single-branch and multi-branch orgs become two code paths
that must be kept in sync forever. With a mandatory default branch there is one shape.

**Rejected: defer branches to Milestone 18.** That milestone specifies "Separate
Calendars, Separate Knowledge, Separate AI." Retrofitting a scoping column onto a
populated schema means a migration touching every table plus a rewrite of every query,
which is precisely the cost this milestone exists to avoid.

Tier assignment rule — **if Milestone 18 calls it "separate," it is branch-scoped**:

| Scope | Tables |
|---|---|
| Org-level | plans, subscriptions, members, invitations, integration credentials, org settings, audit |
| Branch-level | conversations, messages, contacts, appointments, services, availability, knowledge base, AI config, campaigns, quotes, invoices |

### AD-2 — Tenant scoping is enforced by a Prisma client extension

`DATABASE_RULES.md:109` says a query returning another tenant's row is "a security
incident, not a defect." A guarantee at that level cannot rest on a convention. A
client extension injects `organization_id` (and `branch_id` where applicable) into every
query, and the repository layer takes a scope object it cannot construct itself.

**Rejected: Postgres RLS as the primary mechanism.** It is the right *defence in depth*
and `DATABASE_RULES.md:108` already asks for it, so it will be enabled — but as a second
layer. As the primary control it needs per-request role switching and session variables,
and it is invisible to the Vitest suite, so the isolation tests would prove nothing about
the code path the app actually takes.

### AD-3 — Money stays `numeric`, with four guardrails

`DATABASE_RULES.md:122` already specifies `numeric`, never `float`. That stands. The
risk is not the type but that "numeric" is under-specified:

1. **`numeric(15,4)`** — scale 4, not 2. Unit prices, percentage discounts, and VAT
   intermediates need sub-minor precision; rounding happens once, at the line and
   document total. Two decimals throughout yields totals that are off by a halala and
   do not reconcile.
2. **A `currency` column (ISO 4217) beside every amount.** A bare numeric does not say
   what it is. The minor-unit exponent is derived from the currency, never hardcoded —
   SAR has 2 decimal places but KWD, BHD, and OMR have **3**, and Milestone 12's gateway
   list (HyperPay, PayTabs, STC Pay) is GCC-facing.
3. **Minor-unit conversion happens in exactly one adapter.** Stripe and the regional
   gateways all take smallest-currency-unit integers. That conversion is a boundary
   concern, not something replicated across five integrations.
4. **Tax rate and computed tax amount are both stored on the line, at issue time.** A
   historical invoice is never recomputed from today's rate. Saudi VAT moved 5% → 15% in
   2020; a system that recomputes silently rewrites its own history.

### AD-4 — Soft delete and erasure are two different mechanisms

`DATABASE_RULES.md:66` says "never hard delete customer data." `DATABASE_RULES.md:182`
says deletion requests must have "a documented, tested path to purge a contact and their
messages." **Those two rules contradict each other**, and a schema cannot satisfy both
under one mechanism. Raised here rather than resolved silently; the rule file needs
amending either way.

Resolution — they are two features that were sharing a name:

- **Soft delete** (`deleted_at`) is a product feature: trash and restore. It is not
  erasure and no document will describe it as such.
- **Erasure** redacts PII columns in place — message body, contact name, phone, email,
  media pointers — sets `redacted_at`, and leaves the row skeleton, IDs, and timestamps
  intact.

Because `DATABASE_RULES.md:85` already forbids PII in audit payloads, the audit log
survives erasure untouched: it references a contact by ID, and that ID still resolves to
a redacted row. The trail stays provable and the personal data is genuinely gone. This is
pseudonymisation under GDPR Art. 4(5), and it also satisfies Saudi PDPL.

**Rejected: crypto-shredding** (per-subject key, destroy the key). Stronger, but it
costs key management and the ability to index those columns. Recorded as the upgrade
path if a customer contractually requires it.

### AD-5 — Embeddings live in Postgres via `pgvector`

`CREATE EXTENSION vector` in the first migration. HNSW index — better recall/latency
than IVFFlat at this scale and no training step.

**Rejected: a dedicated vector database.** A second datastore means a second source of
truth and a sync problem, for a retrieval workload Postgres handles comfortably at SMB
scale.

Two consequences to design in now rather than discover at Milestone 7:

- **Re-embedding must be executable.** The column needs a fixed dimension, but a model
  change invalidates every vector — embeddings from different models are not comparable.
  `embedding_model` and `dimensions` live on the chunk table so a model migration is a
  job, not a redesign.
- **Chunks reference a document *version*, not a document.** Milestone 7 requires
  versioning and approval, so retrieval must be able to see only approved versions. If
  chunks hang off the document, that constraint is inexpressible.

Prisma has no native vector type: the column is declared
`Unsupported("vector(1536)")` and queried through `$queryRaw` with tagged-template
parameters. That path is not type-safe through Prisma, which is normal and accepted —
noted so it is not mistaken for an oversight later.

### AD-6 — "Every table" is delivered as *design for all 25, migration for 5–14*

The PRD says "Every table." `MILESTONE_RULES.md:19` says "Never add features from future
milestones." These pull in opposite directions and the tension is real, so it is flagged
rather than silently resolved. **The PRD wins on scope** — but "design" and "migrate" are
separable, and the PRD asks for both an ER diagram *and* migrations as distinct
deliverables.

- **Tier 1 — designed and migrated now.** Everything milestones 5–14 need, plus branches
  (M18) and the cross-cutting mechanisms. These milestones have enough requirement
  surface to design correctly, and they are densely interlinked — an invoice references
  a quote references a deal references a contact references a conversation. Splitting
  that graph across milestones is what produces migration pain.
- **Tier 2 — designed in the ER diagram now, migrated at their own milestone.** Reviews
  (16), Loyalty (17), Integrations (19), Voice (20), AI Agents (21), Admin/Billing (22),
  GDPR request tracking (23). These are leaf features: they hold foreign keys *into* the
  spine, but nothing in the spine points back at them, so each arrives as one additive
  migration that breaks nothing.

The discriminator is mechanical, not a judgement call: **a table is Tier 1 if a Tier-1
table needs a foreign key to it, or if omitting it would change the shape of a Tier-1
table.** Otherwise it is Tier 2.

The honest argument for Tier 2 is not cost — empty tables are cheap. It is that
`Loyalty / Points / Membership / Coupons / Rewards / Referrals` is six words of
requirement. A schema invented from that will be wrong, will be migrated at Milestone 17
anyway, and will have spent the intervening thirteen milestones being maintained,
typechecked, and seeded as fiction. The ER diagram captures the design intent — which is
what protects the spine from surprises — without committing to invented columns.

**If you would rather have all ~75 tables migrated now, say so and I will do it.** It is
a legitimate reading of "Every table" and it is your call, not mine.

### AD-7 — Repository layer, per `DATABASE_RULES.md:30`

`Component → API → Service → Repository → Database`. Only repositories import the Prisma
client. A shared base repository supplies scope injection, the `deleted_at IS NULL`
filter, and the optimistic-lock check, so no individual repository can forget them.

---

## Dependencies

**New packages**

| Package | Justification |
|---|---|
| `@faker-js/faker` (dev) | Seed data with a fixed seed value. `DATABASE_RULES.md:205` requires determinism so screenshots and E2E are reproducible; hand-written fixtures at this volume are not maintainable. |

**Postgres extensions**: `vector` (pgvector), `pgcrypto` for `gen_random_uuid()` (may
already be present on PG 17 via `gen_random_uuid()` in core — verified during
implementation).

**Upstream milestones**: 1 (Prisma, Docker Postgres, CI Postgres service), 2 (identity
and tenancy tables), 3 (approved — no dependency, but its STOP is now cleared).

**External services**: none new. The hosting provider must support `pgvector` — see
Risks R-3.

---

## Database Impact

### New cross-cutting columns

Every Tier-1 business table:

```sql
id               uuid primary key default gen_random_uuid()
organization_id  uuid not null references organizations(id)
branch_id        uuid not null references branches(id)   -- branch-scoped tables only
created_at       timestamptz not null default now()
updated_at       timestamptz not null default now()
deleted_at       timestamptz                              -- user-facing tables
version          int not null default 1                   -- concurrently-edited entities
```

Contact- and message-bearing tables additionally carry `redacted_at timestamptz`
(AD-4).

### Tier 1 tables, by originating milestone

| Milestone | Tables |
|---|---|
| 4 (this) | `branches` |
| 5 Dashboard | `notifications`, `tasks` |
| 6 Inbox | `whatsapp_accounts`, `contacts`, `conversations`, `messages`, `message_attachments`, `labels`, `conversation_labels`, `conversation_notes` |
| 7 Knowledge Base | `knowledge_sources`, `knowledge_documents`, `knowledge_document_versions`, `knowledge_chunks`, `ingestion_jobs` |
| 8 AI Engine | `prompt_templates`, `prompt_template_versions`, `ai_runs`, `ai_run_citations` |
| 9 Appointments | `services`, `resources`, `availability_rules`, `availability_exceptions`, `appointments`, `appointment_reminders` |
| 10 CRM | `companies`, `pipelines`, `pipeline_stages`, `deals`, `tags`, `taggables`, `activities` |
| 11 Quotations | `quote_templates`, `quotes`, `quote_line_items`, `quote_versions` |
| 12 Invoices | `invoices`, `invoice_line_items`, `payments`, `refunds`, `payment_events` |
| 13 Workflows | `workflows`, `workflow_versions`, `workflow_runs`, `workflow_run_steps` |
| 14 Broadcast | `segments`, `whatsapp_message_templates`, `campaigns`, `campaign_recipients` |

Approximately 45 new tables. `audit_logs` is extended with the before/after diff
`DATABASE_RULES.md:83` requires — the current model carries only `metadata`.

**Naming note**: Milestone 6 calls the customer a Contact and Milestone 10 calls them a
Customer. These are one table — `contacts`, with a lifecycle stage — not two. Two tables
means two identities for the same person and a reconciliation problem at Milestone 10.

### Indexes

The four `DATABASE_RULES.md:130` mandates from day one, plus every foreign key and every
`WHERE`/`ORDER BY`/`JOIN` column. `organization_id` leads every composite index. Each
index justified individually in `/docs/database/schema-change.md`, since indexes cost
write throughput.

Two that need `EXPLAIN ANALYZE` evidence before merge, per `DATABASE_RULES.md:170`:
conversation list ordered by `last_message_at`, and message history paged by cursor.

### Constraints

- `NOT NULL` by default; every nullable column justified in the schema-change doc.
- Foreign keys with explicit `ON DELETE`. Default `RESTRICT` — cascade only where the
  child is genuinely owned by the parent (line items, attachments, versions).
- `CHECK` constraints for enums and ranges.
- **`uq_messages_organization_id_whatsapp_message_id`** — this is what makes webhook
  processing idempotent under Meta's retries.
- **Partial unique indexes for soft delete**: `... WHERE deleted_at IS NULL`. Without
  this a soft-deleted contact permanently blocks its phone number from re-registering,
  and a restore collides — `DATABASE_RULES.md:80`.

### Migration strategy

One logical change per migration (`DATABASE_RULES.md:148`), ~10 migrations grouped by
domain, not one monolith. Order: extensions → branches and backfill → contacts and
channels → inbox → knowledge → AI → appointments → CRM → quotes and invoices →
workflows and broadcast.

The one migration with existing data to consider is branches: organizations already
exist, so it is expand → backfill → constrain. Add `branch_id` nullable, create a `Main`
branch per existing org, backfill, then set `NOT NULL`.

### Rollback plan

There is no production deployment, so rollback for migrations 2–10 is `migrate reset`
against a local or CI database. Stated plainly because it is true now and will not be
true after Milestone 25 — the expand → migrate → contract discipline in
`DATABASE_RULES.md:151` is followed regardless, so the habit is in place before it is
load-bearing.

Full detail goes in `/docs/database/schema-change.md` before any migration is generated.

---

## API Impact

**None.** This milestone adds no route handlers. The repository and service layers it
creates are internal; nothing is exposed over HTTP until Milestone 5.

---

## UI Impact

**None.** No screens, no components. The seed data exists so that Milestone 5's screens
have something real to render, but no UI is built here.

---

## AI Impact

**No prompts, tools, or model calls in this milestone.** Two pieces of groundwork:
`pgvector` and the `knowledge_chunks` shape determine what Milestone 7's retrieval can
do, and `ai_runs` is where Milestone 8's token and cost accounting will land — which is
also what Milestone 22's "AI Usage" reads from.

Token/cost estimate: zero. No inference runs here.

---

## Security Considerations

| Area | Consideration |
|---|---|
| Tenant isolation | The central risk of the milestone. Enforced by client extension (AD-2), backed by RLS, and **proven by test** — a repository call scoped to org A attempting to read org B's row must fail, not merely return empty. |
| Branch isolation | Same mechanism, second level. Milestone 18 makes it user-visible; the enforcement is built now. |
| PII | Message bodies, contact names, phone numbers, email. `SECURITY_RULES.md:86` and AD-4. No PII in audit diffs; no PII in seed data. |
| Right to erasure | Implemented and tested this milestone, not deferred. A documented path purges a contact and their messages via redaction. |
| Media | WhatsApp Cloud API media URLs expire, so attachments must be copied to blob storage on receipt. `DATABASE_RULES.md:179` forbids blobs in Postgres, so `message_attachments` stores a storage key. The fetch step belongs to Milestone 6; the column shape is decided here. |
| Secrets | Integration credentials are Tier 2, but the ER diagram marks them as encrypted-at-rest so the decision is not made casually at Milestone 19. |
| Raw SQL | pgvector queries use `$queryRaw` with tagged-template parameters only. String-concatenated SQL is forbidden (`DATABASE_RULES.md:163`) and the vector path is the one place it would be tempting. |

---

## Testing Strategy

**Unit**
- Scope-injection extension: adds the predicate, and cannot be bypassed.
- Money helpers: rounding at 4 decimals, minor-unit conversion for 2- and 3-decimal
  currencies, VAT computed and stored rather than derived.
- Redaction: every PII column cleared, skeleton and IDs retained.

**Integration** (real Postgres — CI already provides the service container)
- **Tenant isolation**: org A cannot read, update, or soft-delete org B's rows. Asserted
  per repository, not once globally.
- **Branch isolation**: the same, one level down.
- Soft delete: excluded from reads by default; restorable; partial unique index permits
  re-creating a soft-deleted contact's phone number.
- Optimistic locking: a stale write is rejected with 409 rather than clobbering.
- Audit: append-only — the repository exposes no update or delete path, and a direct
  attempt fails.
- Erasure: the contact's messages are redacted, and the audit trail still resolves.
- `pgvector`: similarity search returns seeded chunks in the expected order.
- Migrations apply cleanly from empty to head.
- Seed is deterministic: two runs against a fresh database produce identical content.

**Component**: none — no UI in this milestone.

**E2E**: no new specs. The existing 118 must still pass, and CI must migrate and seed
before they run.

**Performance**: `EXPLAIN ANALYZE` on conversation-list and message-history against
seeded volume, asserting index use rather than a sequential scan.

**Edge cases that must be proven**, from `DATABASE_RULES.md:196`: a very long message, an
attachment, an emoji-only message, a failed delivery, a right-to-left name, a
60-character company name, an opted-out contact, appointments across timezones.

---

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Tenancy shape wrong — branch retrofitted later | Low | **Critical** — migration across every table plus a query rewrite | AD-1: two-level, `NOT NULL`, from the first migration |
| R-2 | Cross-tenant leak from a forgotten `where` | Medium | **Critical** — security incident per `DATABASE_RULES.md:109` | AD-2 single enforcement point + per-repository isolation tests + RLS |
| R-3 | Hosting provider does not support `pgvector` | Low | High — Milestone 7 blocked, or a second datastore forced | **Verify before migration 1 is written.** Neon, Supabase, and RDS all support it |
| R-4 | Tier-2 deferral rejected, or leaf schemas guessed wrong | Medium | Medium — rework at the owning milestone | AD-6, flagged for approval now; ER diagram captures intent either way |
| R-5 | Seed data too thin, so milestones 5, 6, and 15 are unreviewable | Medium | High — compounds across every later milestone | Treat the seed as a first-class deliverable with the acceptance list in `DATABASE_RULES.md:193`, not a closing checkbox |
| R-6 | No preview environment — Definition of Done unmeetable for the third milestone running | **High** | Medium — the DoD becomes something that is waived by habit | Provision Vercel previews with a per-preview database (Neon branching) *before* this milestone closes. The seed factory is what makes that database useful |
| R-7 | Index gaps surface only at production volume | Medium | Medium | `EXPLAIN ANALYZE` gate on the two hot queries; seed at realistic volume, not 10 rows |
| R-8 | `audit_logs` diff payload leaks PII | Low | High — regulatory | Column-level allow-list, plus a test asserting known PII fields never appear in a diff |

---

## Open Questions

Two need an answer before migrations are generated. Everything else in this plan I will
proceed on.

1. ~~**Are branches real isolation boundaries?**~~ **Answered 2026-08-02: yes, real
   isolation boundaries, not labels.** AD-1 stands as written — `branch_id NOT NULL` on
   every branch-scoped table, auto-provisioned `Main` branch per organization, and
   branch scoping enforced in the same client extension as organization scoping (AD-2)
   and proven by its own isolation tests.
2. ~~**Tier 1 + Tier 2, or all ~75 tables migrated now?**~~ **Answered 2026-08-02:
   tiering approved.** AD-6 stands — the ER diagram covers all ~75 tables across all 25
   milestones; migrations create the ~45 Tier-1 tables (milestones 5–14 plus
   `branches`). Tier-2 tables are created by one additive migration each, at the
   milestone that owns them. The scaffolding-only variant was considered and rejected:
   a table with no feature columns protects the graph no better than the diagram does,
   while still carrying a Prisma model, a repository, and isolation tests.

Both questions are now answered. No blocking questions remain; implementation proceeds.

---

## Deliverables Checklist

- [ ] `/docs/database/schema-change.md` — written **before** the first migration
- [ ] ER diagram covering all 25 milestones, Mermaid `erDiagram`, committed under
      `/docs/database/` so it version-controls and renders in review
- [ ] `prisma/schema.prisma` — Tier 1 models
- [ ] ~10 migrations, one logical change each
- [ ] Scope-injection client extension + base repository
- [ ] `prisma/seed.ts` — deterministic, meeting `DATABASE_RULES.md:193` in full
- [ ] Tests per Testing Strategy
- [ ] `DATABASE_RULES.md` amended: `organization_id` naming, and the soft-delete /
      erasure contradiction in AD-4
- [ ] `CHANGELOG.md` entry
- [ ] `MILESTONE_04_PROGRESS.md` maintained throughout
- [ ] `MILESTONE_04_COMPLETED.md`
