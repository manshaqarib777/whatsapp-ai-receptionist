# Analytics API

Milestone 15. All routes are wrapped in `withApiHandler` (correlation id,
structured logging, consistent envelope), require an authenticated session with
an active organization, and validate query parameters with Zod. Errors return
the standard `{ error: { code, message, details? } }` envelope.

Tenant scope always comes from the session — never from a request parameter.
Every query runs through `forScope`, so a cross-tenant read returns 404 (house
rule). The analytics surface is **read-only**: every analytic is derived at read
time from existing rows. No analytics tables exist or are created.

Permission: `analytics:read` (owner, admin, member, and viewer all hold it).

Ranges: every route accepts `?range=` with one of `30d | 90d | 180d | 12m`
(default `30d`). Bounds are inclusive UTC.

## Revenue

### `GET /api/analytics/revenue?range=`

Invoiced vs collected vs outstanding vs refunds for the range, plus daily
invoiced and collected series.

Response: `{ data: { revenue } }` — `{ invoiced, collected, outstanding,
refunds, byStatus: [{ status, amount }], invoicedSeries: [{ date, label,
amount }], collectedSeries: [...] }`. Invoiced sums non-void invoice totals
issued in the range; collected sums `amountPaid` of invoices `paidAt` in the
range; outstanding is `invoiced - collected`.

## Funnels

### `GET /api/analytics/funnels`

The CRM pipeline as a funnel and the quote → invoice → paid conversion funnel.
Not range-dependent (a pipeline is a point-in-time view).

Response: `{ data: { funnels } }` — `{ pipeline: [{ stageName, openDeals,
openValue, winProbability }], conversion: { quotes, accepted, invoiced, paid,
acceptanceRate, invoiceRate, paymentRate } }`.

## Conversion

### `GET /api/analytics/conversion`

The four conversion rates. Not range-dependent.

Response: `{ data: { conversion } }` — `{ quoteAcceptanceRate,
quoteToInvoiceRate, invoiceToPaidRate, dealWinRate, dealWinCount,
dealLostCount }`. Rates are percentages or `null` when there is no baseline.

## Retention

### `GET /api/analytics/retention?range=`

Lifecycle distribution plus the behavioural retention of contacts created in
the range (still active afterwards — an appointment, invoice, or conversation
after the range end).

Response: `{ data: { retention } }` — `{ lifecycle: [{ lifecycleStage, count }],
createdInRange, activeOfCreated, retentionRate }`.

## Bookings

### `GET /api/analytics/bookings?range=`

Appointment volume by status, total booking value (service price at booking
time), and cancellation/no-show rates — all within `startsAt` range.

Response: `{ data: { bookings } }` — `{ byStatus: [{ status, count }], total,
value, cancelledCount, noShowCount, cancellationRate, noShowRate }`.

## Performance

### `GET /api/analytics/performance?range=`

Conversation volume, first-response time, escalation rate, workload per
assignee, and campaign delivery counts for the range.

Response: `{ data: { performance } }` — `{ conversations, escalatedCount,
escalationRate, responseTimeSeconds, assigned: [{ assigneeName, count }],
campaigns: [{ status, count }] }`.

## Forecast

### `GET /api/analytics/forecast`

The weighted pipeline forecast (Σ open deal value × stage win probability,
decomposed per stage) plus a 3-month trailing-average projection of collected
revenue. The projection is labelled `projectionIsEstimate` — it is a past
trend, never a commitment. Not range-dependent.

Response: `{ data: { forecast } }` — `{ weighted, openValue, deals, byStage:
[{ stageName, deals, value, weighted }], projection: [{ month, amount }],
projectionIsEstimate }`.

## Range cookie

### `PATCH /api/analytics/range`

Persists the chosen range in the `analytics:range` cookie (1 year,
`httpOnly`, `SameSite=Lax`). Body: `{ "range": "90d" }`. Response:
`{ data: { range } }`.
