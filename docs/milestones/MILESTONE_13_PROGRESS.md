# Milestone 13 — Workflow Builder — Progress

Status: In Progress → Completed
Started: 2026-08-15
Last updated: 2026-08-15

> **Batch decision**: Milestones 12–14 were executed as one approved batch
> ("proceed on green"): sequential implementation, per-milestone exit gates,
> per-milestone PLAN/PROGRESS/COMPLETED docs, and per-milestone commits. This
> file records that decision for the audit trail. Any red gate stops the whole
> batch.

## Completed Tasks

- [x] Workflows manageable per branch — create, rename, enable/disable, versioned edit history
- [x] Versioned saves — every save writes a new immutable `WorkflowVersion` (incremented `versionNumber`), never mutating a published graph
- [x] Visual builder — trigger → conditions → actions → delays as ordered node cards with add/remove controls and a live validation summary (keyboard-reachable, axe-clean)
- [x] Server-side graph validation (`validateGraph` pure) — unknown node/edge refs, non-binary condition branches, branch labels on non-condition edges, duplicate node ids, duplicate variable names all refused (409)
- [x] Manual test runs — `POST /api/workflows/[id]/runs` writes a `WorkflowRun` + one `WorkflowRunStep` per node along the true path; delay nodes land `pending` with a `scheduledFor`
- [x] `/workflows` UI — list with create + enable/disable toggles, builder page, run history
- [x] Typecheck, lint, unit/integration/E2E, build, `db:check-drift` all pass; axe audits clean

## Pending Tasks

None — milestone complete.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | React Query hooks returned the raw API envelope instead of unwrapping `{ data }` — `data.workflows` was always `undefined` and the list rendered its empty state even with seeded data | Resolved | Hooks unwrap `data` like every other feature (only the E2E run against a production build caught it) |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-15 | Node placement is list-ordered node cards with explicit connectors, not drag-drop | Keyboard-reachable and axe-clean (CRM board precedent) | A drag-drop library |
| 2026-08-15 | Condition configs stored but not yet evaluated — runs follow the true branch | Run journal and step rows are the M13 scope; evaluation is a later milestone | Implementing condition evaluation now |
| 2026-08-15 | Templates deferred (plan AD-6) — copy-definition is the path | No dedicated template table in the M4 schema | Inventing a template table |

## Database Changes

No schema changes in M13 — the M4 schema already designed `workflows`,
`workflow_versions`, `workflow_runs`, `workflow_run_steps`.

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `GET/POST /api/workflows`, `GET/PATCH /api/workflows/[id]`, `POST /api/workflows/[id]/versions`, `POST /api/workflows/[id]/runs` | New workflow API surface | No (new surface) |

## Breaking Changes

None.
