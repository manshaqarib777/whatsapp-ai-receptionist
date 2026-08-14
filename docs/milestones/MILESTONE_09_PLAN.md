# Milestone 9 — Appointment Engine

Created: 2026-08-13
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 9`
Status: Draft for approval

---

## Objective

Build the Appointment Engine: calendars, availability, conflict prevention,
booking, cancel, reschedule, reminders, recurring appointments, and timezone
handling. The M4 schema already designed `services`, `resources`,
`availability_rules`, `availability_exceptions`, `appointments`, and
`appointment_reminders` — including the database-level double-booking exclusion
constraint. This milestone implements the service layer, API, and UI on top.

True after this milestone, and not true now:

- Services and resources (staff/rooms/equipment) are manageable per branch.
- Availability is computed from weekly rules + exceptions, in the appointment's
  timezone, and conflicts are refused by the database constraint plus a clean API
  error.
- Bookings create confirmed/booked appointments; cancel and reschedule keep a
  linked history (`rescheduledFromId`) and update reminders.
- Reminders are scheduled (`appointment_reminders`) and a worker sends them
  (`whatsapp` channel via the existing email/message transport seam).
- Recurring appointments use an RRULE with a parent link; editing one occurrence
  creates an exception rather than materialising all instances.
- Timezone is recorded per appointment (the booking intent) and availability is
  computed in that zone.
- Typecheck, lint, unit/integration/E2E tests, and build all pass; axe audits the
  appointment pages clean.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` +
`npm run test:e2e` pass; `npm run build` succeeds.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 9`:

```
Appointment Engine

Calendars

Availability

Conflicts

Booking

Cancel

Reschedule

Reminders

Recurring

Timezone

STOP
```

---

## Architecture Decisions

### AD-1 — `src/features/appointments/` feature domain

```
src/features/appointments/
  repositories/appointments.repository.ts   # only DB access; forScope everywhere
  services/appointments.service.ts          # pure orchestration; availability, booking, cancel, reschedule
  services/availability.ts                  # slot computation from rules + exceptions, timezone-aware
  services/recurrence.ts                    # RRULE expansion + single-occurrence exception
  services/reminders.ts                     # reminder scheduling + send (worker path)
  validators/appointments.validators.ts     # zod schemas
  components/                               # calendar, booking form, cancellation, reschedule
  tests/appointments.integration.test.ts    # real Postgres (the exclusion constraint!)
  components/*.test.tsx                     # axe-clean component tests
```

Repository bound to one tenant scope (`static forOrganization`), every Prisma
query through `forScope(scope)`.

### AD-2 — Availability computation

`services/availability.ts`:

- Weekly rules (`availability_rules`: weekday + start/end) and exceptions
  (`availability_exceptions`) define a resource's open slots.
- Slots are computed in the branch/appointment timezone, then converted to UTC
  instants for storage. The `timezone` column preserves intent across DST.
- Existing booked/confirmed/cancelled-excluded appointments and pending
  reschedules are subtracted.
- Returns bounded slots (page of N) with the resource + service duration applied.

### AD-3 — Booking / cancel / reschedule

- `book(service, resource, startsAt, timezone, contact)` — validates availability
  in one transaction, inserts, and lets the **database exclusion constraint**
  reject races (surface as `ConflictError` → 409, per the M4 design).
- `cancel(id)` — sets `cancelled`, cancels future reminders.
- `reschedule(id, newStartsAt)` — creates the new appointment with
  `rescheduledFromId` pointing at the old one; the old is marked `rescheduled`.
  Reuses the same availability + constraint path.

### AD-4 — Recurring appointments

- `recurrence_rule` (RFC 5545 RRULE) on the parent; children link via
  `recurrenceParentId`.
- Creating a series writes the parent; expanding for the calendar happens at read
  time.
- Editing/cancelling one occurrence creates an exception (a child with its own
  status) rather than materialising every future instance.

### AD-5 — Reminders

- `appointment_reminders` rows scheduled from the booking (default: 24h before,
  configurable per org later).
- A worker (`src/workflows/appointment-reminders.worker.ts`, DB-polled like the
  knowledge worker, per ARCHITECTURE_RULES §11) marks due reminders `sent`/`failed`
  and delivers through the message transport seam. No Redis until M24.
- The dashboard's existing `upcomingAppointments` and M8's availability tool read
  through this service.

### AD-6 — API routes (all `withApiHandler` + `requireOrg`/`requirePermission`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/appointments/services` | `appointment:read` | List services |
| `POST /api/appointments/services` | `appointment:write` | Create service |
| `PATCH /api/appointments/services/[id]` | `appointment:write` | Update service |
| `GET /api/appointments/resources` | `appointment:read` | List resources + availability rules |
| `POST /api/appointments/resources` | `appointment:write` | Create resource |
| `POST /api/appointments/resources/[id]/rules` | `appointment:write` | Add availability rule |
| `GET /api/appointments/availability?serviceId=&resourceId=&date=&timezone=` | `appointment:read` | Open slots |
| `POST /api/appointments` | `appointment:write` | Book |
| `PATCH /api/appointments/[id]` | `appointment:write` | Reschedule / cancel |
| `GET /api/appointments?from=&to=` | `appointment:read` | Calendar view |
| `GET /api/appointments/[id]` | `appointment:read` | Appointment detail |

`appointment:read` / `appointment:write` follow the house permission pattern
(member+ write; viewer read).

---

## Dependencies

**New packages**: none required — date-fns is already present (timezone/interval
math), and RRULE parsing is small enough to implement for the supported subset
(FREQ=WEEKLY/DAILY with COUNT/UNTIL), avoiding a new dep. If the subset proves
insufficient, `rrule` is the fallback (justified in PROGRESS).

**Upstream**: 4 (schema + constraints), 6 (contacts, message transport),
8 (availability tool feeds the AI engine).

---

## Database Impact

No new migration required — M4 created all six tables plus the exclusion
constraint and indexes. `appointment_reminders` has the `(status, sendAt)`
index the worker polls.

**Seed**: `prisma/seed/scheduling.ts` already creates services, resources, rules,
and appointments; it gains reminder rows for the upcoming appointments.

**Rollback**: no production data; `prisma migrate reset` + `db:deploy`.

---

## API Impact

See AD-6. New `/api/appointments/*` routes only. The booking POST returns 409 on
conflict (the exclusion constraint surfaces as `ConflictError`).

---

## UI Impact

- `src/app/(app)/appointments/` — calendar view (`/appointments`), booking dialog,
  appointment detail with cancel/reschedule.
- Components: `calendar-view.tsx`, `booking-form.tsx`, `cancel-dialog.tsx`,
  `reschedule-dialog.tsx`, `service-manager.tsx`, `resource-manager.tsx`,
  `appointments-error.tsx`.
- Reuse: `DataTable`, `Badge`, `Button`, `Dialog`, `Tabs`, `EmptyState`/
  `ErrorState`/`LoadingState`, `PageHeader`.
- States: per-view loading skeleton, `ErrorState` with retry, `EmptyState`,
  populated. Keyboard-reachable; booking form labelled; timezone-aware display;
  axe-clean.

---

## AI Impact

The availability + booking tools registered in M8 (`availability.slots`,
`appointment.book`) now read/write through this service — the AI can propose and
book real slots behind the confirmation gate. No prompts change.

---

## Security Considerations

| Area | Consideration |
|---|---|
| Tenant isolation | Every query through `forScope`; availability and bookings scoped from session |
| Conflict integrity | The database exclusion constraint is the backstop; the API maps it to 409 |
| Authorization | `appointment:read/write` enforced server-side |
| PII | Appointment notes and contact data never logged raw |
| Timezone safety | `timezone` validated against the IANA list; a bad zone is a 400 |

---

## Testing Strategy

- **Unit**: availability slot computation (rules + exceptions + existing
  bookings + timezone), recurrence expansion + single-occurrence exception,
  reminder scheduling windows.
- **Integration** (real Postgres): booking inserts + reminder rows, **the
  double-booking constraint rejects a race with 409**, cancel cancels reminders,
  reschedule links `rescheduledFromId`, recurring series + exception, org A never
  sees org B's appointments, cross-branch isolation.
- **Component**: calendar/booking/cancel/reschedule states, axe-clean.
- **E2E**: seeded calendar renders; book → appears; cancel; reschedule; axe audits.
- **Seed**: reminder rows added to the existing scheduling seed.

**Exit gate**: typecheck (0), lint (0), `npm run test`, `npm run test:e2e`,
`npm run build`, drift check green, axe-clean appointment pages, docs +
`CHANGELOG.md` updated, `MILESTONE_09_COMPLETED.md` written.

---

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Double-booking race slips past the app check | Medium | Critical | DB exclusion constraint is authoritative; API maps to 409; integration test proves it |
| R-2 | Recurring expansion explodes | Medium | Medium | Read-time expansion bounded; exceptions stored, not materialised |
| R-3 | Timezone/DST drift in slot math | Medium | Medium | Compute in the appointment zone, store UTC; IANA-validated |
| R-4 | Reminder worker never runs in dev | Medium | Medium | `npm run reminders:work` + compose service; UI shows scheduled reminders |
| R-5 | Scope creep into M10 (CRM) | Medium | Medium | Contacts are read-only references; the CRM milestone owns them |
