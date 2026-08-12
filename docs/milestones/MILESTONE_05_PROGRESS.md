# Milestone 5 — Progress

Status: **Complete — see `MILESTONE_05_COMPLETED.md`**
Started: 2026-08-12
Last updated: 2026-08-12

Plan: `MILESTONE_05_PLAN.md` (approved 2026-08-12).

## Completed Tasks

- [x] `MILESTONE_05_PLAN.md` written and approved
- [x] `src/server/scope.ts` — `resolveScope(organizationId)` returning the org-level
      scope (`branchId: null`) the dashboard reads across
- [x] `src/features/dashboard/repositories/dashboard.repository.ts` — the only
      dashboard code that touches the database; every query through `forScope(scope)`
- [x] `src/features/dashboard/services/dashboard.service.ts` — pure orchestration:
      deltas, sentiment, currency/duration formatting, dense chart series
- [x] `src/features/dashboard/lib/{range,greeting}.ts` — persisted range parse/convert
      and the time-of-day greeting
- [x] `src/features/dashboard/components/*` — KPI grid, conversations chart, revenue
      chart, activity feed, upcoming appointments, recent conversations,
      notifications bell, range picker, per-widget skeletons
- [x] `src/app/(app)/dashboard/page.tsx` — rebuilt with per-widget `Suspense`
      boundaries and the global range picker
- [x] `src/app/(app)/layout.tsx` — shell rewired to `AppShell` + `SidebarNav` +
      `PageHeader` with the workspace switcher, account menu, and notifications bell
- [x] `src/app/api/dashboard/{range,notifications}/route.ts` — the two API routes
- [x] `src/app/(app)/{inbox,contacts,appointments}` — `notFound()`-style doorway stubs
      so every dashboard link is real
- [x] Unit tests — range, greeting, service derivations
- [x] Integration tests — 16 against real Postgres, including org A never sees org B
- [x] Component tests — 37 across all eight widgets, axe-clean
- [x] E2E — `tests/e2e/dashboard.spec.ts`, 6 tests × chromium + mobile
- [x] `CHANGELOG.md` entry
- [x] `MILESTONE_05_COMPLETED.md`
- [x] Exit gate: typecheck, lint, unit/integration, E2E, and build all pass

## Issues Found and Fixed

### Issue 1 — Notifications were ordered read-first, not unread-first

`listNotifications` ordered by `readAt: 'asc'`, which in Postgres sorts NULLs **last** —
so the unread notification was buried under the read ones, exactly the opposite of the
bell's contract. Fixed with an explicit `nulls: 'first'` on the `readAt` tie-break.

### Issue 2 — The shell crashed at runtime: icons cannot cross the server→client boundary

`src/app/(app)/layout.tsx` (a server component) passed `APP_NAV_SECTIONS` — whose items
carried `icon: LucideIcon` component references — into the client `AppShell`. React
cannot serialise a component function, so every authenticated page rendered
"Something went wrong" with digest `1921644950`. The build and typecheck did not catch
it; only a browser did. Fixed by making the nav data carry icon **names** and having
`SidebarNav` resolve them from a closed registry on the client.

### Issue 3 — The notifications bell read the wrong response shape

`/api/dashboard/notifications` returns `{ data: { notifications: [...] } }`, but the
bell read `data.data` as if it were the array itself, so `notifications` became an
object and `.filter` threw — a client-side crash on every dashboard load. Fixed the
component to read `data.data.notifications`.

### Issue 4 — The dashboard axe audit timed out against the 30s default

`tests/e2e/dashboard.spec.ts` runs **four** axe audits inside one test (light/dark ×
LTR/RTL) over a page of recharts SVGs and data tables. Against the 30s default that
left no headroom, and it tipped over under parallel workers — surfacing as a test
timeout, not a violation. Fixed the same way the design-system suite does
(`design-system.spec.ts:35`): the audit test gets a budget that matches what it
actually costs (`AUDIT_TIMEOUT_MS = 120_000`). The audit itself is unchanged — this
widens the clock, not the pass condition.

### Issue 5 — E2E org creation raced on the slug under parallel workers

`openDashboard` created the org as `E2E Dashboard ${Date.now()}`, which slugs to
`e2e-dashboard-<ms>`. Two workers landing in the same millisecond produced the same
slug, and `uniqueSlug` (`organization.service.ts`) is a check-then-insert — so the
second insert hit the `organizations.slug` unique constraint and the route returned
500 (visible in the Postgres log as a `duplicate key value violates unique constraint
"organizations_slug_key"`). Fixed the fixture to embed a random component in the org
name (the email already did), so parallel workers can never collide.

## Verification

Each claim below is backed by a run, per project taste — not taken at face value.

| Check | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run test` | 539 passing (44 files) |
| `npm run test:e2e` | 130 passing (65 × chromium + mobile) |
| `npm run build` | succeeds |
| axe on `/dashboard` | clean, light + dark, LTR + RTL, desktop + mobile |
