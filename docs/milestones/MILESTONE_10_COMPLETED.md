# Milestone 10 — Completed

Completed: 2026-08-14; re-certified 2026-08-23
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 10`

---

## What Was Built

The CRM at `/crm`: pipelines, leads/deals, companies, tags, activities,
timeline, notes, tasks, and rule-based automation. The M4 schema (`companies`,
`pipelines`, `pipeline_stages`, `deals`, `tags`, `taggables`, `activities`,
`tasks`) now has its service layer, API, UI, and worker.

Against the plan's objective, all of the following are now true and were not before:

- **Pipelines with ordered stages and win probability are manageable per branch**;
  each org has a default pipeline (created on demand via the service).
- **Deals (leads and deals in one table) move through stages with a persisted
  timeline**; won/lost closes with `closedAt` and an activity marker. A closed
  deal cannot move or be closed again (409).
- **Companies are manageable** and link to contacts and deals (counts surfaced).
- **Tags apply polymorphically** (`taggables`: deal/contact/conversation) with a
  tag manager; re-tagging is idempotent (unique constraint + swallowed P2002).
- **Activities (note/call/email/meeting/stage change/status change/assigned/tag
  change) form a timeline per subject**, written through one `recordActivity`
  service seam.
- **Tasks exist per org** with assignee, due date, and status — the M5 `tasks`
  table now has its M10 surface (create + complete in the UI).
- **Automation: simple rule-based triggers** (new deal → auto-assign, deal value
  ≥ threshold → tag, company created → default tag) evaluated in a DB-polled
  worker (`npm run crm:work`), idempotent via activity/tag markers.
- **Typecheck, lint, unit/integration/E2E, and build all pass**, and axe audits
  the CRM pages clean.

### Scope changes

- **Auto-assign is an `assigned` activity**, not a column: the M4 `Deal` table
  has no assignee field, so assignment is represented as an activity on the deal,
  which doubles as the idempotency marker.
- **No automation API routes.** Rules are org-scoped config (`DEFAULT_RULES` in
  `services/automation.ts`); the workflow-builder table lands at Milestone 25, so
  the worker runs the configured ruleset directly.
- The plan's `resource-manager` equivalent (`company-drawer.tsx`,
  `timeline.tsx` as a standalone) was folded into the deal drawer and the
  companies page — the timeline is a section of the drawer.

### Bugs the test suite found in the implementation

1. **The `Deal` model has no `tags` relation.** The initial `DEAL_SELECT`
   included a nested `tags` select that Prisma rejected at runtime (the
   polymorphic `taggables` table is not a relation on `Deal`). Tags are now
   hydrated with a batched `tagsForDeals` query keyed by deal id — one query,
   not one per deal.
2. **`/api/crm/tasks/[id]` 404'd in E2E.** The `PATCH` handler lived in
   `tasks/route.ts`, so the client's PATCH to `/api/crm/tasks/[id]` had no route.
   The dynamic-segment handler now lives in `tasks/[id]/route.ts` (the build
   output confirmed the route appears). Only the E2E run against a production
   build caught it — unit tests drive the service directly.
3. **Cleanup-order failure in the integration test**: deleting `branch` before
   `company`/`tag` failed on the FK; the teardown now deletes children first.

---

## Files Created

| Path | Purpose |
|---|---|
| `src/features/crm/repositories/crm.repository.ts` | The only CRM DB access; every query scoped via `forScope`, writes through a derived branch scope, batched tag hydration. |
| `src/features/crm/services/crm.service.ts` | Pure orchestration: pipelines, deal lifecycle, companies, tags, activities (`recordActivity`), tasks. |
| `src/features/crm/services/automation.ts` | Rule evaluation (pure) + idempotent action application + `DEFAULT_RULES`. |
| `src/features/crm/validators/crm.validators.ts` | Zod schemas for all CRM routes. |
| `src/features/crm/hooks/use-crm.ts` | React Query hooks (pipelines, deals, companies, tags, tasks, mutations). |
| `src/features/crm/components/pipeline-board.tsx` | Column-per-stage board with deal cards + move menu. |
| `src/features/crm/components/deal-drawer.tsx` | Deal detail, timeline, stage move, close, add activity. |
| `src/features/crm/components/company-list.tsx` | Companies list + create dialog. |
| `src/features/crm/components/tag-manager.tsx` | Tag list + create dialog. |
| `src/features/crm/components/task-list.tsx` | Task list + create dialog + complete. |
| `src/features/crm/components/pipeline-board.test.tsx` | Board states + move action, axe-clean. |
| `src/features/crm/components/crm-lists.test.tsx` | Company/tag/task list states, axe-clean. |
| `src/features/crm/services/automation.test.ts` | Rule evaluation unit tests. |
| `src/features/crm/tests/crm.integration.test.ts` | Real Postgres: pipeline CRUD, deal lifecycle + activities, tag idempotency, tasks, automation once, **org A never sees org B**. |
| `src/workflows/crm-automation.worker.ts` | DB-polled automation worker (AD-5). |
| `scripts/crm-automation-worker.ts` | `npm run crm:work` entry. |
| `src/app/api/crm/` | All AD-6 routes (pipelines, deals + [id] + activities, companies, tags + assign, tasks + [id]). |
| `src/app/(app)/crm/` | `/crm` board, `/crm/companies`, `/crm/tags`, `/crm/tasks` pages. |
| `tests/e2e/crm.spec.ts` | Seeded board, move stage, create company, complete task, axe. |
| `docs/api/crm.md` | API reference. |

## Files Modified

| Path | Change |
|---|---|
| `package.json` | `crm:work` script. |
| `prisma/seed/crm.ts` | Cross-tenant beacon pipeline/deal/task (org B). |
| `.claude/CHANGELOG.md` | Milestone 10 entry. |

---

## Tests Completed

| Type | Count | Coverage | Command |
|---|---|---|---|
| Unit (automation) | 8 | assign/tag/noop rules, thresholds, determinism | `npm run test` |
| Component (CRM) | 14 | board + company/tag/task lists: populated/empty/error, move, create, axe-clean | `npm run test` |
| Integration (CRM) | 10 | real Postgres: pipeline stages, deal lifecycle + activities, close guards, tag idempotency, task CRUD, automation applies once, **org A never sees org B** | `npm run test` |
| **Vitest total** | **708 passing** (up from 676) | — | `npm run test` |
| E2E (CRM) | 5 × 2 projects | seeded board, move stage via drawer, create company, complete task, axe clean | `npm run test:e2e` |
| **E2E total** | **176 passing** (88 × chromium + mobile) | — | `npm run test:e2e` |

> **Verified 2026-08-14 (batch close):** the full E2E suite re-run at the M9–M11
> batch gate passed **185/186** with Playwright `workers: 1` (CI parity); the one
> failure was an infra-level `ECONNRESET` on a CRM setup request, which passes
> deterministically in isolation. See `MILESTONE_11_PROGRESS.md`.

Gate at close: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run test:e2e`, `npm run build`, and `npm run db:check-drift` all pass. axe
audits the CRM pages clean.

### What the integration tests assert

Pipeline creation with ordered stages; deal creation records a `note` activity;
moving stages records a `stage_change` and a closed deal cannot move (409);
closing sets `closedAt` and a second close is refused (409); tagging is
idempotent and removable; task create + status transition; automation tags a
high-value deal exactly once across re-runs; and — the non-negotiable — org B's
CRM never contains org A's deals, companies, or tasks.

### Deliberately not covered

- **The automation worker's org enumeration loop** runs against the real
  database in the integration test via the service path; the infinite loop's
  timer is not faked (same convention as the knowledge worker).
- **Company drawer with contacts/deals tabs** — companies are a list with
  counts in M10; the drawer is a later milestone.
- **Drag-and-drop stage moves** — the plan explicitly degrades to buttons;
  keyboard-reachable move menus are the shipped interaction.

---

## Performance

The board fetches pipelines once and deals per stage (bounded by stage count).
Tags hydrate with one batched query per deal list rather than one per deal. The
automation worker is a separate process (`npm run crm:work`) and processes
bounded recent rows (7-day lookback, 200 each), with idempotency markers so
at-least-once delivery never double-applies.

---

## Known Limitations

1. **Rules are compile-time config** (`DEFAULT_RULES`), not org-editable — the
   workflow builder at Milestone 25 owns runtime rule configuration.
2. **Auto-assign is an activity, not an assignee column** — a real assignee on a
   deal needs a schema change, which is out of M10 scope.
3. **No pipeline creation UI** — the API exists and the seed provides the
   default pipeline; pipeline management UI is a later milestone.
4. **Company → contact/deal linking UI is not built** — deals can carry
   `companyId` via the API; the company drawer is a later milestone.

---

## Exit Criteria

- [x] Every task in the plan's scope
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors, zero warnings
- [x] Unit, integration, component, and E2E tests exist and pass
- [x] `npm run build` succeeds
- [x] `npm run db:check-drift` — green
- [x] axe audits the CRM pages clean
- [x] Docs updated — `CHANGELOG.md`, `docs/api/crm.md`, this file
- [x] `MILESTONE_10_COMPLETED.md` written

All met.
