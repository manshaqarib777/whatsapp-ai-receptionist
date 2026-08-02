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

## Pending Tasks

- [ ] `/docs/database/schema-change.md` — Milestone 4 section, before any migration
- [ ] `prisma/schema.prisma` — 50 Tier-1 models
- [ ] Migrations, one logical change each
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
