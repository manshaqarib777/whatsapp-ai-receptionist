# Quotes API

Milestone 11. All routes are wrapped in `withApiHandler` (correlation id,
structured logging, consistent envelope), require an authenticated session with
an active organization, and validate request bodies with Zod. Errors return the
standard `{ error: { code, message, details? } }` envelope.

Tenant scope always comes from the session — never from a request parameter.
Every query runs through `forScope`, so a cross-tenant read or write returns 404
(house rule). `Quote`, `QuoteLineItem`, `QuoteVersion`, and `QuoteTemplate` are
branch-scoped; writes go through the org's default branch.

Permissions (`quote:read` / `quote:write`):

| Role | read | write |
|---|---|---|
| owner | ✓ | ✓ |
| admin | ✓ | ✓ |
| member | ✓ | ✓ |
| viewer | ✓ | — |

## Money and VAT

- `subtotalAmount`, `taxAmount`, `totalAmount` are `Decimal(15,4)` and returned
  as numbers.
- Each line stores `taxRate` (fraction — `0.15` = 15%) **and** `taxAmount` at
  write time. Nothing is recomputed from today's rate at read time, so a
  historical quote never reprices. `taxRate` is optional on input; the server
  applies the default (`DEFAULT_VAT_RATE` = 0.15) when omitted.
- Line totals: `lineTotalAmount = unitPriceAmount × quantity × (1 + taxRate)`.

## Quotes

### `GET /api/quotes?status=`

Quotes, optionally filtered by `status` (`draft|sent|accepted|rejected|expired`).
Soft-deleted quotes are excluded.

Response: `{ data: { quotes: QuoteRow[] } }` — `{ id, number, contactId,
contactName, dealId, templateId, status, subtotalAmount, taxAmount, totalAmount,
currency, validUntil, sentAt, acceptedAt, createdAt, updatedAt, version,
lineItems: [{ id, position, description, quantity, unitPriceAmount, taxRate,
taxAmount, lineTotalAmount }] }`. Newest first.

### `POST /api/quotes`

Creates a draft quote. Requires `quote:write`. Body:

```json
{
  "contactId": "…",
  "dealId": "…",
  "templateId": "…",
  "currency": "SAR",
  "validUntil": "2026-09-30T00:00:00.000Z",
  "lineItems": [
    { "description": "Crown fitting", "quantity": 1, "unitPriceAmount": 1000 }
  ]
}
```

`contactId` must reference an existing (non-deleted) contact in the org — else
422. `lineItems` needs at least one item; `quantity` must be positive. Response
(201): `{ data: { quote } }` with totals computed server-side and a sequential
per-organization number (`Q-1000`, `Q-1001`, …).

### `GET /api/quotes/[id]`

Quote detail plus its version history.

Response: `{ data: { quote, versions } }` — `versions` are `{ id,
versionNumber, createdAt }`, newest first. Cross-tenant or missing ids return
404.

### `PATCH /api/quotes/[id]`

Requires `quote:write`. Two body shapes:

1. **Status transition:**

```json
{ "action": "send" | "accept" | "reject" | "expire" | "mark_draft" }
```

   - `send` snapshots the current quote to a `QuoteVersion` first, then marks it
     `sent` (`sentAt` set). The snapshot is the exact document the customer saw.
   - `accept`/`reject`/`expire` require the quote to be `sent` (else 409).
   - `mark_draft` refuses an accepted quote (else 409).

2. **Draft edit:**

```json
{
  "contactId": "…",
  "dealId": null,
  "templateId": null,
  "validUntil": "…",
  "currency": "SAR",
  "lineItems": [{ "description": "…", "quantity": 2, "unitPriceAmount": 500 }]
}
```

Only a `draft` can be edited (else 409). When `lineItems` is present they are
replaced wholesale and totals recomputed. Response: `{ data: { quote } }`.

### `GET /api/quotes/[id]/pdf`

Renders the quote as a PDF. Requires `quote:read`.

Response: `application/pdf`, `Content-Disposition: inline; filename="quote-Q-1000.pdf"`.
`?download=1` makes the browser download instead of preview. Cross-tenant or
missing ids return 404.

## Templates

### `GET /api/quotes/templates`

Templates (soft-deleted excluded). Response: `{ data: { templates: TemplateRow[] } }`
— `{ id, name, bodyTemplate, branding, createdAt, updatedAt }`. `branding` is
`{ logoKey?, colors?, footer? } | null`; the footer flows into the quote PDF.

### `POST /api/quotes/templates`

Creates a template. Requires `quote:write`. Body:

```json
{
  "name": "Dental clinic standard",
  "bodyTemplate": "…",
  "branding": { "footer": "Thank you — Al Noor Dental", "colors": { "header": "#2e5b9e" } }
}
```

Response (201): `{ data: { template } }`.
