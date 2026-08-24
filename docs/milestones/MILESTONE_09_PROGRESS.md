# Milestone 9 — Appointment Engine — Progress

Status: Complete — re-certified 2026-08-23
Started: 2026-08-13
Last updated: 2026-08-23

> **Batch decision**: Work on milestones 9–11 was executed as one approved batch
> ("approved through M11, proceed on green"): sequential implementation, per-milestone
> exit gates, per-milestone PLAN/PROGRESS/COMPLETED docs, and per-milestone commits.
> This file records that decision for the audit trail. Any red gate stops the whole
> batch.

## Completed Tasks

- [x] Services and resources manageable per branch — `appointment:read/write` API + UI tab
- [x] Availability computed from weekly rules + exceptions, in the appointment's timezone, slots as UTC instants
- [x] Conflicts refused by the DB exclusion constraint (`excl_appointments_resource_overlap` → 409)
- [x] Booking creates confirmed/booked appointments and schedules reminders (24h + 1h, whatsapp channel)
- [x] Cancel and reschedule keep linked history (`rescheduledFromId`), cancel reminders
- [x] DB-polled reminder worker marks a row sent only after transport acknowledgement;
      an unavailable Meta transport fails visibly (Meta configuration is M19)
- [x] Recurring appointments (RRULE subset) with `recurrenceParentId`; edit/cancel one occurrence creates an exception
- [x] Timezone recorded per appointment, validated against IANA names
- [x] Appointment detail page with reschedule and cancel (confirm step)
- [x] Typecheck, lint, unit/integration/E2E, build all pass; axe audits clean
- [x] Real IANA/DST conversion, recurring parent links, reschedule availability/reminders,
      and the planned service-update API repaired and tested

## Pending Tasks

None — milestone complete.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Deal model had no `tags` relation in the initial `DEAL_SELECT` (M10 cross-check surfaced while reviewing the batch) | Resolved | Batched `tagsForDeals` hydration, one query not one per deal — recorded in M10 docs |
| 2 | E2E full-suite parallelism stalled data-fetch tests randomly (ai/inbox/knowledge) across the whole batch | Resolved | Playwright `workers: 1` matches CI; see `playwright.config.ts` and batch notes in M11 |
| 3 | Availability treated local business hours as UTC and did not handle DST | Resolved 2026-08-23 | Added host-independent IANA conversion, zoned day bounds, booking-date conversion, and DST tests. |
| 4 | Worker marked a no-op delivery as sent | Resolved 2026-08-23 | Transport acknowledgement is mandatory; unavailable transport records failed, never sent. |
| 5 | Recurring rows were not linked and the parent did not store its RRULE | Resolved 2026-08-23 | Parent stores the rule and every materialized child stores `recurrenceParentId`; integration-tested. |
| 6 | Planned service PATCH route was absent | Resolved 2026-08-23 | Added strict partial validation, scoped repository update, and `/services/[id]`. |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-23 | Reminder delivery fails closed until Meta is configured | Meta integration belongs to M19, but M9 must never claim a no-op was sent | Marking unacknowledged work sent |
| 2026-08-13 | Cancel/reschedule dialogs live inside the appointment detail page | Single-reachability flow — empty abstraction to split | Separate dialog files |

## Database Changes

No schema changes in M9 — the M4 schema already designed `services`, `resources`,
`availability_rules`, `availability_exceptions`, `appointments`,
`appointment_reminders`.

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `/api/appointments/*` | Service layer + API for booking, cancel, reschedule, availability, services, resources | No (new surface) |

## Breaking Changes

None.
