# Milestone 11 — Quotation System

Created: 2026-08-14
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 11`
Status: Completed

---

## Objective

Build the Quotation System: generate quotes, templates, approval lifecycle, PDF
export, VAT, branding, and tracking. The M4 schema already designed
`Quote`, `QuoteLineItem`, `QuoteVersion`, and `QuoteTemplate` — including the
rate AND amount VAT columns (a historical document must not be repriced at
today's rate). This milestone implements the service layer, API, and UI on top.

True after this milestone, and not true now:

- Quotes are created as drafts with line items, sequential per-organization
  numbers, and computed VAT totals (15% default, overridable per line).
- The lifecycle is real: draft → sent (snapshotting a version) → accepted /
  rejected / expired; only a draft can be edited, only a sent quote can be
  accepted/rejected/expired.
- Templates exist per branch: name + body template + branding, and a template
  can be attached to a quote (the footer flows into the PDF).
- A printable, dependency-free PDF export renders the quote with line items,
  VAT breakdown, totals, validity, and branding footer.
- The quote detail page shows line items, totals, the status lifecycle actions,
  a PDF download, and the version history.
- Typecheck, lint, unit/integration/E2E tests, and build all pass; axe audits
  the quote pages clean.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` +
`npm run test:e2e` pass; `npm run build` succeeds.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 11`:

```
Quotation System

Generate Quotes

Templates

Approval

PDF

VAT

Branding

Tracking

STOP
```

---

## Architecture Decisions

### AD-1 — `src/features/quotes/` feature domain

```
src/features/quotes/
  repositories/quotes.repository.ts      # only DB access; forScope everywhere
  services/quotes.service.ts             # pure orchestration; VAT math, numbering, lifecycle
  services/pdf.ts                        # dependency-free PDF writer
  validators/quotes.validators.ts        # zod schemas for all quote routes
  hooks/use-quotes.ts                    # React Query hooks + mutations
  components/quote-list.tsx              # status-filtered list + create dialog
  components/quote-detail.tsx            # line items, totals, lifecycle actions, versions
  components/create-quote-dialog.tsx     # line-item editor with live VAT preview
  components/template-manager.tsx        # template list + create dialog
```

The repository is the only layer that touches the database, every query runs
through `forScope` with the scope built by `resolveScope` from the session's
organization. `Quote`, `QuoteLineItem`, `QuoteVersion`, and `QuoteTemplate` are
BRANCH-scoped, so writes derive a branch scope from the default branch.

### AD-2 — Money math: rates and amounts are both stored, at write time

Each line stores `taxRate` (the fraction that applied) AND `taxAmount` (the
money it produced), exactly as the M4 schema demands. Nothing is recomputed from
today's rate at read time — Saudi VAT moved 5% → 15% in 2020, and a historical
quote must not silently change. `computeTotals` is pure: each line's tax rounds
to 4 decimals (the schema scale), and the printed document always ties to the
stored column values.

The client preview in the create dialog mirrors this math for live totals only;
the server recomputes authoritatively on save. `taxRate` is optional in the API
(`DEFAULT_VAT_RATE` = 0.15 applies) so the dialog need not send it.

### AD-3 — Sequential numbering, uniqueness enforced by the data model

`nextQuoteNumber` scans the org's latest non-deleted quote's `Q-NNNN` number and
increments; the first quote of an org is `Q-1000`. Uniqueness per organization
is a schema property, so two concurrent creates cannot collide silently.

### AD-4 — Sending snapshots a version; the accepted/rejected document is exact

`transition('send')` first writes a `QuoteVersion` snapshot of the full quote
(the row, line items included), then flips status to `sent`. The version history
is surfaced on the detail page — the document the customer approved is
recoverable verbatim, not approximated from the current row.

### AD-5 — PDF export is dependency-free

A deliberately small PDF 1.4 writer (Helvetica text on A4, cross-reference
table) — real, printable, viewable in any reader, with no new dependency and no
server-side rendering toolchain. Logo images (`logoKey`) are a later milestone;
branding colors and footer text are supported.

### AD-6 — API surface

| Route | Method | Permission | Body / query | Returns |
|---|---|---|---|---|
| `/api/quotes` | GET | `quote:read` | `?status=` | `{ quotes }` |
| `/api/quotes` | POST | `quote:write` | `{ contactId, lineItems[], ... }` | `{ quote }` 201 |
| `/api/quotes/[id]` | GET | `quote:read` | — | `{ quote, versions }` |
| `/api/quotes/[id]` | PATCH | `quote:write` | `{ action }` or draft edit | `{ quote }` |
| `/api/quotes/[id]/pdf` | GET | `quote:read` | — | `application/pdf` |
| `/api/quotes/templates` | GET | `quote:read` | — | `{ templates }` |
| `/api/quotes/templates` | POST | `quote:write` | `{ name, bodyTemplate, branding? }` | `{ template }` 201 |

Cross-tenant or missing ids are 404, never 403; only-draft edits and illegal
transitions are 409.

---

## Scope Changes

- **Line-item editing on a draft** is included (replace line items + recompute
  totals) — the plan's "approval" requirement maps to the send → accept/reject
  lifecycle rather than a separate approval step.
- **Quote editing UI** is not built — the API supports editing a draft (line
  items, contact, validity), but the M11 detail page ships the lifecycle
  actions; an edit form is a later milestone.
- **`?download=1`** on the PDF route is documented but the UI links open inline.
- **Templates** ship as a manager (list + create) with branding footer flowing
  into the PDF; applying a template to a quote at creation time is wired through
  the API (`templateId`) but not yet in the dialog UI.
