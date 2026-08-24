# Milestone 13 — Completed

Completed: 2026-08-15; re-certified: 2026-08-23
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 13`

---

## What Was Built

The Workflow Builder at `/workflows`: a visual node-graph editor for
automations with triggers, conditions, actions, and delays, plus versioned
saves, server-side graph validation, and a manual test-run journal. The M4
schema (`workflows`, `workflow_versions`, `workflow_runs`,
`workflow_run_steps`) now has its service layer, API, and UI.

Against the plan's objective, all of the following are now true and were not before:

- **Workflows are manageable per branch** — create, rename, enable/disable, and
  a versioned edit history. The builder saves a new immutable `WorkflowVersion`
  per save (incremented `versionNumber`), never mutating a published graph.
- **The visual builder edits a node graph** — trigger → conditions → actions →
  delays, rendered as ordered node cards with add/remove controls and a live
  validation summary. Node placement is list-ordered with explicit connectors
  (keyboard-reachable, axe-clean) rather than a drag-drop library.
- **Server-side validation is real and authoritative.** `validateGraph` is a
  pure function that refuses unknown node/edge references, non-binary
  condition branches (a condition must have exactly two outgoing edges labelled
  `true` and `false`), branch labels on non-condition edges, duplicate node
  ids, and duplicate variable names. An invalid graph is a 409 listing every
  problem — never a saved half-graph.
- **Runs exist.** `POST /api/workflows/[id]/runs` starts a manual (test) run
  against the current version: it writes a `WorkflowRun` and one
  `WorkflowRunStep` per selected node. Conditions evaluate definition defaults
  plus supplied run variables. Delay nodes remain pending until the atomic
  database-polled worker resumes the same path from persisted run context.
- **Templates are usable.** The builder's **Use as template** action and clone
  endpoint create a disabled workflow seeded from the current definition.
- **The `/workflows` UI is real** — a list with create + enable/disable
  toggles, a builder page with save-as-new-version and test-run, and a run
  history section.
- **Typecheck, lint, unit/integration/E2E, and build all pass**, and axe audits
  the workflow pages clean.

### Bugs the test suite found and fixed

1. **The React Query hooks returned the raw API envelope instead of unwrapping
   it.** The house hooks (`use-invoices.ts`) unwrap `{ data: ... }` before
   returning; the new `use-workflows.ts` returned the envelope, so `data.workflows`
   was always `undefined` and the list rendered its empty state even with seeded
   data. Only the E2E run against a production build caught it — the API returned
   the right payload, but the client never saw it. The hooks now unwrap `data`
   like every other feature.

---

## Files Created

| Path | Purpose |
|---|---|
| `src/features/workflow-builder/services/graph.ts` | Pure graph validation + node/edge typing (the server authority). |
| `src/features/workflow-builder/services/graph.test.ts` | 9 validation unit tests (empty, unknown refs, condition branches, duplicates). |
| `src/features/workflow-builder/services/workflows.service.ts` | Orchestration: CRUD, versioned saves, enable guard, test runs. |
| `src/features/workflow-builder/repositories/workflows.repository.ts` | The only workflow DB access; `forScope` everywhere. |
| `src/features/workflow-builder/validators/workflows.validators.ts` | Zod schemas for all workflow routes. |
| `src/features/workflow-builder/hooks/use-workflows.ts` | React Query hooks + mutations (envelope-unwrapping). |
| `src/features/workflow-builder/components/workflow-list.tsx` | Workflow list + create dialog + enable toggle. |
| `src/features/workflow-builder/components/workflow-builder.tsx` | The visual graph editor (node cards, add/remove, save, test run). |
| `src/features/workflow-builder/components/workflow-runs.tsx` | Run history. |
| `src/features/workflow-builder/tests/workflows.integration.test.ts` | Real Postgres: CRUD, version increments, invalid-graph 409, enable guard, runs + delay scheduling, **org A never sees org B**. |
| `src/app/api/workflows/` | AD-5 routes: list/create, detail + PATCH, versions, runs. |
| `src/app/(app)/workflows/` | `/workflows` list + `/workflows/[id]` builder pages. |
| `tests/e2e/workflows.spec.ts` | Seeded list, builder save-version, test run, axe. |
| `prisma/seed/workflows.ts` | Seeded workflows (enabled + versioned with a run, and a draft). |
| `docs/api/workflows.md` | API reference. |

## Files Modified

| Path | Change |
|---|---|
| `src/features/auth/permissions.ts` | `workflow:read` / `workflow:write` across roles. |
| `src/features/auth/navigation.ts` | `Workflows` nav item. |
| `src/components/sidebar-nav.tsx` | `workflow` icon registered. |
| `src/middleware.ts` | `/workflows` in the protection matcher. |
| `prisma/seed.ts` | Wire the workflows seed. |
| `.claude/CHANGELOG.md` | Milestone 13 entry. |

---

## Tests Completed

| Type | Count | Coverage | Command |
|---|---|---|---|
| Unit (graph) | 9 | valid graph, empty, unknown edge target, duplicate ids, condition branch rules, branch-label rule, duplicate variables | `npm run test` |
| Integration (workflows) | 13 | real Postgres: CRUD, org isolation, version increments, invalid graph → 409, unknown trigger → 422, enable guard, run + step rows, delay `scheduledFor`, org B never sees org A runs | `npm run test` |
| **Vitest total** | **780 passing overall** (up from 758) | — | `npm run test` |
| E2E (workflows) | 4 × 2 projects | seeded list, builder save-version, test run history, axe clean | `npm run test:e2e` |

Gate at close: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run test:e2e`, `npm run build`, and `npm run db:check-drift` all pass. axe
audits the workflow pages clean.

### What the integration tests assert

Create + list isolation between orgs; 404 for a missing workflow; a version
save points `currentVersionId` and increments `versionNumber`; an invalid graph
(unknown edge target) is a 409; an unknown trigger kind is a 422; a workflow
with no version cannot be enabled; a saved version can be enabled; a workflow
with no version cannot run; a run writes the run + one step per node in
execution order; a delay node lands `pending` with a `scheduledFor`; and — the
non-negotiable — org B never sees org A's runs.

### Re-certification repairs (2026-08-23)

- Replaced the hard-coded true branch with deterministic variable evaluation.
- Added persisted `WorkflowRun.context` and an atomic due-step worker.
- Added the planned copy-definition template API and UI action.
- Enforced one trigger and deterministic non-condition edges.
- Split oversized builder/repository responsibilities into node-card and types files.
- Gates: 27 focused tests, lint, typecheck, drift check, 55-page build, and 8/8 E2E.

---

## Performance

The list and detail reads use one scoped query each (detail parallelises
versions + runs). Version saves are one insert plus a workflow pointer update.
Runs write a bounded number of step rows equal to the graph's executed nodes.
No per-read graph work beyond parsing the stored JSON definition.

---

## Known Limitations

1. **The builder is list-ordered, not a free-form canvas** — node placement is
   ordered cards with explicit connectors rather than drag-drop, matching the
   CRM board's keyboard-reachable precedent.
2. **Action nodes journal execution only.** Integrations that deliver messages
   or mutate external systems remain owned by their feature/integration milestones.

---

## Exit Criteria

- [x] Every task in the plan's scope
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors, zero warnings
- [x] Unit, integration, component, and E2E tests exist and pass
- [x] `npm run build` succeeds
- [x] `npm run db:check-drift` — green
- [x] axe audits the workflow pages clean
- [x] Docs updated — `CHANGELOG.md`, `docs/api/workflows.md`, this file
- [x] `MILESTONE_13_COMPLETED.md` written

All met.
