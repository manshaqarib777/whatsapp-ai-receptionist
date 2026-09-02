# Invoices API

Milestone 12. All routes are wrapped in `withApiHandler` (correlation id,
structured logging, consistent envelope), require an authenticated session with
an active organization, and validate request bodies with Zod. Errors return the
standard `{ error: { code, message, details? } }` envelope.

Tenant scope always comes from the session — never from a request parameter.
Every query runs through `forScope`, so a cross-tenant read or write returns 404
(house rule). `Invoice`, `InvoiceLineItem`, `Payment`, `Refund`, and
`PaymentEvent` are branch-scoped; writes go through the org's default branch.

Permissions (`invoice:read` / `invoice:write`):

| Role | read | write |
|---|---|---|
| owner | ✓ | ✓ |
| admin | ✓ | ✓ |
| member | ✓ | ✓ |
| viewer | ✓ | — |

## Money and VAT

- `subtotalAmount`, `taxAmount`, `totalAmount`, `amountPaid` are `Decimal(15,4)`
  and returned as numbers.
- Each line stores `taxRate` (fraction — `0.15` = 15%) **and** `taxAmount` at
  write time. Nothing is recomputed from today's rate at read time, so a
  historical invoice never reprices. `taxRate` is optional on input; the server
  applies the default (`DEFAULT_VAT_RATE` = 0.15) when omitted.
- Line totals: `lineTotalAmount = unitPriceAmount × quantity × (1 + taxRate)`.

## Invoices

### `GET /api/invoices?status=`

Invoices, optionally filtered by `status`
(`draft|issued|partially_paid|paid|overdue|void`). Soft-deleted invoices are
excluded.

Response: `{ data: { invoices: InvoiceRow[] } }` — `{ id, number, contactId,
contactName, quoteId, status, subtotalAmount, taxAmount, totalAmount,
amountPaid, currency, issuedAt, dueAt, paidAt, createdAt, updatedAt, version,
lineItems: [{ id, position, description, quantity, unitPriceAmount, taxRate,
taxAmount, lineTotalAmount }] }`. Newest first.

### `POST /api/invoices`

Creates a draft invoice. Requires `invoice:write`. Body:

```json
{
  "contactId": "…",
  "quoteId": "…",
  "currency": "SAR",
  "dueAt": "2026-09-30T00:00:00.000Z",
  "lineItems": [
    { "description": "Crown fitting", "quantity": 1, "unitPriceAmount": 1000 }
  ]
}
```

`contactId` must reference an existing (non-deleted) contact in the org — else
422. When `quoteId` is present the quote's stored line items, totals, currency,
and contact are copied verbatim and linked (`invoice.quoteId`); `lineItems` is
ignored. A quote can be invoiced **once** — a second invoice from the same quote
is 409. Without a quote, `lineItems` needs at least one item. Response (201):
`{ data: { invoice } }` with totals computed server-side and a sequential
per-organization number (`INV-1000`, `INV-1001`, …).

### `GET /api/invoices/[id]`

Invoice detail plus its payments and refunds.

Response: `{ data: { invoice, payments, refunds } }` — `payments` are `{ id,
invoiceId, gateway, gatewayPaymentId, amount, currency, status, capturedAt,
createdAt }`; `refunds` are `{ id, paymentId, gatewayRefundId, amount, currency,
reason, createdAt }`. Cross-tenant or missing ids return 404.

### `PATCH /api/invoices/[id]`

Requires `invoice:write`. Two body shapes:

1. **Status transition:**

```json
{ "action": "issue" | "void" | "mark_paid" }
```

   - `issue` moves a draft to `issued` (`issuedAt` set); only a draft can be
     issued (else 409).
   - `void` cancels; a paid or void invoice cannot be voided (409).
   - `mark_paid` is the manual override for cash/offline payments; a void
     invoice cannot be marked paid (409).

2. **Draft edit:**

```json
{
  "dueAt": "…",
  "currency": "SAR",
  "lineItems": [{ "description": "…", "quantity": 2, "unitPriceAmount": 500 }]
}
```

Only a `draft` can be edited (else 409). When `lineItems` is present they are
replaced wholesale and totals recomputed. Response: `{ data: { invoice } }`.

### `GET /api/invoices/[id]/pdf`

Renders the invoice as a PDF. Requires `invoice:read`.

Response: `application/pdf`, `Content-Disposition: inline;
filename="invoice-INV-1000.pdf"`. Cross-tenant or missing ids return 404.

## Payments

### `POST /api/invoices/[id]/payments`

Records a payment against an invoice. Requires `invoice:write`. Body:

```json
{ "gateway": "stripe", "amount": 1150, "currency": "SAR" }
```

`gateway` is one of `stripe|hyperpay|paytabs|stcpay|applepay`. The gateway seam
creates a checkout/redirect surface; the payment is stored `pending` with a
globally-unique `gatewayPaymentId`. The amount must not exceed the outstanding
balance (else 422), and a void invoice cannot be paid (409). Gateways without
configured credentials return 422 ("not configured"). Response (201):
`{ data: { payment } }`.

## Refunds

### `POST /api/payments/[id]/refunds`

Refunds a succeeded payment. Requires `invoice:write`. Body:

```json
{ "amount": 68, "reason": "Goodwill" }
```

Only a `succeeded` payment can be refunded (else 409); the refund must not
exceed the payment's unrefunded balance (else 422). Response (201):
`{ data: { refund } }`.

## Webhooks

### `POST /api/webhooks/payments/[gateway]`

Gateway webhook entry — **not** session-authenticated. The gateway verifies its
own signature (`Stripe-Signature` header via `constructEvent`); an invalid
signature is 401 and is never journaled. The owning organization is derived from
the globally-unique `gatewayPaymentId`, so the lookup cannot return another
tenant's row.

Each event appends a `PaymentEvent` to the journal. The journal's unique
`gatewayEventId` makes a retried webhook a structural no-op (P2002 swallowed) —
a replay can never double-charge. The journal never stores card data: payloads
are whitelisted to non-card fields (`id`, `status`, `payment_status`, `amount`,
`currency`, `created`, `paid_at`), keeping the system out of PCI scope.

A `checkout.session.completed` (or a payload with `payment_status: paid`)
advances the payment to `succeeded` and recomputes the invoice's paid state:
`amountPaid` is the sum of succeeded payments minus refunds, and when it reaches
`totalAmount` the invoice becomes `paid` (`paidAt` set).

Response: `{ data: { received: true } }`.
