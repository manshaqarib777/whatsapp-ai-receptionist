# Milestone 15 — Completed

Completed: 2026-08-16
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 15`

---

## What Was Built

The Analytics surface at `/analytics`: revenue, funnels, conversion, retention,
bookings, performance, charts, and forecasting — all derived at read time from
existing rows. The M4 schema designed no analytics tables; the only planted
field, `PipelineStage.winProbability`, drives the weighted forecast exactly as
its comment promised.

Against the plan's objective, all of the following are now true and were not before:

- **Revenue** is measurable: invoiced vs collected vs outstanding vs refunds over
  a range, with daily invoiced/collected trend charts.
- **Funnels** exist: the CRM pipeline as a funnel (deals per stage with the
  seeded taper) and a quote → invoice → paid conversion funnel.
- **Conversion** is quantified: quote acceptance, quote → invoice, invoice →
  paid, and deal win rates — each `null` when there is no baseline, never a
  misleading zero.
- **Retention** is visible: contacts by lifecycle stage and a behavioural cohort
  measure (contacts created in the range who still have activity afterwards).
- **Bookings** analytics exist: appointment volume by status, booking value
  (service price at booking time), and cancellation/no-show rates.
- **Performance** is measurable: conversation volume, first-response time,
  escalation rate, workload per assignee, and campaign delivery counts.
- **Forecasting** exists: the weighted pipeline value (Σ open deal × stage win
  probability, decomposed per stage) plus a 3-month trailing-average projection
  explicitly labelled "past trend, not a commitment".
- **Charts** render all of the above with the house primitives (`TrendChart`,
  `ComparisonChart`, `Sparkline`) and the accessible table fallback.
- **Typecheck, lint, unit/integration/E2E, and build all pass**, and axe audits
  the analytics page clean.

### Bugs the test suite found and fixed

1. **Async server components cannot be rendered in jsdom** (React 19: "Only
   Server Components can be async at the moment"). The first component tests
   tried to render the async sections directly and timed out. Fixed by splitting
   each section into a presentational client component (data as props) with the
   server page doing the fetching — the exact same split as the dashboard's
   `RevenueChart` vs page.
2. **The permissions test caught `analytics:read` missing on the `member`
   role.** The first edit added it to owner/admin/viewer but the member block was
   missed; the privilege-ordering test failed. Fixed — the role matrix is
   complete.
3. **E2E strict-mode violations** on strings that appear multiple times
   (`SAR 1,150` appears in invoiced + collected metrics and the chart table;
   `Qualified` appears in the funnel and forecast). Fixed with exact and
   `.first()` matchers.

---

## Files Created

| Path | Purpose |
|---|---|
| `src/features/analytics/repositories/analytics.types.ts` | Row types for the analytics reads. |
| `src/features/analytics/repositories/analytics.repository.ts` | The only analytics DB access; `forScope` everywhere. |
| `src/features/analytics/services/analytics.service.ts` | Pure view-model math: revenue, funnels, conversion, retention, bookings, performance, forecast. |
| `src/features/analytics/services/analytics.service.test.ts` | 10 unit tests (`rate`, currency/duration formatting, weighted forecast math). |
| `src/features/analytics/validators/analytics.validators.ts` | Zod schemas (range enum, query, set-range body). |
| `src/features/analytics/lib/range.ts` | `30d/90d/180d/12m` cookie → inclusive UTC bounds. |
| `src/features/analytics/components/revenue-section.tsx` | Presentational: invoiced/collected/outstanding/refunds KPIs + trend. |
| `src/features/analytics/components/funnel-section.tsx` | Presentational: pipeline funnel + quote→invoice→paid funnel. |
| `src/features/analytics/components/conversion-section.tsx` | Presentational: the four conversion rates. |
| `src/features/analytics/components/retention-section.tsx` | Presentational: lifecycle distribution + cohort retention. |
| `src/features/analytics/components/bookings-section.tsx` | Presentational: status bar chart + value + no-show/cancellation. |
| `src/features/analytics/components/performance-section.tsx` | Presentational: conversations, response, escalation, workload, campaigns. |
| `src/features/analytics/components/forecast-section.tsx` | Presentational: weighted forecast + labelled projection. |
| `src/features/analytics/components/analytics-range-picker.tsx` | Client range picker (cookie → refresh). |
| `src/features/analytics/components/analytics.components.test.tsx` | 6 component tests (populated states, axe-clean). |
| `src/features/analytics/tests/analytics.integration.test.ts` | 8 real-Postgres tests: revenue sums, funnel, forecast, bookings, retention, performance, **org A never sees org B**. |
| `src/app/api/analytics/` | Read-only routes: revenue, funnels, conversion, retention, bookings, performance, forecast, range. |
| `src/app/(app)/analytics/page.tsx` | Server page: fetches per-widget data, renders sections behind Suspense. |
| `tests/e2e/analytics.spec.ts` | Seeded sections render, range switch, axe clean. |
| `docs/api/analytics.md` | API reference. |

## Files Modified

| Path | Change |
|---|---|
| `src/features/auth/permissions.ts` | `analytics:read` across all four roles. |
| `src/features/auth/navigation.ts` | `Analytics` nav item. |
| `src/components/sidebar-nav.tsx` | `chart-column` icon registered. |
| `src/middleware.ts` | `/analytics` in the protection matcher. |
| `README.md` | Status updated to Milestone 15. |
| `.claude/CHANGELOG.md` | Milestone 15 entry. |
| `docs/architecture/overview.md` | "Current as of Milestone 15". |

---

## Tests Completed

| Type | Count | Coverage | Command |
|---|---|---|---|
| Unit (service) | 10 | `rate` rounding, currency/duration formatting, weighted forecast math | `npm run test` |
| Component (analytics) | 6 | revenue/funnel/forecast populated states, axe-clean | `npm run test` |
| Integration (analytics) | 8 | real Postgres: revenue sums, funnel taper, weighted forecast, bookings value, lifecycle counts, performance, **org A never sees org B** | `npm run test` |
| **Vitest total** | **839 passing overall** (up from 816) | — | `npm run test` |
| E2E (analytics) | 3 × 2 projects | seeded sections render, range switch, axe clean | `npm run test:e2e` |

Gate at close: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run test:e2e`, `npm run build`, and `npm run db:check-drift` all pass. axe
audits the analytics page clean.

### What the integration tests assert

Revenue sums invoiced/collected/outstanding and excludes org B; the pipeline
funnel counts open deals per stage; the weighted forecast multiplies deal value
by stage probability (1000×0.1 + 4000×0.5 + 2000×1.0 = 4100) and excludes org B;
bookings count by status and value at service price (2 × 150 = 300, no-show rate
50%); lifecycle counts split by org; performance counts conversations and
escalations per org. The non-negotiable org A never sees org B is asserted for
invoices, deals, appointments, and contacts.

### Deliberately not covered

- **A live ML forecast.** Forecasting is deterministic math (weighted pipeline +
  trailing average) by design — the PRD asks for forecasting, not an ML model.
- **Drill-down to individual rows.** Analytics are aggregates; the underlying
  rows live in their own feature surfaces (invoices, CRM, appointments).

---

## Performance

Measured against the seeded Northwind Dental database (17 contacts, 24 deals, 13
appointments, 17 conversations) with `performance.now()` around each service
method, at `90d` range:

| Method | Time (ms) |
|---|---|
| `getRevenue` | 1422 |
| `getFunnels` | 435 |
| `getPerformance` | 484 |
| `getConversion` | 293 |
| `getRetention` | 224 |
| `getForecast` | 171 |
| `getBookings` | 112 |

All are single scoped reads; the heaviest (`getRevenue`) parallelises five
queries and then builds a 90-point daily series — sub-second at seed volume with
the widest range. The per-widget Suspense boundaries mean the slowest section
delays only itself. `getPerformance` includes the first-response-time
per-conversation message lookups (the dashboard's established pattern); it stays
bounded by conversation count. No per-read work beyond the derivations.

## Security Review

Per `SECURITY_RULES.md` pre-merge checklist:

- [x] No secrets added, logged, or printed — new env vars: none.
- [x] All new inputs validated with a strict schema — the `range` query is a
  closed enum via Zod; the PATCH body is validated.
- [x] Every new query is tenant-scoped and tested for isolation — all reads
  through `forScope`; the integration suite proves org A never sees org B's
  invoices, deals, appointments, or contacts.
- [x] New routes have explicit auth + authz checks — `requirePermission`
  (`analytics:read`) on every route and the page.
- [x] Webhook signature verification untouched and still tested — no webhook
  surface added.
- [x] No PII in logs, traces, fixtures, or error messages — analytics are
  aggregates only; no contact names, phone numbers, or message bodies cross
  into the view model. Test fixtures use synthetic `+9665000` numbers.
- [x] Rate limits applied to new send/auth/AI endpoints — M15 adds read-only
  endpoints only; rate limiting remains a scheduled milestone (M23).
- [x] `npm audit` clean at high and critical — 0 vulnerabilities (the nanoid /
  hono overrides from the M14 close hold).
- [x] Destructive operations require confirmation and are audit-logged — no
  destructive surface added (read-only milestone).

---

## Known Limitations

1. **The booking value uses today's service price**, not the price at booking
   time — `Appointment` has no amount column, and the M4 schema's join through
   `Service` is the only source. A price change reprices history.
2. **The projection is a 3-month trailing average** — deliberately crude and
   explicitly labelled. No seasonality, no ML. Forecasting is a starting point,
   not a promise.
3. **Retention's "active" test is appointments/invoices/conversations after the
   range end** — a behavioural proxy, not a true cohort table. With no analytics
   tables, this is the honest derivation available.
4. **No drill-down** — the analytics page shows aggregates; clicking through to
   the underlying rows is future work.

---

## Exit Criteria

- [x] Every task in the plan's scope
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors, zero warnings
- [x] Unit, integration, component, and E2E tests exist and pass (839 total)
- [x] `npm run build` succeeds
- [x] `npm run db:check-drift` — green
- [x] axe audits the analytics page clean
- [x] Docs updated — `CHANGELOG.md`, `docs/api/analytics.md`, this file
- [x] `MILESTONE_15_COMPLETED.md` written

All met.
