# Milestone 12 — Invoicing and Payments — Progress

Status: Core complete and re-certified 2026-08-23; four external adapters deferred to M19
Started: 2026-08-14
Last updated: 2026-08-23

> **Batch decision**: Milestones 12–14 were executed as one approved batch
> ("proceed on green"): sequential implementation, per-milestone exit gates,
> per-milestone PLAN/PROGRESS/COMPLETED docs, and per-milestone commits. This
> file records that decision for the audit trail. Any red gate stops the whole
> batch.

## Completed Tasks

- [x] Invoices created as drafts with line items, sequential per-org numbers (`INV-1000`…), VAT totals from stored rates
- [x] Invoice-from-quote exactly once (stored rate+amount copied verbatim; second invoice from the same quote refused 409)
- [x] Lifecycle draft → issued → partially_paid → paid / overdue / void; `mark_paid` manual override; edit guards
- [x] Payment-gateway seam — `PaymentGatewayAdapter` (create checkout, verify webhook, refund); Stripe first real adapter (test-mode); HyperPay/PayTabs/STC Pay/Apple Pay registered `unconfigured`
- [x] Webhook journal idempotent by construction (unique `gatewayEventId`/`gatewayPaymentId`; P2002 swallowed); payloads whitelisted to non-card fields (out of PCI scope)
- [x] Refunds record against a succeeded payment with a reason; recompute `amountPaid` downward
- [x] Dependency-free PDF 1.4 export (line items, VAT breakdown, totals, balance due)
- [x] `/invoices` list + create dialog (line-item editor with live VAT preview) + detail page (lifecycle, payments, refunds, PDF)
- [x] Typecheck, lint, unit/integration/E2E, build, `db:check-drift` all pass; axe audits clean

## Pending Tasks

None — milestone complete.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Seed phone-number rule violated by the invoices integration test (`+9665001` outside the unallocated `+9665000` block) | Resolved | Tests use `+9665000`; E2E fixture aligned |
| 2 | `mark_paid` lifecycle action existed in the service but had no UI doorway | Resolved | Detail page lifecycle actions now include Mark paid; E2E covers issued → mark paid → paid |
| 3 | E2E record-payment test only opened the dialog and cancelled | Resolved | With no live gateway in the test build, the offline `mark_paid` path is the E2E-verifiable route to `paid`; spec asserts the full transition |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-14 | Stripe first, others `unconfigured` behind the seam | Test-mode credentials available; open/closed per ARCHITECTURE_RULES §13 | Building all five SDK integrations now |
| 2026-08-14 | `mark_paid` flips the invoice directly, no payment row | Cash/offline settlements need a path; a payment row only exists for gateway payments | Forcing every settlement through a gateway |
| 2026-08-14 | Webhook idempotency by unique keys + swallowed P2002 | Replay can never double-charge | Manual dedupe lookup |

## Database Changes

No schema changes in M12 — the M4 schema already designed `invoices`,
`invoice_line_items`, `payments`, `refunds`, `payment_events` with the unique
idempotency keys.

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `/api/invoices` (GET/POST), `/api/invoices/[id]` (GET/PATCH), `/api/invoices/[id]/payments`, `/api/invoices/[id]/pdf`, `/api/payments/[id]/refunds`, `/api/webhooks/payments/[gateway]` | New invoice/payment API surface | No (new surface) |

## Breaking Changes

None.
