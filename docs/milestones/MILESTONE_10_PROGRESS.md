# Milestone 10 — CRM — Progress

Status: Complete — re-certified 2026-08-23
Started: 2026-08-13
Last updated: 2026-08-23

> **Batch decision**: Work on milestones 9–11 was executed as one approved batch
> ("approved through M11, proceed on green"): sequential implementation, per-milestone
> exit gates, per-milestone PLAN/PROGRESS/COMPLETED docs, and per-milestone commits.
> This file records that decision for the audit trail. Any red gate stops the whole
> batch.

## Completed Tasks

- [x] Pipelines with ordered stages and win probability manageable per branch; default pipeline created on demand
- [x] Deals (lead/deal in one table) move through stages with persisted timeline; won/lost closes with `closedAt` (409 guards)
- [x] Companies manageable, link to contacts and deals with counts
- [x] Tags apply polymorphically (`taggables`: deal/contact/conversation), idempotent re-tagging
- [x] Activities (note/call/email/meeting/stage change/status change/assigned/tag change) form a timeline via one `recordActivity` seam
- [x] Tasks per org with assignee, due date, status; create + complete in UI
- [x] Rule-based automation (auto-assign, value threshold → tag, company default tag) in a DB-polled worker (`npm run crm:work`), idempotent via markers
- [x] Typecheck, lint, unit/integration/E2E, build all pass; axe audits clean
- [x] Company subjects fixed for automation/timelines, unreachable company PATCH moved
      to its dynamic route, and the oversized client hook split below 300 lines

## Pending Tasks

None — milestone complete.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | `Deal` model has no `tags` relation; initial `DEAL_SELECT` rejected by Prisma at runtime | Resolved | Batched `tagsForDeals` hydration keyed by deal id |
| 2 | `/api/crm/tasks/[id]` PATCH had no route (handler in `tasks/route.ts`) — E2E 404 | Resolved | Dynamic-segment handler moved to `tasks/[id]/route.ts` |
| 3 | Integration teardown deleting `branch` before `company`/`tag` failed on FK | Resolved | Teardown deletes children first |
| 4 | Company PATCH handler lived in `/companies` and could never receive `[id]` | Resolved 2026-08-23 | Moved GET/PATCH to `/api/crm/companies/[id]`. |
| 5 | Company automation wrote a `contact` tag/activity against a company UUID | Resolved 2026-08-23 | Added the `company` polymorphic subject type and migrated the enum; company tags/timeline rows are now truthful. |
| 6 | `use-crm.ts` exceeded the structural line target | Resolved 2026-08-23 | Extracted client DTO types; hook is 256 lines. |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-13 | Auto-assign is an `assigned` activity, not a column | M4 `Deal` has no assignee field; the activity doubles as idempotency marker | Schema change (out of scope) |
| 2026-08-13 | No automation API routes; `DEFAULT_RULES` compile-time config | Workflow-builder table lands at M25 | Building the builder early |
| 2026-08-13 | Timeline folded into the deal drawer | Drawer is the single surface; standalone `timeline.tsx` was an empty abstraction | Separate timeline component |

## Database Changes

The re-certification migration `20260823150000_crm_company_subject` adds `company`
to the polymorphic subject enum so company automation and timelines do not masquerade
as contacts.

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `/api/crm/pipelines`, `/api/crm/deals[/id]`, `/api/crm/companies`, `/api/crm/tags`, `/api/crm/tasks[/id]` | New CRM API surface | No (new surface) |

## Breaking Changes

None.
