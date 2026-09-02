# Milestone 11 — Quotation System — Progress

Status: Complete — re-certified 2026-08-23
Started: 2026-08-14
Last updated: 2026-08-23

> **Batch decision**: Work on milestones 9–11 was executed as one approved batch
> ("approved through M11, proceed on green"): sequential implementation, per-milestone
> exit gates, per-milestone PLAN/PROGRESS/COMPLETED docs, and per-milestone commits.
> This file records that decision for the audit trail. Any red gate stops the whole
> batch.
>
> **Naming correction**: `ARCHITECTURE_RULES.md` §5 maps this milestone to the
> `quotations` feature. The feature was built as `src/features/quotes/`; per the
> user's direction it was renamed to `src/features/quotations/` (dirs, modules,
> classes) with the `/quotes` pages and `/api/quotes` routes unchanged (public
> contract). See the Completed doc.

## Completed Tasks

- [x] Quotes created as drafts with line items, sequential per-org numbers, VAT totals
- [x] Lifecycle draft → sent (version snapshot) → accepted/rejected/expired; edit guards
- [x] VAT math stored (rate AND amount at write time); `computeTotals` pure
- [x] Templates per branch with branding; footer flows into PDF
- [x] Dependency-free PDF 1.4 export (line items, VAT, totals, branding)
- [x] Quote list + create dialog (live VAT preview) + detail page (lifecycle, PDF, versions)
- [x] Feature renamed `quotes` → `quotations` per architecture doc (user-approved)
- [x] Typecheck, lint, unit/integration/E2E, build all pass; axe audits clean
- [x] Multi-page PDF object graph and configured primary branding color repaired;
      send transition restricted to drafts as documented

## Pending Tasks

None — milestone complete.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | `taxRate` required by validator but never sent by the UI — every dialog create 400'd | Resolved | Validator makes `taxRate` optional; server applies `DEFAULT_VAT_RATE` (0.15) |
| 2 | E2E create assertion looked for line description in the list (list shows contact name) | Resolved | Assert on the created quote's unambiguous `368.00 SAR` total |
| 3 | E2E create-test cleanup raced the org switch — created quote could survive `deleteMany by org` | Resolved | Test captures the created quote id from the POST response and deletes by id first |
| 4 | Full-suite E2E stalled randomly under 4-way parallel load (ai/inbox/knowledge, not quotes) | Resolved | `playwright.config.ts` capped to `workers: 1` matching CI; deterministic |
| 5 | One-off `ECONNRESET` on `POST /api/organizations` during the CRM E2E setup in a full 186-test run | Resolved (environmental) | Infra-level connection drop, not a code defect; the CRM spec passes 10/10 at `workers: 1` in isolation and in its full spec |
| 6 | Every PDF page referenced object 4 as the font, but object 4 is a content stream | Resolved 2026-08-23 | Font object id is computed after all page/content pairs and shared by every page; multi-page regression added. |
| 7 | Template branding colors were stored but ignored by PDF output | Resolved 2026-08-23 | Valid `branding.colors.primary` hex values are emitted as PDF RGB commands. |
| 8 | Rejected/expired quotes could be sent again despite the draft-only lifecycle | Resolved 2026-08-23 | `send` now accepts only `draft`. |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-14 | `taxRate` optional in the API | UI need not send it; server default matches schema CHECK | Requiring it client-side |
| 2026-08-14 | Feature named `quotations` (renamed from `quotes`) | `ARCHITECTURE_RULES.md` §5 maps M11 to `quotations`; user-approved | Keeping `quotes` and noting deviation |
| 2026-08-14 | E2E workers capped to 1 locally | 4-way parallelism stalled data-fetch tests randomly; house rule forbids retrying flakes | Per-test timeout bumps (didn't fix the stall) |

## Database Changes

No schema changes in M11 — the M4 schema already designed `quotes`,
`quote_line_items`, `quote_versions`, `quote_templates`.

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `/api/quotes` (GET/POST), `/api/quotes/[id]` (GET/PATCH), `/api/quotes/[id]/pdf`, `/api/quotes/templates` (GET/POST) | New quotation API surface | No (new surface) |

## Breaking Changes

None.
