# Structural Audit — Milestones 1–17

Date: 2026-08-22
Scope: repository structure, milestone lifecycle, layering, test coverage, security
boundaries, and production-readiness evidence through Milestone 17.

## Executive Summary

The application has broad feature coverage and a passing unit/integration suite, but
it does not consistently satisfy its own development contract. Milestone 8 was never
closed, several earlier completion documents explicitly leave mandatory exit criteria
unmet, and multiple production paths bypass the declared layers. Milestone 18 must
pause until the critical prerequisite defects are repaired.

The repository should not be rewritten. Most Milestones 5–17 already use repositories,
services, validators, React Query hooks, thin route handlers, and tenant-scoped tests.
The correct approach is a staged repair of the exceptions, followed by enforcement so
the structure cannot drift again.

## What Is Working Well

- Feature-first directories exist for every implemented business domain.
- Most Milestones 5–17 use repository → service separation and strict Zod boundaries.
- Route files are small; all API routes use the standard handler or an explicitly
  specialized public boundary.
- No production `process.env` access exists outside `src/lib/env.ts`.
- No skipped or focused tests were found.
- Tenant-isolation integration tests exist across the major data domains.
- Typecheck, ESLint, formatting, and all 895 Vitest tests pass after repairing the
  Milestone 17 seed/format regressions.
- Pages and layouts follow the bundled Next.js 16 asynchronous request APIs.

## Critical Findings

### C1 — Milestone 8 was never completed

`MILESTONE_08_PROGRESS.md` remains `In Progress`. It explicitly lists API docs,
changelog, completion documentation, and the exit gate as pending. There is no
`MILESTONE_08_COMPLETED.md`, yet Milestones 9–17 were started and marked complete.

This violates `MILESTONE_RULES.md`: later milestones may start only after the current
milestone has a satisfied completion document.

Required repair:

1. Reconcile the implementation against the M8 plan and actual PRD scope.
2. Add missing AI component tests and API documentation.
3. Verify the mandatory AI security cases, especially prompt injection, unauthorized
   tools, provider timeout/fallback, cost ceilings, and citation isolation.
4. Run the full gate and create an honest completion document.

### C2 — Organization creation does not provision a default branch

`Organization` and `Branch` schema documentation promise that every organization gets
one non-null default branch. `organization.service.create` creates only the
organization and owner membership. Later repositories resolve a default branch and
fail when none exists. Seeds and integration fixtures create branches separately,
masking the production onboarding defect.

Required repair: move organization persistence into an organization repository and
create the organization, owner membership, and `Main` default branch atomically.
Add an API/integration regression test that exercises the real organization creation
service and immediately calls a branch-owned feature.

### C3 — Completion records claim success with mandatory criteria unmet

- Milestones 3 and 4 explicitly leave preview deployment unchecked while still being
  treated as completed.
- Milestone 11 records a full E2E result of 185/186 but checks “tests pass” and states
  “All met.”
- Milestone 8 has no completion record at all.

Required repair: completion records must distinguish “implemented” from “meets every
exit criterion.” Preview deployment is unavailable until Milestone 25, so either the
project owner must formally amend the milestone rule once, or earlier milestones must
remain conditionally complete. Test failures cannot be marked complete.

## High-Priority Structural Findings

### H1 — Database access exists outside repositories

Verified production exceptions:

- `src/features/auth/services/organization.service.ts`
- `src/features/auth/services/audit-log.service.ts`
- `src/features/health/services/health.service.ts`
- `src/features/invoices/services/webhook.ts`
- `src/server/auth-context.ts`
- `src/features/knowledge/lib/retrieval.ts`

The knowledge raw-SQL adapter is documented and self-scoped, but it is still named and
located as a `lib` rather than a repository. Auth, health, invoice webhook, and auth
context are direct violations of the declared Controller → Service → Repository rule.

Required repair:

- Create organization, audit-log, auth-context, health, and payment-webhook
  repositories.
- Move knowledge raw SQL under `features/knowledge/repositories` and preserve its
  explicit organization/branch predicates.
- Add an ESLint boundary that permits `@/lib/prisma` only in repositories and named
  infrastructure adapters, with test files explicitly exempted.

### H2 — Frontend server-state access bypasses hooks

Direct component fetches exist in auth organization/member components, dashboard range
controls, analytics range controls, and the notification bell. The notification bell
uses the specifically forbidden `useEffect + fetch + useState` pattern and silently
converts request failures into an empty list.

Required repair: add feature hooks/query keys and typed API client functions. Components
render state and trigger mutations only. Errors must surface through the component's
error state.

### H3 — No route-segment error or loading boundaries exist under the app

The coding standard requires a root boundary, a route-segment boundary, and isolated
widget recovery. The app has root errors but no `error.tsx` or `loading.tsx` below
`src/app/(app)`.

Required repair: add shared authenticated-segment error/loading boundaries, then add
widget boundaries around independently failing dashboard/analytics panels.

### H4 — Required component coverage is missing

The AI and workflow-builder features have production components but no colocated
component tests. The design-system feature itself has no tests in its feature folder,
although many shared components are tested elsewhere.

Required repair: add state, interaction, keyboard, RTL, and axe coverage for AI and
workflow components. Document shared design-system coverage instead of relying on a
folder-name count.

### H5 — Production files exceed the 300-line limit

The most significant production violations are:

- loyalty repository: 577 lines
- reviews repository: 448 lines
- analytics repository: 437 lines
- analytics service: 370 lines
- knowledge service: 357 lines
- invoices service: 340 lines
- workflow builder component: 322 lines
- CRM and inbox hooks: more than 300 lines
- workflow and dashboard repositories: more than 300 lines

Several integration suites also exceed the limit. Production units should be split by
aggregate/responsibility first; test suites can be split by behavior group afterward.

### H6 — Controller placement conflicts across project documentation

`ARCHITECTURE_RULES.md` requires controllers under `features/*/api`, with App Router
files delegating to them. `docs/architecture/overview.md` describes the route handler
itself as the controller. Current code follows the latter and has no feature `api/`
directories.

Required repair: choose one rule and document it in an ADR. Recommended: keep Next.js
route files as minimal transport adapters and move validation/auth/service orchestration
to named feature controllers. This preserves framework isolation without relocating
URLs.

## Medium-Priority Findings

### M1 — Deprecated Next.js middleware convention

The project already records that Next.js 16 deprecates `middleware.ts` in favor of
`proxy.ts`, but the migration remains outstanding. Read the bundled proxy guide before
changing it and cover all protected routes with E2E tests.

### M2 — Localization requirements and implementation disagree

RTL-aware logical utilities and an RTL Playwright project exist, but the rules prohibit
hardcoded user-facing strings and require a translation layer. The application still
hardcodes English throughout, and the rule itself acknowledges that no localization
milestone exists.

Required decision: formally schedule localization or narrow the rule to “RTL layout
readiness” until translation infrastructure is approved.

### M3 — Placeholder transport work ships in completed milestones

Appointment reminders and review automation contain TODOs instead of WhatsApp delivery.
If those milestones promise actual delivery, they are incomplete; if they promise only
durable scheduling/request creation, the plans and completion documents must say so
without describing delivery as complete.

### M4 — Test and tooling warnings are accumulating

- Vite warns that the TypeScript config is loaded as CommonJS despite ESM syntax.
- jsdom repeatedly warns that canvas context is unavailable during chart tests.
- PostgreSQL warns about concurrent `client.query()` behavior that will be removed in
  pg 9.

These are not current failures, but they obscure useful output and become upgrade
risks.

## Milestone Assessment

| Milestones | Assessment |
|---|---|
| 1–4 | Foundations exist, but completion evidence is inconsistent and auth/organization layering needs repair. |
| 5–7 | Core features are implemented and tested; frontend state and resilience boundaries need structural cleanup. |
| 8 | Incomplete. Must be reconciled and closed before later roadmap work can be considered sequentially valid. |
| 9–12 | Functional vertical slices exist; default-branch assumptions, oversized services, and one failed M11 E2E claim need repair. |
| 13–17 | Functional slices exist with tests; oversized units and missing workflow component coverage remain. |
| 18 | Planning and the additive active-branch session migration started, then paused pending prerequisite repair. |

## Repair Order

1. Close Milestone 8 honestly: docs, tests, security cases, full gate.
2. Repair organization creation and extract auth/organization repositories.
3. Add enforceable architecture boundaries and resolve the controller-location
   documentation conflict.
4. Add authenticated route resilience boundaries and replace direct component fetches.
5. Split oversized production units one feature at a time, preserving behavior with
   existing tests.
6. Re-run and correct completion evidence for Milestones 9–17.
7. Resume Milestone 18 active-branch implementation.

## Verification Snapshot

On 2026-08-22:

- `npm run format:check` — pass after formatting eight Milestone 17 files.
- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run test` — 895/895 pass before the formatting-only cleanup.
- Production build, E2E, schema drift, and migration application remain pending for
  this audit cycle.
