# Milestone 18 — Progress

Status: Completed
Started: 2026-08-22
Last updated: 2026-08-23

## Completed Tasks

- [x] Read the Milestone 18 PRD requirements and repository rules.
- [x] Audit the existing organization, branch, appointment, knowledge, AI, session,
  and tenant-scope architecture.
- [x] Read the bundled Next.js 16.2 layouts/pages, Server/Client Components, data
  fetching, data mutation, and route-handler guidance.
- [x] Restore the baseline quality gate: remove the unused loyalty seed result;
  typecheck, lint, and all 895 Vitest tests pass.
- [x] Create the Milestone 18 technical plan.
- [x] Document the branch API and active-session database change.
- [x] Implement branch persistence, service, strict validators, routes, and audit events.
- [x] Add and deploy the active-branch session migration.
- [x] Extend auth context with a validated, fail-closed branch selector.
- [x] Build branch switching and the branch settings screen.
- [x] Scope appointment, knowledge, and AI request paths to the active branch.
- [x] Add unit, integration, component, and E2E coverage.
- [x] Pass typecheck, lint, 979 Vitest tests, 238 Playwright tests, drift, and build.

## Pending Tasks

None.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Milestone 17 left an unused `loyalty` seed result, making lint fail. | Resolved | Await the seed directly; typecheck, lint, and 895 tests pass. |
| 2 | Sandbox initially blocked PostgreSQL at `127.0.0.1:5433`. | Resolved | Re-ran the suite with approved local database access. |
| 3 | Milestone 8 was incomplete when this plan began. | Resolved | Milestones 1–17 were repaired and re-certified sequentially before M18 resumed. |
| 4 | Better Auth cookie caching served stale organization state after an atomic DB switch. | Resolved | Disabled session cookie caching so security scope and revocation read fresh database state. |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-22 | Persist the active branch on the session. | Branch scope must be trusted server-side and stable across routes. | Query/header branch ids are untrusted; a UI-only cookie can be tampered with. |
| 2026-08-22 | Keep membership organization-wide. | Branch-specific roles are absent from the PRD. | Adding branch memberships would expand product scope and schema complexity. |
| 2026-08-22 | Reuse existing non-null branch ownership. | Milestone 4 already modeled branch isolation across the required domains. | Nullable branch ownership would create ambiguous fallback semantics. |

## Database Changes

| Migration | Description | Applied to |
|---|---|---|
| `20260823190000_active_branch_sessions` | Add trusted active branch, index/FK, and backfill active sessions. | Local development database |

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `/api/branches` | Planned list/create branch resource. | No |
| `/api/branches/:id` | Planned branch update. | No |
| `/api/branches/active` | Planned active branch switch. | No |
| `/api/branches/:id/default` | Planned default branch change. | No |

## Breaking Changes

None planned. Existing single-branch organizations continue through their default
branch.
