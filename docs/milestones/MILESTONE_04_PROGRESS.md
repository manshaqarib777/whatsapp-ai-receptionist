# Milestone 4 — Progress

Status: In Progress
Started: 2026-08-02
Last updated: 2026-08-02

Plan: `MILESTONE_04_PLAN.md` (approved 2026-08-02, both open questions answered).

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

## Pending Tasks

- [ ] Scope-injection Prisma client extension + base repository
- [ ] RLS policies as defence in depth
- [ ] Erasure (redaction) path
- [ ] `prisma/seed.ts` — deterministic, meeting `DATABASE_RULES.md:193` in full
- [ ] Tests per the plan's Testing Strategy
- [ ] `EXPLAIN ANALYZE` evidence for the two hot queries
- [ ] `DATABASE_RULES.md` amendments — `organization_id` naming, soft-delete/erasure
      contradiction
- [ ] `CHANGELOG.md` entry
- [ ] Preview environment (plan risk R-6) — needs the user's Vercel account
- [ ] `MILESTONE_04_COMPLETED.md`

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | `DATABASE_RULES.md:66` forbids hard deletion; `:182` requires a purge path for deletion requests. Directly contradictory. | Open | Plan AD-4 separates soft delete from erasure, and implements erasure as redaction in place. The rule file still needs amending — tracked in Pending Tasks. |
| 2 | PRD "Every table" pulls against `MILESTONE_RULES.md:19` "never add features from future milestones" | Resolved | Tiering approved 2026-08-02. Design all, migrate the Tier-1 spine. Plan AD-6. |
| 3 | Table count is 85, not the ~75 estimated in the plan | Resolved | Counted precisely while drawing the ER diagram: 10 existing, 50 Tier 1, 25 Tier 2. The plan's estimate was made before the derivation; the diagram is authoritative. |
| 4 | `postgres:17-alpine` does not ship pgvector — plan risk R-3, hitting locally before it could hit a host | Resolved | Moved to `pgvector/pgvector:pg17` in both docker-compose and CI. Same PG 17 major, so the volume carried over: all 11 tables and the migration history survived, verified rather than assumed. Both files had to change together or `CREATE EXTENSION vector` would pass locally and fail in CI. |
| 5 | **169 timestamp columns were `timestamp without time zone`**, violating `DATABASE_RULES.md:122` ("always `timestamptz`") | Resolved | Prisma maps `DateTime` to `timestamp(3)` unless told otherwise. Pre-existing since Milestone 1 — every table was affected, not just Milestone 4's. `@db.Timestamptz(3)` added to all 169 fields; the two `@db.Time()` opening-hour columns correctly left alone. For a product whose core feature is scheduling across timezones this was a serious latent defect. |
| 6 | Found #5 only because the appointment `EXCLUDE` constraint failed with "functions in index expression must be marked IMMUTABLE" | Resolved | `tstzrange(timestamp, timestamp)` needs a TimeZone-dependent cast, so Postgres refused the index. `tstzrange` itself is IMMUTABLE — the constraint was a canary for the column types, not the cause. Worth recording: the constraint paid for itself before it ever ran in production. |
| 7 | `contacts.lifecycleStage` was created camelCase, against `DATABASE_RULES.md:46` | Resolved | Missing `@map`. Found by an insert in the smoke test, then swept for with `information_schema.columns WHERE column_name ~ '[A-Z]'` — it was the only one. Migrated as a `RENAME`, not Prisma's generated DROP + ADD, which discards data. |
| 8 | `prisma migrate diff` proposes dropping the HNSW index on every run | Open — mitigated | Prisma cannot express an HNSW index, so it reads as drift. Removed from the generated migration by hand and documented in both the constraints migration and `schema-change.md`. **Every future `migrate diff` must be reviewed for this before applying.** |
| 9 | Prisma migration timestamps are generated from the system clock, and a hand-created folder dated in the future sorted after the generated one | Resolved | `20260802090000_extensions` would have run *after* the schema migration on a fresh database, so `CREATE TABLE ... vector(1536)` would fail in CI while passing locally. Renamed to `20260802033000_extensions` and the history row updated in place — a surgical rename, not a reset. |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-02 | Branches are real isolation boundaries; `branch_id NOT NULL` from the first migration | Milestone 18 specifies separate calendars, knowledge, and AI per branch; confirmed by the user | Nullable `branch_id` — two query shapes forever. Deferring to M18 — a migration across every table |
| 2026-08-02 | ER diagram split by domain rather than one 85-entity graph | A single diagram of this size renders as unreadable spaghetti; per-domain diagrams plus an overview are navigable | One monolithic diagram |
| 2026-08-02 | `contacts` is one table, not Contact (M6) and Customer (M10) | Two tables means two identities for the same person and a reconciliation problem at Milestone 10 | Separate `contacts` and `customers` |

## Database Changes

| Migration | Description | Applied to |
|---|---|---|
| — | None generated yet. `schema-change.md` comes first, per `DATABASE_RULES.md:15`. | — |

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| — | None. This milestone adds no route handlers. | — |

## Breaking Changes

None so far. The `branches` backfill is expand → backfill → constrain against existing
organizations; no data is lost and no contract changes.
