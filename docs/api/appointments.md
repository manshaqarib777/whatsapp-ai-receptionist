# Appointments API

Milestone 9. All routes are wrapped in `withApiHandler` (correlation id, structured
logging, consistent envelope), require an authenticated session with an active
organization, and validate request bodies with Zod. Errors return the standard
`{ error: { code, message, details? } }` envelope.

Tenant scope always comes from the session — never from a request parameter. The
database's exclusion constraint (`excl_appointments_resource_overlap`) is the
authoritative double-booking backstop; the repository maps the resulting Prisma
error to a `ConflictError` (409), so two requests for the same slot cannot both
succeed even if the app-level availability check races.

Permissions (`appointment:read` / `appointment:write`):

| Role | read | write |
|---|---|---|
| owner | ✓ | ✓ |
| admin | ✓ | ✓ |
| member | ✓ | ✓ |
| viewer | ✓ | — |

## Services

### `GET /api/appointments/services`

Lists the org's services.

Response: `{ data: { services: ServiceRow[] } }` — `{ id, name, description,
durationMinutes, priceAmount, priceCurrency }`.

### `POST /api/appointments/services`

Creates a service. Requires `appointment:write`. Body:

```json
{
  "name": "Routine check-up",
  "description": "Optional",
  "durationMinutes": 30,
  "priceAmount": 150,
  "priceCurrency": "SAR"
}
```

`durationMinutes` must be between 5 and 480. Response (201):
`{ data: { service } }`.

### `PATCH /api/appointments/services/[id]`

Updates one or more service fields. Requires `appointment:write`; the body is a
strict partial version of the create schema. Missing/cross-tenant ids return 404.

## Resources

### `GET /api/appointments/resources`

Lists resources with their availability rules.

Response: `{ data: { resources: ResourceRow[] } }` — `{ id, kind, name, userId,
rules: [{ weekday, startTime, endTime }] }`.

### `POST /api/appointments/resources`

Creates a resource. Requires `appointment:write`. Body:

```json
{ "kind": "staff" | "room" | "equipment", "name": "Surgery 2", "userId": null }
```

Response (201): `{ data: { resource: { id } } }`.

### `POST /api/appointments/resources/[id]/rules`

Adds a weekly availability rule. Requires `appointment:write`. Body:

```json
{ "weekday": 0, "startTime": "08:00", "endTime": "17:00" }
```

`weekday` is 0 (Sunday) through 6 (Saturday); times are 24-hour `HH:mm`.
Response (201): `{ data: { ok: true } }`.

## Availability

### `GET /api/appointments/availability?serviceId=&resourceId=&date=&timezone=`

Open slots for a service on a date. `resourceId` optional — when omitted, every
resource's slots are returned. `date` is `YYYY-MM-DD`; `timezone` is an IANA name
(the booking intent).

Slots are computed from weekly rules minus exceptions and existing
non-cancelled appointments, on a grid of the service's duration, in the given
timezone, and returned as UTC instants.

Response: `{ data: { slots: [{ resourceId, slots: [{ startsAt, endsAt }] }] } }`
— ISO-8601 instants.

## Bookings

### `POST /api/appointments`

Books an appointment. Requires `appointment:write`. Body:

```json
{
  "contactId": "…",
  "serviceId": "…",
  "resourceId": "…",
  "startsAt": "2026-08-16T09:00:00.000Z",
  "timezone": "Asia/Riyadh",
  "notes": "Optional",
  "recurrenceRule": "FREQ=WEEKLY;COUNT=3"
}
```

The slot must be open (availability check) and the database exclusion constraint
is the backstop — a race returns 409. Reminder rows are scheduled for 24h and 1h
before. A `recurrenceRule` (supported subset: `FREQ=WEEKLY|DAILY` with `COUNT` or
`UNTIL`) materialises the series' children under the parent's
`recurrenceParentId` link.

Response (201): `{ data: { appointment } }`. 409 when the slot is taken.

### `GET /api/appointments?from=&to=`

Calendar view. Requires `appointment:read`. Returns non-cancelled appointments
overlapping the `from`/`to` instants.

Response: `{ data: { appointments: AppointmentRow[] } }` — `{ id, contactId,
serviceId, resourceId, startsAt, endsAt, timezone, status, notes,
rescheduledFromId }`.

### `GET /api/appointments/[id]`

A single appointment. Requires `appointment:read`. Cross-tenant or missing ids
return 404.

### `PATCH /api/appointments/[id]`

Reschedule or cancel. Requires `appointment:write`. Body:

```json
{ "startsAt": "2026-08-17T10:00:00.000Z" }
```

or

```json
{ "cancel": true }
```

Rescheduling creates a replacement appointment linked to the original via
`rescheduledFromId`; the original is marked `rescheduled` and its reminders are
cancelled. Cancelling sets `cancelled` and cancels future reminders.

## Reminders

Reminders are rows in `appointment_reminders`, created on booking and cancelled on
cancel/reschedule. The worker (`npm run reminders:work`,
`src/workflows/appointment-reminders.worker.ts`) polls due `scheduled` rows and
hands each reminder to the configured transport. A row becomes `sent` only after
transport acknowledgement. Until Meta is configured in Milestone 19, the default
transport fails closed and the row becomes `failed`; it is never falsely reported sent.
