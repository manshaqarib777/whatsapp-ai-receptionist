# Milestone 4 — Progress

Status: Complete — structurally re-certified 2026-08-23
Started: 2026-08-02
Last updated: 2026-08-23

Plan: `MILESTONE_04_PLAN.md` (approved 2026-08-02, both open questions answered).

## 2026-08-23 Sequential Review

- [x] Rechecked the schema, migrations, model classification, erasure registry,
      isolation tests, direct-client imports, seed, drift guard, and completion claims.
- [x] Replaced six dynamic unscoped-client imports in workers with a reviewed
      database-layer system repository.
- [x] Extended lint enforcement to reject dynamic imports of `@/lib/prisma`; verified
      with a failing stdin probe rather than assuming the selector worked.
- [x] Re-ran isolation/erasure/seed tests (75/75), schema drift (known HNSW/trgm only),
      typecheck, lint, and diff checks.

## Completed Tasks

- [x] `MILESTONE_04_PLAN.md` written and approved — `6cf84ed`
- [x] Branch isolation confirmed as a real boundary; AD-1 ratified unchanged
- [x] Tier 1 / Tier 2 split approved; AD-6 ratified, scaffolding variant rejected
- [x] ER diagram covering all 25 milestones — `docs/database/er-diagram.md`
- [x] `/docs/database/schema-change.md` — Milestone 4 section, written before the
      first migration as `DATABASE_RULES.md:15` requires
- [x] Postgres image moved to `pgvector/pgvector:pg17` in docker-compose **and** CI;
      existing volume carried over intact, no reset
- [x] `prisma/schema.prisma` — 50 Tier-1 models, 27 enums, 60 models total
- [x] Migrations applied: extensions, schema, timestamptz, constraints, snake_case fix
- [x] Constraints verified functionally, not just by existence: overlap rejected,
      adjacent booking accepted, inverted range rejected, lowercase currency rejected,
      percent-not-fraction tax rate rejected, soft-deleted phone number reusable,
      second default branch rejected

- [x] Scope-injection Prisma client extension + base repository helpers —
      `src/lib/db/`, 32 integration tests against real Postgres
- [x] ESLint now permits `@prisma/client` in `src/lib/db/**` only (it is the database
      layer); everywhere else the existing restriction stands

- [x] Erasure (redaction) path — `src/lib/db/erasure.ts`, registry-driven, 12 tests
- [x] RLS decision made and documented (deferred to Milestone 23 — see Issue 10)
- [x] `prisma/seed.ts` + `prisma/seed/*` — deterministic, meeting `DATABASE_RULES.md`
      seed requirements in full — `b69b296`
- [x] Tests per the plan's Testing Strategy — 75 database tests; full suite 465 passing
- [x] `EXPLAIN ANALYZE` evidence for both hot queries, taken at 5,017 conversations /
      100,058 messages rather than at seed volume — `docs/database/schema-change.md`
- [x] `DATABASE_RULES.md` amendments — `organization_id` naming, two-level tenancy,
      `timestamptz`, soft-delete vs erasure, multi-tenancy enforcement
- [x] `CHANGELOG.md` entry
- [x] Security review against `SECURITY_RULES.md` — found and fixed Issue 13
- [x] Unscoped-client import is now a lint error with a reviewed allow-list — Issue 13
- [x] Two pre-existing test flakes fixed rather than retried — Issue 12
- [x] `MILESTONE_04_COMPLETED.md`

## Pending Tasks

- [ ] ~~RLS policies as defence in depth~~ — **deferred to Milestone 23**, see Issue 10
- [ ] Preview environment (plan risk R-6) — **deferred**: needs the user's Vercel
      account, which has not been provisioned. This milestone adds no route handlers and
      no UI, so there is no surface to exercise on a preview beyond what Milestone 3
      already covered. Carried into the first milestone that ships an endpoint.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | `DATABASE_RULES.md:66` forbids hard deletion; `:182` requires a purge path for deletion requests. Directly contradictory. | Resolved | Plan AD-4 separates soft delete from erasure, implements erasure as redaction in place, and the rule file now documents that distinction. |
| 2 | PRD "Every table" pulls against `MILESTONE_RULES.md:19` "never add features from future milestones" | Resolved | Tiering approved 2026-08-02. Design all, migrate the Tier-1 spine. Plan AD-6. |
| 3 | Table count is 85, not the ~75 estimated in the plan | Resolved | Counted precisely while drawing the ER diagram: 10 existing, 50 Tier 1, 25 Tier 2. The plan's estimate was made before the derivation; the diagram is authoritative. |
| 4 | `postgres:17-alpine` does not ship pgvector — plan risk R-3, hitting locally before it could hit a host | Resolved | Moved to `pgvector/pgvector:pg17` in both docker-compose and CI. Same PG 17 major, so the volume carried over: all 11 tables and the migration history survived, verified rather than assumed. Both files had to change together or `CREATE EXTENSION vector` would pass locally and fail in CI. |
| 5 | **169 timestamp columns were `timestamp without time zone`**, violating `DATABASE_RULES.md:122` ("always `timestamptz`") | Resolved | Prisma maps `DateTime` to `timestamp(3)` unless told otherwise. Pre-existing since Milestone 1 — every table was affected, not just Milestone 4's. `@db.Timestamptz(3)` added to all 169 fields; the two `@db.Time()` opening-hour columns correctly left alone. For a product whose core feature is scheduling across timezones this was a serious latent defect. |
| 6 | Found #5 only because the appointment `EXCLUDE` constraint failed with "functions in index expression must be marked IMMUTABLE" | Resolved | `tstzrange(timestamp, timestamp)` needs a TimeZone-dependent cast, so Postgres refused the index. `tstzrange` itself is IMMUTABLE — the constraint was a canary for the column types, not the cause. Worth recording: the constraint paid for itself before it ever ran in production. |
| 7 | `contacts.lifecycleStage` was created camelCase, against `DATABASE_RULES.md:46` | Resolved | Missing `@map`. Found by an insert in the smoke test, then swept for with `information_schema.columns WHERE column_name ~ '[A-Z]'` — it was the only one. Migrated as a `RENAME`, not Prisma's generated DROP + ADD, which discards data. |
| 8 | `prisma migrate diff` proposes dropping the HNSW index on every run | Resolved (2026-08-11) | Prisma cannot express an HNSW index, so it reads as drift. Removed from the generated migration by hand and documented in both the constraints migration and `schema-change.md`. **Automated guard added post-close**: `npm run db:check-drift` (`scripts/check-schema-drift.ts`) runs the diff in CI after seeding and fails the build unless the *only* drift is the known HNSW drop — so an unreviewed generated migration can no longer silently delete the vector index. |
| 10 | RLS cannot be shipped honestly in this milestone | **Deferred to Milestone 23** | A policy needs `current_setting('app.organization_id')` per connection. Prisma 7's `PrismaPg` adapter pools connections with no per-request hook, so it can only be set via `SET LOCAL` inside an explicit transaction — wrapping every read in one, at a latency cost. A policy that permits access when the setting is absent is decorative and forbidden by `RULES.md` §"No placeholder shipping"; RLS without `FORCE` exempts the owning role, which is the role the app uses. The primary control (AD-2) is implemented with 32 passing isolation tests. Milestone 23 already provisions a least-privilege role, which is where this belongs. |
| 11 | Generated Prisma client went stale after the `lifecycle_stage` rename and every db test failed | Resolved | `db:generate` reads `schema.prisma`, not the database, so it must be re-run after a schema edit even when migrations already applied. CI already orders `db:generate` before `db:deploy`, so CI was never at risk — this was a local-only trap. |
| 9 | Prisma migration timestamps are generated from the system clock, and a hand-created folder dated in the future sorted after the generated one | Resolved | `20260802090000_extensions` would have run *after* the schema migration on a fresh database, so `CREATE TABLE ... vector(1536)` would fail in CI while passing locally. Renamed to `20260802033000_extensions` and the history row updated in place — a surgical rename, not a reset. |
| 12 | Three auth component tests and two gallery E2E tests failed in the full suite but passed alone — flaky, which `TESTING_RULES.md:118` forbids leaving | Resolved | Both were under-provisioned wait budgets, reproduced deliberately rather than assumed: the component tests failed 6/6 runs under CPU contention with `push` at **0 calls**, because a mocked promise resolved but React did not flush state inside testing-library's 1s `asyncUtilTimeout`. The gallery axe audits cost 14–21s on an idle machine against a 30s default, so a second worker tipped them over. Fixed by setting `asyncUtilTimeout` to 5s (`vitest.setup.ts`), `testTimeout` to 15s, and a 90s budget on the four gallery audits. Verified by re-running the exact load that failed: 6/6 clean, then 118/118 E2E. No assertion was weakened and no retry was added — `retries: 0` still stands. |
| 13 | **`@/lib/prisma` was not restricted anywhere, so Milestone 4's entire isolation control was bypassable** — and the existing lint message told authors to import it | Resolved | Found by the `SECURITY_RULES.md` review, not by a test. `scoped-prisma.ts` claimed the boundary was "enforced by an ESLint rule"; only `@prisma/client` was restricted, and its message read "Import the shared client from `@/lib/prisma`" — actively directing people around `forScope()`. With RLS deferred (Issue 10) this extension is the *only* isolation layer, so an unenforced boundary meant any Milestone 5+ feature could query unscoped with nothing failing. Added `@/lib/prisma` to `no-restricted-imports` with a path allow-list of the five callers that genuinely pre-date a scope, and verified the rule actually errors on a probe file. The same review found `scoped-prisma.ts` asserting "Postgres RLS is enabled as a second layer (see the RLS migration)" — no such migration exists; corrected to state it is the only layer. |
| 14 | Four pre-existing suites failed under Vite 8: `email.test.ts`, `api-handler.test.ts`, and both health tests — `Error: No such built-in module: node:` | Resolved | `vitest.config.ts` sets `environment: 'jsdom'` globally, and jsdom maps to Vite's *client* environment, where `node:crypto` imports are externalized for browser compatibility and then fail to load ("No such built-in module: node:"). Only the four suites importing server modules (`@/lib/email`, `@/server/api-handler`, `@/app/api/health/route`) were affected — they need no DOM APIs. Fixed with `// @vitest-environment node` on each, routing them through the SSR resolver where `node:` builtins resolve natively. Verified by reproducing with a bare `import { createHash } from 'node:crypto'` (fails under jsdom, passes under node) before fixing. Full suite is green again: 465/465, matching the count recorded at close. |
| 15 | Six later background workers bypassed the static unscoped-Prisma import restriction with dynamic imports; the reminder worker also performed tenant-owned reads/writes globally. | Resolved | Added `system-discovery.repository.ts` as the explicit pre-scope seam, returned organization IDs with discovered work, rebound reminder writes through `forScope()`, and added a `no-restricted-syntax` guard for dynamic imports. A real lint probe proves the guard fails closed. |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-02 | Branches are real isolation boundaries; `branch_id NOT NULL` from the first migration | Milestone 18 specifies separate calendars, knowledge, and AI per branch; confirmed by the user | Nullable `branch_id` — two query shapes forever. Deferring to M18 — a migration across every table |
| 2026-08-02 | ER diagram split by domain rather than one 85-entity graph | A single diagram of this size renders as unreadable spaghetti; per-domain diagrams plus an overview are navigable | One monolithic diagram |
| 2026-08-02 | `contacts` is one table, not Contact (M6) and Customer (M10) | Two tables means two identities for the same person and a reconciliation problem at Milestone 10 | Separate `contacts` and `customers` |

## Database Changes

| Migration | Description | Applied to |
|---|---|---|
| `20260802033000_extensions` | `pgcrypto`, `citext`, `vector`. Dated before the schema migration so it sorts first on a fresh database (Issue 9). | local, CI |
| `20260802033724_milestone_4_schema` | 50 Tier-1 tables, 27 enums, indexes, relations. | local, CI |
| `20260802034000_timestamptz` | 169 columns converted from `timestamp` to `timestamptz` (Issue 5). | local, CI |
| `20260802034500_constraints` | `EXCLUDE` no-double-booking, currency/tax/range checks, partial unique indexes, one-default-branch, HNSW index. | local, CI |
| `20260802035500_snake_case_lifecycle_stage` | `RENAME` of `contacts.lifecycleStage`, preserving data (Issue 7). | local, CI |

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| — | None. This milestone adds no route handlers. | — |

## Breaking Changes

None so far. The `branches` backfill is expand → backfill → constrain against existing
organizations; no data is lost and no contract changes.
