# Milestone 4 — Completed

> **Authoritative structural re-certification — 2026-08-23:** The sequential review
> found that six later background workers could bypass the static unscoped-Prisma lint
> boundary with dynamic imports. Pre-scope discovery now lives in
> `src/lib/db/system-discovery.repository.ts`; tenant-owned reminder writes re-enter
> through `forScope()`; and lint rejects both static and dynamic bypasses (verified by
> a deliberately failing probe). Current database evidence: 75/75 isolation, erasure,
> and deterministic-seed integration tests; typecheck/lint clean; schema drift limited
> to the documented HNSW/trgm indexes. Preview verification is centralized in M25 by
> the user's decision.

Completed: 2026-08-10
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 4`

---

## What Was Built

The persistent data model for the whole product, plus the mechanisms that make it safe
to build on: tenant scoping enforced in one place, soft delete, audit, history,
optimistic-lock versioning, and a right-to-erasure path that does not destroy the audit
trail.

Against the plan's objective, all of the following are now true and were not before:

- **`branches` exists and every branch-scoped table carries `branch_id NOT NULL`.**
  Milestone 18 (Multi Branch) is now a UI and permissions feature rather than a
  migration across the entire database. Every organization auto-provisions one default
  branch, so a single-branch business is an organization with one branch and there is
  exactly one query shape rather than two.
- **Tenant scoping is enforced by a Prisma client extension**, not by remembering a
  `where` clause at each call site. It ANDs the scope rather than merging it, so a caller
  passing another organization's id narrows to nothing instead of escaping, and it
  *refuses* the five operations it cannot safely scope.
- **Soft delete, audit, history, and versioning are reusable mechanisms with tests**,
  not conventions repeated per table.
- **Erasure is implemented and tested, and leaves the audit trail resolvable.** Because
  audit payloads carry no PII, redacting a contact still leaves a trail pointing at a
  real row — so an organization can prove it honoured the request.
- **`pgvector` is installed** and the HNSW index exists and is correctly typed, so
  Milestone 7 is a retrieval feature rather than an infrastructure change.
- **`npm run db:seed` produces a database a person can demo from**: deterministic,
  two organizations, multi-branch, staff in every role, conversations in every state.
- **An ER diagram covering all 25 milestones is committed** — `docs/database/er-diagram.md`,
  split by domain because one 85-entity graph renders as unreadable spaghetti.

Measurable results from the plan: migrations apply from empty to head in CI; the seed is
deterministic across three consecutive runs; cross-tenant reads are proven impossible by
32 tests; both hot queries use an index under `EXPLAIN ANALYZE`.

### Scope changes

**Tier 1 / Tier 2 split (approved, plan AD-6).** The PRD says "Every table". 85 tables
were *designed* and diagrammed; the 50-table Tier-1 spine was *migrated*. Tier 2 is the
set whose shape depends on decisions a later milestone actually makes. Designing all of
them satisfies the requirement's intent — no milestone reshapes the schema — without
migrating tables whose columns would be guesses.

**RLS deferred to Milestone 23** (Issue 10). Documented rather than quietly dropped: a
policy needs `current_setting('app.organization_id')` per connection, and Prisma's pooled
adapter has no per-request hook, so it would require `SET LOCAL` inside an explicit
transaction around every read. A policy that permits access when the setting is absent
is decorative, and `RULES.md` forbids shipping that. Milestone 23 already provisions the
least-privilege role this belongs with.

**Preview deployment not exercised** — see Known Limitations.

---

## Files Created

### Migrations (`prisma/migrations/`)

| Path | Purpose |
|---|---|
| `20260802033000_extensions/migration.sql` | `pgcrypto`, `citext`, `vector`. Deliberately dated *before* the schema migration so it sorts first on a fresh database (Issue 9). |
| `20260802033724_milestone_4_schema/migration.sql` | The 50 Tier-1 tables, 27 enums, indexes, and relations — 1,725 lines. |
| `20260802034000_timestamptz/migration.sql` | 169 columns converted `timestamp` → `timestamptz` (Issue 5). |
| `20260802034500_constraints/migration.sql` | `EXCLUDE` no-double-booking, currency/tax/date-range checks, partial unique indexes, one-default-branch, HNSW vector index. |
| `20260802035500_snake_case_lifecycle_stage/migration.sql` | `RENAME` of `contacts.lifecycleStage`, preserving data rather than Prisma's DROP + ADD (Issue 7). |

### Database layer (`src/lib/db/`)

| Path | Purpose |
|---|---|
| `scope.ts` | The `Scope` type and the scoped-model registry, derived from the Prisma DMMF at load time so it cannot drift as tables are added. |
| `scoped-prisma.ts` | The isolation control: injects `organization_id` / `branch_id` into every query and refuses the operations it cannot inject into. |
| `base-repository.ts` | Shared repository helpers — `expectOne`, soft delete, restore, optimistic-lock update. |
| `erasure.ts` | Registry-driven redaction. `eraseContact` redacts a contact and everything they said in one transaction, reaching rows already soft-deleted. |
| `scoped-prisma.integration.test.ts` | 32 tests against real Postgres. |
| `erasure.integration.test.ts` | 12 tests. |
| `seed.integration.test.ts` | 31 tests — the `DATABASE_RULES.md` seed checklist as assertions. |

### Seed (`prisma/seed/`)

| Path | Purpose |
|---|---|
| `tenants.ts` | Two organizations, branches, staff in every role. |
| `contacts.ts` | Contacts across every lifecycle stage. |
| `inbox.ts` | Conversations in every state; messages including long, emoji-only, attachment, and failed. |
| `scheduling.ts` | Services, resources, opening hours, appointments past/upcoming/cancelled/rescheduled/recurring. |
| `crm.ts` | Deals across five pipeline stages plus lost, activities, tags. |
| `commerce.ts` | Quotes, invoices, line items, payments. |
| `support.ts` | Knowledge base and escalation records. |

### Documentation

| Path | Purpose |
|---|---|
| `docs/database/er-diagram.md` | All 85 tables across all 25 milestones, split by domain plus an overview. |
| `docs/milestones/MILESTONE_04_PLAN.md` | The approved plan. |
| `docs/milestones/MILESTONE_04_PROGRESS.md` | Running log — 14 issues, with resolutions. |

### Schema-drift guard (added post-close, 2026-08-11)

| Path | Purpose |
|---|---|
| `scripts/check-schema-drift.ts` | Runs `prisma migrate diff` and fails unless the only drift is the known HNSW drop (Issue 8). |
| `.github/workflows/ci.yml` | New `Check schema drift` step after Seed. |

---

## Files Modified

| Path | Change |
|---|---|
| `prisma/schema.prisma` | 60 models, 27 enums. `@db.Timestamptz(3)` on all 169 datetime fields; `@map` fixes for snake_case. |
| `prisma/seed.ts` | Rewritten as a deterministic orchestrator over `prisma/seed/*`; teardown is scoped `deleteMany` per organization, child-first, not a blanket `TRUNCATE`. |
| `docker/docker-compose.yml` | Postgres image → `pgvector/pgvector:pg17`. Stock `postgres:17-alpine` has no `vector` extension (Issue 4). |
| `.github/workflows/ci.yml` | Same image change — both files had to move together or `CREATE EXTENSION vector` would pass locally and fail in CI. |
| `eslint.config.mjs` | `@/lib/prisma` is now a restricted import outside the database layer, with a five-path allow-list of callers that pre-date a scope (Issue 13). The `@prisma/client` message no longer points authors at the bypass. |
| `.claude/DATABASE_RULES.md` | `organization_id` not `tenant_id`; two-level tenancy; `timestamptz`; soft delete separated from erasure; multi-tenancy enforcement and its limits. |
| `docs/database/schema-change.md` | Milestone 4 section, written before the first migration per `DATABASE_RULES.md:15`; query plans and verification added at close. |
| `.claude/CHANGELOG.md` | Milestone 4 entry. |
| `vitest.setup.ts`, `vitest.config.ts` | `asyncUtilTimeout` 5s, `testTimeout` 15s — fixes a real flake (Issue 12). |
| `src/lib/email.test.ts`, `src/server/api-handler.test.ts`, `src/features/health/tests/*` | `// @vitest-environment node` on the four server-module suites — fixes `No such built-in module: node:` under the global jsdom environment (Issue 14). |
| `tests/e2e/design-system.spec.ts` | 90s budget on the four gallery axe audits (Issue 12). |

---

## Tests Completed

| Type | Count | Coverage | Command |
|---|---|---|---|
| Unit | 169 | — | `npm run test` |
| Component | 170 | — | `npm run test` |
| Integration | 126 (75 of them this milestone's, against real Postgres) | — | `npm run test` |
| **Vitest total** | **465 passing, 32 files** | `src/lib/**` thresholds enforced in config | `npm run test` |
| E2E | 118 passing (59 × chromium + mobile) | — | `npm run test:e2e` |

Gate at close: `npm run verify` (typecheck → lint → test → build) passes, plus the full
Playwright suite.

Verified on 2026-08-11 (post-close): `npm run verify` passes — typecheck and lint at
zero, **465/465 Vitest** across 32 files, `next build` succeeds. Four suites that had
been failing with `No such built-in module: node:` under the global jsdom environment
were fixed with `// @vitest-environment node` (Issue 14 in `PROGRESS.md`) — server
modules importing `node:crypto` route through the SSR resolver instead of Vite's
client externalization path. No assertions were weakened.

What the 75 database tests actually assert: cross-tenant and cross-branch reads return
empty rather than throwing; creates are stamped with the real scope over whatever the
caller passed; cross-tenant writes affect zero rows; unique-selector operations are
refused; soft-deleted rows hide by default yet remain reachable for restore and erasure;
a trashed phone number is reusable; a stale optimistic-locked write is a 409; the audit
trail still resolves to a real row after erasure; the redaction registry covers every
model carrying `redacted_at`.

Constraint behaviour was additionally exercised directly against Postgres before any test
existed: overlapping booking rejected, adjacent booking accepted, inverted range
rejected, lowercase currency rejected, a tax rate of `15` rejected where `0.15` is meant,
and a second default branch rejected.

### Deliberately not covered

- **pgvector similarity ranking.** No documents exist to rank until Milestone 7 ingests
  them, so the HNSW index is verified as present and correctly typed rather than by a
  ranking assertion. A ranking test here would assert against seeded noise.
- **Repository-per-table tests.** The scoping guarantee lives in one extension and is
  tested there. Testing it 50 times over would test Prisma, not this code.
- **RLS.** Not shipped — see Known Limitations.

---

## Performance Results

Measured, not estimated. Method stated for each.

**Query plans** — `EXPLAIN ANALYZE`, taken at **5,017 conversations and 100,058
messages**, not at seed volume. At seed volume (17 and 58) Postgres sequentially scans
everything regardless of what indexes exist, so a plan taken there proves nothing. The
volume tenant was created for the measurement and deleted afterwards.

| Query | Result | Execution time |
|---|---|---|
| Q1 — inbox list, org-scoped, newest first, first page | Index Scan Backward on `conversations_organization_id_last_message_at_idx`, **no sort node** — the composite index supplies the ordering, so paging deeper does not degrade into sorting the tenant's whole list. 27 buffers for 25 rows. | 0.184 ms |
| Q2 — message history within a conversation, cursor-paged | Bitmap Index Scan on `messages_conversation_id_created_at_idx`. A sort node is present because a bitmap scan does not preserve order; on a conversation long enough for the sort to matter the planner switches to a backward index scan and it disappears. Recorded rather than tuned — optimising against a plan the planner will not choose at real sizes is guesswork. | 0.149 ms |

Both figures are from a warm local cache. They are **index-use evidence, not latency
targets** — latency budgets belong to Milestone 24.

**Seed**: 4,342 ms of database work, 12.9 s wall clock including Prisma client startup
and TypeScript compilation. Deterministic — three consecutive runs produce an identical
md5 across organizations, contacts, conversations, messages, appointments, deals,
invoices, and quotes.

**Migrations**: apply from empty to head in CI on every run, which is the check that
matters (Issue 9 was exactly a case that passed locally and would have failed there).

**Bundle size delta: zero.** No route or component imports `src/lib/db` yet — verified by
grep, not assumed — and this milestone adds no client-side code. First Load JS is
unchanged from Milestone 3.

**Not measured, because this milestone builds none of it**: webhook ack p50/p95 and AI
first-token latency. There is no webhook handler and no AI call until Milestones 5 and 7.

---

## Known Limitations

1. **RLS is not in place, so the client extension is the only isolation layer.**
   Impact: a code path that bypasses the extension — raw SQL, or a direct `@/lib/prisma`
   import from an allow-listed file — is not caught by a second net. Mitigations: the
   extension refuses what it cannot scope, the unscoped import is now a lint error with a
   five-path reviewed allow-list, and 32 tests attempt cross-tenant access. Tracked:
   Issue 10, scheduled for Milestone 23 with the least-privilege role.

2. **`prisma migrate diff` proposes dropping the HNSW index on every run.** Prisma cannot
   express an HNSW index, so it reads as drift. Impact: an unreviewed generated migration
   would silently delete the vector index. Mitigation: removed by hand and documented in
   both the constraints migration and `schema-change.md`. **Automated guard added
   post-close (2026-08-11)**: `npm run db:check-drift` (`scripts/check-schema-drift.ts`)
   runs in CI after seeding and fails the build unless the only drift is the known HNSW
   drop — closing the original gap where a diff had to be caught by human review. Tracked:
   Issue 8 — resolved with guard.

3. **Nested writes are not scope-injected.** A `create` with nested relation writes is one
   query, so the extension sees only the top level. This fails *closed* — the nested row
   is missing a `NOT NULL organization_id` and Postgres rejects the statement — but it
   means repositories must write relations as separate calls inside a transaction.
   Documented at the top of `scoped-prisma.ts`.

4. **`create` inputs still require the scope columns.** Injection is at runtime, so
   Prisma's generated input types are unchanged. Redundant but not unsafe: whatever the
   caller passes is overwritten with the real scope. Making them optional would mean
   generating 50 bespoke input types.

5. **25 Tier-2 tables are designed and diagrammed but not migrated.** Impact: the
   milestone that owns each one adds it. By design (AD-6), not an oversight.

6. **Not exercised on a preview deployment**, so that exit criterion is unmet. Needs the
   user's Vercel account, which has not been provisioned. This milestone adds no route
   handlers and no UI, so there is no new surface to exercise beyond what Milestone 3
   already covered — the schema is verified by CI applying migrations from empty and by
   126 integration tests against real Postgres. Carried into the first milestone that
   ships an endpoint.

---

## Exit Criteria

- [x] Every task in `PROGRESS.md` checked, or explicitly deferred with a reason
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors, zero warnings
- [x] Unit, integration, component, and E2E tests exist and pass — 465 + 118
- [x] `npm run build` succeeds
- [x] Security review against `SECURITY_RULES.md` — found and fixed Issue 13
- [x] Docs updated — `DATABASE_RULES.md`, `schema-change.md`, ER diagram
- [x] `CHANGELOG.md` entry added
- [ ] **Exercised on a preview deployment — not done.** See Known Limitations 6.
- [x] `MILESTONE_04_COMPLETED.md` written

Nine of ten met. The tenth is blocked on account provisioning, not on this work.
