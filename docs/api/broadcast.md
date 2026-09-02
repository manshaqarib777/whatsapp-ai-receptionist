# Broadcast API

Milestone 14. All routes are wrapped in `withApiHandler` (correlation id,
structured logging, consistent envelope), require an authenticated session with
an active organization, and validate request bodies with Zod. Errors return the
standard `{ error: { code, message, details? } }` envelope.

Tenant scope always comes from the session — never from a request parameter.
Every query runs through `forScope`, so a cross-tenant read or write returns 404
(house rule). `Segment`, `WhatsappMessageTemplate`, `Campaign`, and
`CampaignRecipient` are branch-scoped; writes go through the org's default
branch.

Permissions (`broadcast:read` / `broadcast:write`):

| Role | read | write |
|---|---|---|
| owner | ✓ | ✓ |
| admin | ✓ | ✓ |
| member | ✓ | ✓ |
| viewer | ✓ | — |

## Consent invariants (non-negotiable)

- A segment is a filter tree evaluated against contacts **at send time** — never
  a snapshot. All operators are ANDed.
- `hasConsent: true` is always required and `optedOutAt` is always excluded,
  regardless of the definition. The definition cannot weaken either.
- A campaign with **zero eligible recipients** is refused with 422 at send time
  — a broadcast to nobody is a silent no-op.

## Segments

### `GET /api/broadcast/segments`

Segments, alphabetical by name. Soft-deleted rows are excluded.

Response: `{ data: { segments } }` — `{ id, name, definition, createdAt }` where
`definition` is `{ locale?, lifecycleStage?, createdAtAfter?, dealValueMin? }`.

### `POST /api/broadcast/segments`

Creates a segment. Requires `broadcast:write`. Body:

```json
{
  "name": "Riyadh English speakers",
  "definition": { "locale": "en", "createdAtAfter": "2026-01-01T00:00:00.000Z" }
}
```

`name` is required; `definition` must contain at least one filter (422
otherwise). Response (201): `{ data: { segment } }`.

### `POST /api/broadcast/segments/[id]/preview`

Eligible contact count for a segment, evaluated at call time. Requires
`broadcast:read`. The consent and opted-out invariants are applied server-side,
so the preview is exactly what a send would materialise. Cross-tenant or
missing ids return 404.

Response: `{ data: { count } }`.

## Templates

### `GET /api/broadcast/templates`

WhatsApp message templates, alphabetical by name. Soft-deleted rows excluded.

Response: `{ data: { templates } }` — `{ id, name, language, metaStatus,
rejectionReason, body, createdAt }`.

### `POST /api/broadcast/templates`

Creates a template. Requires `broadcast:write`. Body:

```json
{
  "name": "Checkup reminder",
  "language": "en",
  "body": { "body": "Hi {{1}}, your appointment is coming up." }
}
```

Templates are unique per `(branch, name, language)` (409 on a duplicate). New
templates are created with `metaStatus: "approved"` so campaigns can use them
immediately (Meta approval is a later-milestone integration). Response (201):
`{ data: { template } }`.

## Campaigns

### `GET /api/broadcast/campaigns?status=`

Campaigns, optionally filtered by `status`
(`draft|scheduled|sending|sent|cancelled`). Newest first. Soft-deleted rows
excluded.

Response: `{ data: { campaigns } }` — `{ id, name, segmentId, segmentName,
templateId, templateName, status, scheduledFor, startedAt, finishedAt,
createdAt, updatedAt }`.

### `POST /api/broadcast/campaigns`

Creates a draft campaign. Requires `broadcast:write`. Body:

```json
{
  "name": "August checkup wave",
  "segmentId": "…",
  "templateId": "…",
  "scheduledFor": "2026-08-19T10:00:00.000Z"
}
```

`segmentId` and `templateId` must reference existing rows in the org (404
otherwise). The template must be `approved` (409 otherwise); a segment with no
filters cannot target anyone (422). `scheduledFor` is optional — omit to send
as soon as the campaign is started. Response (201): `{ data: { campaign } }`.

### `GET /api/broadcast/campaigns/[id]`

Campaign detail plus its analytics and materialised recipients. Cross-tenant or
missing ids return 404.

Response: `{ data: { campaign, analytics, recipients } }` — `analytics` is
`{ total, sent, delivered, read, failed, deliveredRate }` derived from the
recipient rows (`deliveredRate` is `null` when nothing has been attempted);
`recipients` are `{ id, contactId, contactDisplayName, phoneNumber, status,
failureReason }`.

### `PATCH /api/broadcast/campaigns/[id]`

Lifecycle transition. Requires `broadcast:write`. Body:

```json
{ "action": "schedule" | "send" | "cancel", "scheduledFor": "…" }
```

- `schedule` sets `scheduledFor` (required when the campaign is a draft without
  one) and advances to `scheduled`; only a draft or scheduled campaign can be
  re-scheduled (409 otherwise).
- `send` materialises the recipients from the segment evaluation (consent
  applied, unique `(campaignId, contactId)`) and advances to `sending`. A
  zero-eligible campaign is refused with 422.
- `cancel` aborts a draft, scheduled, or sending campaign (409 when already
  sent or cancelled).

Illegal transitions are 409. Response: `{ data: { campaign } }`.

### `POST /api/broadcast/campaigns/[id]/send`

Materialise the recipients and start the send immediately. Requires
`broadcast:write`. Equivalent to `PATCH { action: "send" }`. A zero-eligible
campaign is refused with 422. Response: `{ data: { campaign } }`.

## Send worker

`npm run broadcast:work` runs the DB-polled worker: it claims due campaigns
(`scheduled` with `scheduledFor ≤ now`, or in-flight `sending`), marks their
queued recipients `sent`, and advances the campaign to `sent` (`finishedAt`).
The WhatsApp send itself is a no-op stub seam in M14 (the real transport lands
with the messaging milestone); the status columns are real and integration
tested.
