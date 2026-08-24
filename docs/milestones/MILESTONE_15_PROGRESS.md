# Milestone 15 — Analytics — Progress

Status: Completed; re-certified
Started: 2026-08-16
Last updated: 2026-08-23

## Completed Tasks

- [x] `MILESTONE_15_PLAN.md` written (approved-scope derivation: revenue, funnels, conversion, retention, bookings, performance, charts, forecasting)
- [x] Repository — scoped analytics reads (`forScope` everywhere)
- [x] Service — pure view-model math (buckets, deltas, conversion, retention cohorts, forecast)
- [x] API routes — `/api/analytics/*` (revenue, funnels, conversion, retention, bookings, performance, forecast, range)
- [x] `/analytics` page + range picker (30d/90d/180d/12m)
- [x] Sections — revenue, funnel, conversion, retention, bookings, performance, forecast (presentational, data via server page)
- [x] Permissions `analytics:read`, nav item + icon, middleware matcher
- [x] Unit (10) + component (6) + integration (8) tests
- [x] E2E spec (3 × 2 projects) + axe audits clean
- [x] Docs — `docs/api/analytics.md`, `CHANGELOG.md`, architecture overview, README status
- [x] Exit gate — typecheck, lint, test, e2e, build, drift, axe all green

## Pending Tasks

None — milestone complete.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | `NODE_ENV=production` in this environment made npm omit devDependencies mid-session | Resolved | `npm install --include=dev`; Prisma client regenerated; audit closed to 0 via `nanoid`/`hono` overrides (M14 close) |
| 2 | Async server components cannot be rendered in jsdom (React 19: "Only Server Components can be async") | Resolved | Sections refactored to presentational client components receiving data props; the server page does the fetching — the same split as the dashboard's `RevenueChart` vs page |
| 3 | Permissions test caught `analytics:read` missing on `member` while viewer held it | Resolved | Role matrix completed — all four roles hold `analytics:read` |
| 4 | E2E strict-mode violations on repeated strings (`SAR 1,150`, `Qualified`, `Revenue`) | Resolved | Exact + `.first()` matchers |
| 5 | Conversion ignored the documented range; revenue used invoice snapshots; retention was not a 30-day cohort; response timing was N+1 | Resolved | Range-aware cohort queries, captured successful payments, mature-contact activity threshold, batched message reads |
| 6 | Analytics repository/service exceeded the 300-line structural budget | Resolved | Split revenue/performance repositories plus math/view-model modules |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-16 | Derive everything at read time — no analytics tables | The M4 schema planted no analytics tables; only `PipelineStage.winProbability` (comment: "drives weighted forecasting at M15") | Snapshot/rollup tables (new schema, no query yet needs them) |
| 2026-08-16 | Read-only server components, per-widget Suspense | Same decision as the M5 dashboard AD-3; no mutation surface on the page | React Query client fetch |
| 2026-08-16 | Forecast = weighted pipeline + trailing-average projection, labelled honestly | `winProbability` is planted for this; a projection must never read as a promise | ML/external forecasting service |
| 2026-08-16 | Sections are presentational; the page fetches | jsdom cannot render async server components; mirrors the dashboard's chart-widget split | Rendering async sections in tests (impossible in jsdom) |

## Database Changes

| Migration | Description | Applied to |
|---|---|---|
| None | All analytics derived from existing M4 tables | — |

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `GET /api/analytics/revenue` | New | No |
| `GET /api/analytics/funnels` | New | No |
| `GET /api/analytics/conversion` | New | No |
| `GET /api/analytics/retention` | New | No |
| `GET /api/analytics/bookings` | New | No |
| `GET /api/analytics/performance` | New | No |
| `GET /api/analytics/forecast` | New | No |
| `PATCH /api/analytics/range` | New | No |

## Breaking Changes

None.
