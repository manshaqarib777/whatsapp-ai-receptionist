# Milestone 12 — Invoices

Created: 2026-08-14
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 12`
Status: Approved implementation complete; external gateway rollout remains M19

---

## Objective

Build the Invoicing and Payments system: invoices, payments, receipts, refunds,
and the payment-gateway seam (Stripe, HyperPay, PayTabs, STC Pay, Apple Pay).
The M4 schema already designed `Invoice`, `InvoiceLineItem`, `Payment`, `Refund`,
and `PaymentEvent` — including the unique `gatewayPaymentId`/`gatewayRefundId`
idempotency keys, the `PaymentEvent` webhook journal (payload never holds card
data, so the system stays out of PCI scope), and the five-gateway enum. This
milestone implements the service layer, API, and UI on top.

True after this milestone, and not true now:

- Invoices are created from a quote (or standalone) with line items, sequential
  per-organization numbers, and VAT totals; the lifecycle is
  draft → issued → partially paid → paid / overdue / void.
- Payments are recorded against an invoice through a gateway seam; a webhook
  journal captures every gateway event with idempotent replay (unique keys).
- Receipts exist as a payment surface; refunds are recorded against a payment
  with a reason.
- The `/invoices` UI lists, filters, and opens invoices; a detail page shows
  line items, totals, payment history, refunds, and the lifecycle actions.
- Typecheck, lint, unit/integration/E2E, and build all pass; axe audits the
  invoice pages clean.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` +
`npm run test:e2e` pass; `npm run build` succeeds.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 12`:

```
Invoices

Payments

Stripe

HyperPay

PayTabs

STC Pay

Apple Pay

Receipts

Refunds

STOP
```

---

## Architecture Decisions

### AD-1 — `src/features/invoices/` feature domain

```
src/features/invoices/
  repositories/invoices.repository.ts   # only DB access; forScope everywhere
  services/invoices.service.ts          # pure orchestration; VAT, numbering, lifecycle
  services/payments.ts                  # gateway seam (Stripe first) + webhook handling
  validators/invoices.validators.ts     # zod schemas for all routes
  hooks/use-invoices.ts                 # React Query hooks + mutations
  components/invoice-list.tsx           # status-filtered list
  components/create-invoice-dialog.tsx  # line-item editor, from a quote or standalone
  components/invoice-detail.tsx         # line items, totals, payments, refunds, lifecycle
  components/refund-dialog.tsx          # refund a payment
```

The repository is the only layer that touches the database; every query runs
through `forScope`. `Invoice`, `InvoiceLineItem`, `Payment`, `Refund`,
`PaymentEvent` are BRANCH-scoped, so writes derive a branch scope from the
default branch (same pattern as quotations).

### AD-2 — Gateway seam: one interface, adapters per provider

The PRD lists five gateways. The service depends on a narrow `PaymentGateway`
interface (create payment, handle webhook, refund). Stripe is the first real
adapter (test-mode credentials); HyperPay, PayTabs, STC Pay, and Apple Pay are
registered as `unconfigured` adapters that return a clear "gateway not
configured" error until their SDKs and credentials land. The enum already exists
in the schema; the seam is open/closed per `ARCHITECTURE_RULES.md` §13.

Webhooks are **idempotent by construction**: `PaymentEvent.gatewayEventId` and
`Payment.gatewayPaymentId` are unique, so a retried webhook upserts a no-op
(P2002 swallowed) rather than double-applying.

### AD-3 — Invoices from quotes

`POST /api/invoices` accepts an optional `quoteId`; when present, the service
copies the quote's line items, totals, currency, and contact into the invoice
and links it (`invoice.quoteId`). A quote can be invoiced once — a second
invoice from the same quote is refused (409). The quote's accepted state is not
required (a draft quote can be invoiced), but the invoice always reflects the
quote's stored rate+amount VAT columns.

### AD-4 — Sequential numbering, uniqueness by the schema

`nextInvoiceNumber` mirrors quotations: `INV-1000`, `INV-1001`, … per
organization among non-deleted rows. Uniqueness per organization is a schema
property (`number` + org), so concurrent creates cannot collide.

### AD-5 — API surface

| Route | Method | Permission | Body / query | Returns |
|---|---|---|---|---|
| `/api/invoices` | GET | `invoice:read` | `?status=` | `{ invoices }` |
| `/api/invoices` | POST | `invoice:write` | `{ contactId, quoteId?, lineItems[], ... }` | `{ invoice }` 201 |
| `/api/invoices/[id]` | GET | `invoice:read` | — | `{ invoice, payments }` |
| `/api/invoices/[id]` | PATCH | `invoice:write` | `{ action }` or draft edit | `{ invoice }` |
| `/api/invoices/[id]/payments` | POST | `invoice:write` | `{ gateway, amount, currency }` | `{ payment }` 201 |
| `/api/invoices/[id]/pdf` | GET | `invoice:read` | — | `application/pdf` |
| `/api/payments/[id]/refunds` | POST | `invoice:write` | `{ amount, reason }` | `{ refund }` 201 |
| `/api/webhooks/payments/[gateway]` | POST | signature | gateway payload | `{ received: true }` |

Cross-tenant or missing ids are 404, never 403. Only-draft edits and illegal
transitions are 409.

### AD-6 — Payments and the webhook journal

Recording a payment creates a `Payment` (status `pending`) and returns the
gateway checkout/redirect surface. The gateway webhook handler looks up the
payment by `gatewayPaymentId`, appends a `PaymentEvent` (idempotent), and
advances `Payment.status` → `succeeded`/`failed`. A succeeded payment sets
`Invoice.amountPaid`, and when `amountPaid >= totalAmount` the invoice becomes
`paid` (`paidAt`). Refunds create a `Refund` (unique `gatewayRefundId`) and
recompute `amountPaid` downward.

---

## Dependencies

- **Stripe SDK** (`stripe`) — the first real gateway adapter, test-mode only in
  M12. Requires `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (test keys) in the
  environment; the service degrades to `unconfigured` without them.
- No other new packages: HyperPay/PayTabs/STC Pay/Apple Pay adapters are stubs
  behind the seam until their SDKs land.
- Upstream: M11 quotations (invoice-from-quote), M4 schema.

## Database Impact

No schema changes. The M4 schema already provides `invoices`,
`invoice_line_items`, `payments`, `refunds`, `payment_events` with the unique
idempotency keys and the gateway enum. `schema-change.md` is untouched.

## API Impact

New surface (AD-5). All routes follow the house envelope (`withApiHandler`,
`jsonSuccess`, Zod validation, correlation id). Webhook routes verify the
gateway signature before touching state. No breaking changes.

## UI Impact

- `/invoices` — status-filtered list (draft/issued/partially_paid/paid/overdue/
  void) with a create doorway (from quote or standalone line items).
- `/invoices/[id]` — detail: line items, totals, payment history, refunds, the
  lifecycle actions (issue, mark paid, void), a PDF download, and a
  record-payment dialog (Stripe test-mode checkout; other gateways "not
  configured").
- States: loading/error/empty per the house component rules. Responsive and
  axe-clean (WCAG 2.2 AA).

## AI Impact

None. Invoices are deterministic business documents; no model calls, no
prompts. The AI engine's tool surface does not gain an invoice tool in M12
(that is a later milestone if the PRD asks).

## Security Considerations

- **PCI scope**: the `PaymentEvent.payload` schema comment forbids card data.
  The webhook handler must never log or persist PAN/CVV. The journal stores the
  gateway event id + kind + non-card payload only.
- **Webhook signature verification**: each gateway adapter verifies its
  signature before processing; unverified payloads are 401 and never journaled.
- **Tenant isolation**: every query through `forScope`; cross-tenant reads are
  404. Payments are matched to invoices strictly by org-scoped lookup.
- **Secrets**: Stripe keys are env-only, never committed; the adapter reads them
  from the validated env (`src/lib/env.ts`).
- **Idempotency**: unique `gatewayPaymentId`/`gatewayRefundId`/`gatewayEventId`
  make webhook replays structurally no-ops (P2002 swallowed) — a retry cannot
  double-charge or double-refund.

## Testing Strategy

- **Unit**: VAT math (reuse `computeTotals` pattern), numbering, lifecycle
  guards, webhook idempotency (duplicate `gatewayEventId` → no-op), refund math.
- **Component**: list/detail/refund states (loading/error/empty/populated),
  lifecycle buttons, axe-clean.
- **Integration** (real Postgres): invoice-from-quote (copy + link + once-only
  409), standalone create with totals, sequential numbering, lifecycle
  transitions, payment → paid, webhook replay idempotency, refund recomputes
  amountPaid, **org A never sees org B**.
- **E2E**: seeded list, create from dialog, issue → record payment → paid, PDF
  download, axe clean.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Gateway SDK/credentials unavailable | High | Stripe path can't be exercised live | Test-mode keys + `unconfigured` adapters for the other four; webhook handler unit-tested with synthetic signed payloads |
| Webhook replay double-applies | Medium | Over/under-charging | Unique keys + swallowed P2002, integration-tested |
| PCI exposure via payload/logs | Low | Severe | Schema forecloses card data; handler strips non-card fields; audit test asserts no PAN in journal |
| Invoice-from-quote edge cases | Medium | Wrong document | Copy stored rate+amount columns verbatim; once-only guard integration-tested |
