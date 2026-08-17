# Milestone 15 — Analytics

Created: 2026-08-16
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 15`
Status: Completed 2026-08-16 — see `MILESTONE_15_COMPLETED.md`

---

## Objective

Build the Analytics surface: revenue, funnels, performance, conversion,
retention, bookings, charts, and forecasting. The M4 schema designed no
analytics tables — this milestone derives everything at read time from the
existing invoice, deal, appointment, contact, conversation, and campaign data,
following the M5 dashboard's read-only server-component pattern.

True after this milestone, and not true now:

- **Revenue analytics** exist: invoiced vs collected revenue over a range,
  revenue by pipeline (invoiced, collected, outstanding), and a revenue trend
  chart derived from `Invoice.issuedAt` / `paidAt` / `amountPaid`.
- **Funnels** exist: the CRM pipeline rendered as a funnel (deals per stage with
  a believable taper), plus a quote → invoice → paid conversion funnel.
- **Conversion** is quantified: quote acceptance rate, quote → invoice rate,
  invoice → paid rate, and deal win rate, each over a range with a delta.
- **Retention** is visible: contacts by lifecycle stage and a cohort-style view
  of contacts created in a period still active after 30 days.
- **Bookings** analytics exist: appointment volume by status over a range,
  booking value (via `Service.priceAmount`), and no-show/cancellation rates.
- **Performance** is measurable: conversation volume, first-response time,
  escalation rate, and workload per assignee.
- **Forecasting** exists: weighted pipeline forecast (`Deal.valueAmount ×
  PipelineStage.winProbability`) plus a simple historical-trend projection.
  The `winProbability` column was planted in the M4 schema for exactly this.
- **Charts** render all of the above with the house chart primitives
  (`TrendChart`, `ComparisonChart`, `Sparkline`), each with an accessible
  visually-hidden table fallback and axe-clean audits.
- Typecheck, lint, unit/integration/E2E, and build all pass; axe audits the
  analytics pages clean.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` +
`npm run test:e2e` pass; `npm run build` succeeds.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 15`:

```
Analytics

Revenue

Funnels

Performance

Conversion

Retention

Bookings

Charts

Forecasting

STOP
```

---

## Architecture Decisions

### AD-1 — `src/features/analytics/` feature domain

```
src/features/analytics/
  repositories/analytics.repository.ts   # only DB access; forScope everywhere
  repositories/analytics.types.ts        # row types
  services/analytics.service.ts          # pure view-model math (buckets, deltas, forecast)
  services/analytics.service.test.ts     # unit tests for the pure math
  validators/analytics.validators.ts     # zod schemas
  lib/range.ts                           # analytics range cookie → dates (extends dashboard pattern)
  components/revenue-section.tsx         # revenue KPIs + trend chart
  components/funnel-section.tsx          # pipeline + quote→invoice→paid funnels
  components/conversion-section.tsx      # conversion rates
  components/retention-section.tsx       # lifecycle + cohort view
  components/bookings-section.tsx        # appointment volume + value
  components/performance-section.tsx     # conversation + response + escalation
  components/forecast-section.tsx        # weighted forecast + projection
  tests/analytics.integration.test.ts    # real Postgres, org isolation
```

Read-only, server-rendered surface (same decision as the M5 dashboard, AD-3):
no React Query, no client fetch — each widget is an async server component
behind its own `Suspense` boundary. The one client piece is the range picker
(cookie-backed, reusing the dashboard's pattern).

### AD-2 — Derive, never snapshot

No new tables. All eight areas are derived at read time from existing rows:

| Area | Source |
|---|---|
| Revenue | `Invoice` (`issuedAt`, `paidAt`, `amountPaid`, `status`), `Payment` (`capturedAt`, `status`), `Refund` |
| Funnels | `PipelineStage.position`, `Deal.stageId`/`status`, `Quote.status` |
| Conversion | `Quote.status` → `Invoice.quoteId` → `Invoice.status`/`amountPaid` |
| Retention | `Contact.createdAt`, `Contact.lifecycleStage` |
| Bookings | `Appointment.status`/`startsAt` × `Service.priceAmount` |
| Performance | `Conversation` (`lastMessageAt`, `isEscalated`, `assigneeId`), `Message` (first-response timing) |
| Forecasting | `Deal.valueAmount` × `PipelineStage.winProbability` (the planted column) |
| Campaigns | `CampaignRecipient.status` (delivery/read/failure) — surfaced under Performance |

### AD-3 — Weighted pipeline forecast

Forecast = Σ over open deals of `valueAmount × winProbability`. Probability
comes from the deal's current stage (`PipelineStage.winProbability`, `Decimal(4,3)`
0..1). A second, coarser projection is a 3-period trailing average of collected
revenue extended forward — labelled explicitly as a projection, never a promise.
No ML, no external service.

### AD-4 — Ranges

Extend the dashboard's cookie range pattern (`30d`/`90d`) to
`30d`/`90d`/`180d`/`12m` for analytics. `analytics:range` cookie, shared zod
schema, `rangeToDates` inclusive UTC bounds — same implementation shape as
`src/features/dashboard/lib/range.ts`.

### AD-5 — API surface

Read-only, so the surface is thin:

| Route | Method | Permission | Query | Returns |
|---|---|---|---|---|
| `/api/analytics/revenue` | GET | `analytics:read` | `?range=` | `{ revenue }` |
| `/api/analytics/funnels` | GET | `analytics:read` | — | `{ funnels }` |
| `/api/analytics/conversion` | GET | `analytics:read` | `?range=` | `{ conversion }` |
| `/api/analytics/retention` | GET | `analytics:read` | `?range=` | `{ retention }` |
| `/api/analytics/bookings` | GET | `analytics:read` | `?range=` | `{ bookings }` |
| `/api/analytics/performance` | GET | `analytics:read` | `?range=` | `{ performance }` |
| `/api/analytics/forecast` | GET | `analytics:read` | — | `{ forecast }` |

The page is server-rendered and calls the service directly; the API exists for
the documented surface and client reuse (house convention — every feature ships
its routes).

### AD-6 — Forecasting is honest

The forecast section renders the weighted number with its decomposition (per
stage: deals × value × probability) and labels the trailing-average projection
"past trend, not a commitment". A forecast with no open deals is an explicit
empty state, not zero.

---

## Dependencies

No new packages. Recharts is already a dependency (used by the dashboard).
Upstream: M5 dashboard (pattern + range lib), M10 CRM (pipeline/deals), M11
quotes, M12 invoices/payments, M14 campaigns.

## Database Impact

None. No new tables, columns, or indexes — every analytic is derived at read
time from existing rows. `schema-change.md` is untouched. The only planted
field, `PipelineStage.winProbability`, was created in the M4 schema.

## API Impact

New read-only surface (AD-5). All routes follow the house envelope
(`withApiHandler`, `jsonSuccess`, Zod validation, correlation id). No breaking
changes.

## UI Impact

- `/analytics` — a single page, sectioned by the eight PRD areas, each behind
  its own `Suspense` boundary with a skeleton fallback (COMPONENT_DESIGN §7).
  A range picker (30d/90d/180d/12m) sits in the header and drives the
  range-sensitive sections.
- Sections: revenue KPIs + trend, pipeline + quote-to-paid funnels, conversion
  rates, retention (lifecycle + cohort), bookings (volume + value + no-show),
  performance (conversations + response + escalation + campaigns), forecast
  (weighted + projection).
- Every chart uses the house primitives (`TrendChart`/`ComparisonChart`/
  `Sparkline`) with the accessible table fallback; every section has loading,
  error, and empty states. Responsive and axe-clean (WCAG 2.2 AA).
- `Analytics` nav item + `chart-column` icon registered.

## AI Impact

None. Analytics are deterministic derivations from stored rows; no model calls,
no prompts. (Forecasting is weighted math + a trailing average, deliberately not
an AI feature.)

## Security Considerations

| Area | Consideration |
|---|---|
| Tenant isolation | Every query through `forScope`; org-scoped reads only, never a request parameter |
| Authorization | `analytics:read` enforced server-side on every route and page |
| PII | Aggregates only — no contact names, phone numbers, or message bodies cross into analytics views |
| Rate limiting | New read endpoints only; no auth/AI/send surface added (M23 remains the rate-limit milestone) |

## Testing Strategy

- **Unit**: forecast math (`valueAmount × winProbability`, per-stage
  decomposition), conversion rate derivation (quote → invoice → paid), retention
  cohort math, revenue collected vs invoiced, range bucketing, delta/sentiment.
- **Component**: each section's loading/error/empty/populated states, axe-clean.
- **Integration** (real Postgres): revenue sums by status, funnel taper,
  quote-to-paid conversion, lifecycle counts, booking value via service price,
  weighted forecast vs seeded deals, **org A never sees org B**.
- **E2E**: seeded `/analytics` renders all sections, range switch works, axe
  clean.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Derived queries are slow at real volume | Medium | Analytics page latency | Single scoped reads per section; index-backed (`[orgId, status]`, `[branchId, startsAt]`); per-widget Suspense so one slow widget delays only itself |
| Forecast read as a promise | Medium | Trust damage | Weighted math labelled as such; projection explicitly "past trend, not a commitment" |
| Empty seed data renders misleading zeros | Medium | Charts that lie | Explicit empty states; seed already distributes deals across stages and invoices across statuses |
