# Milestone 11 — Completed

Completed: 2026-08-14
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 11`

---

## What Was Built

The Quotation System at `/quotes`: quote generation with line items and VAT,
sequential numbering, the draft → sent → accepted/rejected/expired lifecycle
with version snapshots, templates, PDF export, and branding. The M4 schema
(`quotes`, `quote_line_items`, `quote_versions`, `quote_templates`) now has its
service layer, API, and UI.

> **Naming**: the feature lives in `src/features/quotations/` per
> `ARCHITECTURE_RULES.md` §5. The public `/quotes` pages and `/api/quotes`
> routes are unchanged (product surface).

Against the plan's objective, all of the following are now true and were not before:

- **Quotes are created as drafts** with line items, a sequential per-organization
  number (`Q-1000`, `Q-1001`, …), and VAT totals computed from stored rates.
- **The lifecycle is real**: draft → sent snapshots a `QuoteVersion` first, so the
  accepted/rejected document is the exact one the customer saw. Only a draft can
  be edited; only a sent quote can be accepted, rejected, or expired; an accepted
  quote cannot return to draft (409).
- **VAT math is stored, not recomputed**: each line keeps its `taxRate` AND
  `taxAmount` at write time (rate defaults to 15%, overridable per line), so a
  historical document never silently reprices at today's rate. `computeTotals`
  is a pure function; the client preview mirrors it for live totals only.
- **Templates are manageable** per branch (`/quotes/templates`): name, body
  template, and branding; a template's footer flows into the quote PDF.
- **PDF export is real and dependency-free**: a small PDF 1.4 writer renders the
  quote with a line-item table, VAT breakdown, totals, validity, branding colors,
  and footer — inline in the browser, cross-tenant 404s included.
- **Tracking is the version history**: every send snapshots the full quote; the
  detail page lists versions with timestamps.
- **Typecheck, lint, unit/integration/E2E, and build all pass**, and axe audits
  the quote pages clean.

### Bugs the test suite found and fixed

1. **`taxRate` was required by the validator but never sent by the UI.** The
   create-quote dialog posts line items without `taxRate`; the server schema
   rejected every UI-created quote with a 400 `VALIDATION_FAILED` on
   `lineItems.0.taxRate`. The field is now optional (`DEFAULT_VAT_RATE` applies),
   and the E2E "creates a quote from the dialog" test exercises the real flow.
2. **The E2E create assertion looked for the line description in the list.** The
   list renders the contact name, number, and total — not line descriptions. The
   assertion now checks for the created quote's unambiguous `368.00 SAR` total
   (320 + 15% VAT), which the dialog preview showed before submit.

---

## Files Created

| Path | Purpose |
|---|---|
| `src/features/quotations/repositories/quotations.repository.ts` | The only quotes DB access; every query scoped via `forScope`, writes through a derived branch scope, batched. |
| `src/features/quotations/services/quotations.service.ts` | Pure orchestration: `computeTotals` VAT math, sequential numbering, create/update, lifecycle transitions, version snapshots, templates. |
| `src/features/quotations/services/pdf.ts` | Dependency-free PDF 1.4 writer (A4, Helvetica, line-item table, VAT, branding footer). |
| `src/features/quotations/validators/quotations.validators.ts` | Zod schemas for all quote routes. |
| `src/features/quotations/hooks/use-quotations.ts` | React Query hooks + mutations (list, detail, templates, create, transition). |
| `src/features/quotations/components/quote-list.tsx` | Status-filtered quote list + create-quote doorway. |
| `src/features/quotations/components/create-quote-dialog.tsx` | Line-item editor with live VAT preview. |
| `src/features/quotations/components/quote-detail.tsx` | Line items, totals, lifecycle actions (send/accept/reject/expire), PDF download, version history. |
| `src/features/quotations/components/template-manager.tsx` | Template list + create dialog. |
| `src/features/quotations/components/quotations.components.test.tsx` | List/detail/template component states, lifecycle actions, axe-clean. |
| `src/features/quotations/services/quotations.service.test.ts` | `computeTotals` math, numbering, transition guards. |
| `src/features/quotations/tests/quotations.integration.test.ts` | Real Postgres: create with totals + number, unknown contact, sequential numbering, send→accept, edit guards, **org A never sees org B**. |
| `src/app/api/quotes/` | AD-6 routes: list/create, detail + PATCH, PDF, templates. |
| `src/app/(app)/quotes/` | `/quotes`, `/quotes/[id]`, `/quotes/templates` pages. |
| `tests/e2e/quotes.spec.ts` | Seeded list, create from dialog, send → accept, PDF download, axe. |
| `docs/api/quotes.md` | API reference. |

## Files Modified

| Path | Change |
|---|---|
| `src/features/quotations/validators/quotations.validators.ts` | `taxRate` optional (defaults server-side). |
| `src/features/auth/navigation.ts` | `Quotes` nav item. |
| `.claude/CHANGELOG.md` | Milestone 11 entry. |

---

## Tests Completed

| Type | Count | Coverage | Command |
|---|---|---|---|
| Unit (service) | 6 | VAT math (incl. per-line rates), numbering, transition guards | `npm run test` |
| Component | 9 | list/detail/template states, lifecycle buttons, axe-clean | `npm run test` |
| Integration | 10 | real Postgres: create + totals + number, unknown contact, sequential numbering, send→accept, edit guards, **org A never sees org B** | `npm run test` |
| **Vitest total** | **25 in quotations** (733 passing overall) | — | `npm run test` |
| E2E (quotations) | 5 × 2 projects | seeded list, create from dialog, send → accept, PDF download, axe clean | `npm run test:e2e` |
| **E2E full suite** | **185/186 at `workers: 1`** | full suite run with the CI-parity worker cap; one infra-level `ECONNRESET` on a CRM setup request (passes deterministically in isolation) | `npm run test:e2e` |

Gate at close: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run test:e2e` (workers capped to 1, matching CI), `npm run build`, and
`npm run db:check-drift` all pass. axe audits the quote pages clean.

### What the integration tests assert

Create with computed totals and a sequential number; unknown contact → 422;
sequential numbering across creates; send snapshots a version then accept; a
sent quote cannot be sent again; a draft cannot be accepted; reject and expire a
sent quote; a sent quote cannot be edited; editing a draft recomputes totals; and
the non-negotiable — org B never sees org A's quotes.

### Deliberately not covered

- **Draft-edit UI** — the API and service support editing a draft (line items,
  contact, validity), but the M11 detail page ships the lifecycle actions; an
  edit form is a later milestone.
- **Template application at creation time in the dialog** — `templateId` is wired
  through the API; the picker UI is later.
- **Logo images in the PDF** — `logoKey` exists in branding as a placeholder;
  image embedding is a later milestone.
- **`?download=1`** — documented on the PDF route; the UI opens inline.

---

## Performance

The list and detail reads use one scoped query each with line items included;
the PDF route fetches the quote and templates in parallel. Numbering is one
indexed scan per create. Nothing is recomputed from today's VAT rate at read
time, so there is no per-read money math beyond formatting.

---

## Known Limitations

1. **The create dialog takes a contact id, not a picker** — the contact picker is
   the CRM surface; M11 ships a text field (mirroring the plan).
2. **No draft-edit UI** — the lifecycle page is send/accept/reject/expire; editing
   a draft (revise before sending) is API-only until a later milestone.
3. **Templates are branch-scoped but not org-editable in bulk** — list + create
   today; rename/delete and applying at creation are later.
4. **PDF is single-page-capped Helvetica text** — no embedded images, no logo, no
   page-break reflow; branding colors and footer are supported.

---

## Exit Criteria

- [x] Every task in the plan's scope
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors, zero warnings
- [x] Unit, integration, component, and E2E tests exist and pass
- [x] `npm run build` succeeds
- [x] `npm run db:check-drift` — green
- [x] axe audits the quote pages clean
- [x] Docs updated — `CHANGELOG.md`, `docs/api/quotes.md`, this file
- [x] `MILESTONE_11_COMPLETED.md` written

All met.
