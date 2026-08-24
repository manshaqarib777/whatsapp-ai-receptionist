# Milestone 13 — Workflow Builder — Progress

Status: In Progress → Completed
Started: 2026-08-15
Last updated: 2026-08-23

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
- [x] Manual test runs evaluate condition variables and journal only the selected branch
- [x] Durable delay worker claims due steps atomically, resumes from persisted run context, and finishes or fails the run
- [x] Reusable template path — `POST /api/workflows/[id]/clone` and the builder's **Use as template** action copy the current immutable definition
- [x] `/workflows` UI — list with create + enable/disable toggles, builder page, run history
- [x] Typecheck, lint, unit/integration/E2E, build, `db:check-drift` all pass; axe audits clean

## Pending Tasks

None — milestone complete.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | React Query hooks returned the raw API envelope instead of unwrapping `{ data }` — `data.workflows` was always `undefined` and the list rendered its empty state even with seeded data | Resolved | Hooks unwrap `data` like every other feature (only the E2E run against a production build caught it) |
| 2 | Conditions always followed `true`, delayed runs were incorrectly stranded, and templates were only documented | Resolved | Variable-based evaluation, persisted run context, atomic due-step worker, and clone API/UI implemented |
| 3 | Builder and repository exceeded the 300-line structural budget | Resolved | Extracted `workflow-node-card.tsx` and `workflows.types.ts` |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-15 | Node placement is list-ordered node cards with explicit connectors, not drag-drop | Keyboard-reachable and axe-clean (CRM board precedent) | A drag-drop library |
| 2026-08-23 | Conditions evaluate persisted defaults overridden by per-run variables | Replays and delayed continuation must select the same branch | Always following `true` |
| 2026-08-23 | Templates use an explicit copy-definition action | Reuse without inventing a template table | Leaving AD-6 deferred |

## Database Changes

`WorkflowRun.context` stores the non-sensitive variables needed for deterministic
delayed continuation. Migration: `20260823170000_workflow_run_context`.

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| Existing workflow routes plus `POST /api/workflows/[id]/clone` | Added run variables and reusable copy-definition workflow | No |

## Breaking Changes

None.
