# Milestone 12 — Completed

Completed: 2026-08-15
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 12`

---

## What Was Built

The Invoicing and Payments system at `/invoices`: invoice generation with line
items and VAT, sequential numbering, the draft → issued → partially_paid →
paid / overdue / void lifecycle, payments through a gateway seam, webhooks with
an idempotent event journal, refunds, and PDF export. The M4 schema
(`invoices`, `invoice_line_items`, `payments`, `refunds`, `payment_events`)
now has its service layer, API, and UI.

Against the plan's objective, all of the following are now true and were not before:

- **Invoices are created as drafts** with line items, a sequential
  per-organization number (`INV-1000`, `INV-1001`, …), and VAT totals computed
  from stored rates. A draft can be edited (line items replaced wholesale,
  totals recomputed); issued or later invoices are immutable.
- **Invoices can be created from a quote exactly once.** The quote's stored
  rate+amount columns are copied verbatim (a historical document never reprices
  at today's rate), the currency and contact come from the quote, and a second
  invoice from the same quote is refused with 409.
- **The lifecycle is real**: draft → issued (via `issue`), → paid / overdue /
  void, with `mark_paid` as the manual override for cash/offline payments.
  A paid or void invoice cannot be voided; a void invoice cannot be paid.
- **Payments record against an invoice through a gateway seam** — one narrow
  `PaymentGatewayAdapter` interface (create checkout, verify webhook, refund),
  with Stripe as the first real test-mode adapter and HyperPay, PayTabs, STC
  Pay, and Apple Pay registered as `unconfigured` adapters that fail with a
  clear error rather than a silent no-op.
- **Webhooks are idempotent by construction.** `PaymentEvent.gatewayEventId`
  and `Payment.gatewayPaymentId` are unique, so a retried webhook is a
  structural no-op (P2002 swallowed) — a replay can never double-charge. The
  journal never stores card data (payloads are whitelisted to non-card fields),
  keeping the system out of PCI scope.
- **Refunds record against a succeeded payment** with a reason and recompute
  `amountPaid` downward; a succeeded payment that has been fully refunded stops
  counting toward the balance.
- **PDF export is real and dependency-free** — the same small PDF 1.4 writer
  pattern as quotations renders the invoice with a line-item table, VAT
  breakdown, totals, amount paid / balance due, and payment terms.
- **Typecheck, lint, unit/integration/E2E, and build all pass**, and axe audits
  the invoice pages clean.

### Bugs the test suite found and fixed

1. **The seed phone-number rule was violated by the invoices integration
   test.** The seed's acceptance test ("uses only unallocated phone numbers")
   asserts every contact in the database starts with the synthetic `+9665000`
   block; the invoices test created contacts with `+9665001`, which is not the
   documented unallocated block and leaked into the seed assertion. The test now
   uses `+9665000`, and the E2E spec's fixture did too.
2. **The `mark_paid` lifecycle action existed in the service but had no UI
   doorway.** The plan's UI section lists it as a lifecycle action; the detail
   page shipped issue/pay/void but no manual "Mark paid" button, so the E2E
   "issue → mark paid → paid" flow was untestable. The button is now wired
   through the detail page's lifecycle actions and covered by an E2E test.
3. **The E2E "record payment" test only opened the dialog and cancelled.**
   The plan requires exercising the lifecycle to `paid`; with no live gateway
   in the test build, the offline `mark_paid` path is the E2E-verifiable route
   to `paid`, and the spec now asserts the full issued → paid transition.

---

## Files Created

| Path | Purpose |
|---|---|
| `src/features/invoices/repositories/invoices.types.ts` | Shared invoice row types. |
| `src/features/invoices/repositories/invoices.base.ts` | Scoped-client plumbing (tenant isolation control). |
| `src/features/invoices/repositories/invoices.mappers.ts` | Decimal → number row mappers. |
| `src/features/invoices/repositories/invoices.aggregate.repository.ts` | Invoice CRUD, numbering, line items, quote link. |
| `src/features/invoices/repositories/payments.repository.ts` | Payment + payment-event journal (idempotent). |
| `src/features/invoices/repositories/refunds.repository.ts` | Refund CRUD. |
| `src/features/invoices/repositories/existence.repository.ts` | Contact existence check. |
| `src/features/invoices/repositories/invoices.repository.ts` | Facade — the single `InvoicesRepository` surface. |
| `src/features/invoices/services/invoices.service.ts` | Orchestration: create/update, lifecycle, payments, refunds. |
| `src/features/invoices/services/totals.ts` | Pure VAT math (`computeTotals`, `lineTaxFigures`). |
| `src/features/invoices/services/gateway.ts` | The payment-gateway seam + `UnconfiguredGateway`. |
| `src/features/invoices/services/stripe.adapter.ts` | First real adapter (test-mode, env-gated). |
| `src/features/invoices/services/webhook.processor.ts` | Webhook journal + reconciliation. |
| `src/features/invoices/services/webhook.ts` | Pre-scope webhook entry (sanctioned unscoped caller). |
| `src/features/invoices/services/pdf.ts` | Dependency-free PDF writer. |
| `src/features/invoices/validators/invoices.validators.ts` | Zod schemas for all invoice routes. |
| `src/features/invoices/hooks/use-invoices.ts` | React Query hooks + mutations. |
| `src/features/invoices/components/invoice-list.tsx` | Status-filtered list + create doorway. |
| `src/features/invoices/components/create-invoice-dialog.tsx` | Line-item editor with live VAT preview. |
| `src/features/invoices/components/invoice-detail.tsx` | Detail: summary, lifecycle, PDF. |
| `src/features/invoices/components/payment-history.tsx` | Payments list + refund doorway. |
| `src/features/invoices/components/payment-dialogs.tsx` | Record-payment + refund dialogs. |
| `src/features/invoices/services/invoices.service.test.ts` | VAT math + PDF unit tests. |
| `src/features/invoices/components/invoices.components.test.tsx` | List/detail states, lifecycle, axe-clean. |
| `src/features/invoices/tests/invoices.integration.test.ts` | Real Postgres: create/quote/numbering/lifecycle/webhook/refund/org isolation. |
| `src/app/api/invoices/` | AD-5 routes: list/create, detail + PATCH, payments, PDF. |
| `src/app/api/payments/[id]/refunds/` | Refund route. |
| `src/app/api/webhooks/payments/[gateway]/` | Webhook route (signature-verified). |
| `src/app/(app)/invoices/` | `/invoices` list + `/invoices/[id]` detail pages. |
| `tests/e2e/invoices.spec.ts` | Seeded list, create from dialog, mark-paid lifecycle, PDF, axe. |
| `docs/api/invoices.md` | API reference. |

## Files Modified

| Path | Change |
|---|---|
| `src/features/auth/navigation.ts` | `Invoices` nav item. |
| `src/features/auth/permissions.ts` | `invoice:read` / `invoice:write` across roles. |
| `src/middleware.ts` | `/invoices` (and `/crm`, `/quotes`) in the protection matcher. |
| `src/lib/env.ts` | Optional `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`. |
| `package.json` | `stripe` dependency. |
| `prisma/seed/commerce.ts` | Invoice plans across every lifecycle state + refund. |
| `.claude/CHANGELOG.md` | Milestone 12 entry. |

---

## Tests Completed

| Type | Count | Coverage | Command |
|---|---|---|---|
| Unit (service) | 5 | `computeTotals` math (default + per-line rates), PDF rendering | `npm run test` |
| Component (invoices) | 7 | list/detail states, lifecycle buttons, axe-clean | `npm run test` |
| Integration (invoices) | 11 | real Postgres: create with totals + number, invoice-from-quote (copy + once-only 409), sequential numbering, issue → payment → paid, webhook replay idempotency, refund recompute, overpayment rejection, **org A never sees org B** | `npm run test` |
| **Vitest total** | **758 passing overall** | — | `npm run test` |
| E2E (invoices) | 6 × 2 projects | seeded list, create from dialog, issued → mark paid, record-payment dialog, PDF download, axe clean | `npm run test:e2e` |

Gate at close: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run test:e2e`, `npm run build`, and `npm run db:check-drift` all pass. axe
audits the invoice pages clean.

### What the integration tests assert

Create with computed totals and a sequential number; numbering across creates;
invoice-from-quote copies stored totals verbatim and refuses a second invoice
from the same quote; a draft moves through issue → payment → paid; a webhook
replay with a duplicate `gatewayEventId` is a no-op; refunding a succeeded
payment recomputes `amountPaid`; a pending payment cannot be refunded; a void
invoice cannot be paid; an overpayment above the outstanding balance is
rejected; and — the non-negotiable — org B never sees org A's invoices.

### Deliberately not covered

- **Live gateway calls.** The Stripe adapter is exercised through its interface
  with synthetic adapters in the service tests; real checkout requires test-mode
  credentials that CI does not have. The webhook path is integration-tested with
  signed synthetic payloads.
- **The other four gateways.** HyperPay, PayTabs, STC Pay, and Apple Pay are
  `unconfigured` adapters behind the seam; their SDKs and credentials land in a
  later milestone.

---

## Performance

The list and detail reads use one scoped query each with line items included;
the PDF route fetches a single invoice. Numbering is one indexed scan per
create. Payment reconciliation reads a payment list per invoice, bounded by the
invoice's own payments. Nothing is recomputed from today's VAT rate at read
time, so there is no per-read money math beyond formatting.

---

## Known Limitations

1. **The create dialog takes a contact id, not a picker** — the contact picker
   is the CRM surface (same convention as quotations M11).
2. **Only Stripe is a real gateway** — the other four PRD gateways are
   registered `unconfigured` adapters with a clear error until their SDKs land.
3. **`mark_paid` does not create a payment row** — it flips the invoice to paid
   directly for cash/offline settlements; a payment row (and thus a refundable
   record) only exists for gateway payments.
4. **PDF is single-page-capped Helvetica text** — no page-break reflow, no logo
   image; same convention as the M11 quote PDF.

---

## Exit Criteria

- [x] Every task in the plan's scope
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors, zero warnings
- [x] Unit, integration, component, and E2E tests exist and pass
- [x] `npm run build` succeeds
- [x] `npm run db:check-drift` — green
- [x] axe audits the invoice pages clean
- [x] Docs updated — `CHANGELOG.md`, `docs/api/invoices.md`, this file
- [x] `MILESTONE_12_COMPLETED.md` written

All met.
