# Reviews API

Milestone 16. All routes are wrapped in `withApiHandler` (correlation id,
structured logging, consistent envelope), require an authenticated session with
an active organization, and validate request bodies with Zod. Errors return the
standard `{ error: { code, message, details? } }` envelope.

Tenant scope always comes from the session — never from a request parameter.
Every query runs through `forScope`, so a cross-tenant read or write returns 404
(house rule). `ReviewPlatform`, `ReviewRequest`, and `Review` are branch-scoped;
writes go through the org's default branch.

Permissions (`review:read` / `review:write`):

| Role | read | write |
|---|---|---|
| owner | ✓ | ✓ |
| admin | ✓ | ✓ |
| member | ✓ | ✓ |
| viewer | ✓ | — |

## Consent invariant

A review request is only ever created for a contact who has consented and not
opted out — a request for a non-consenting or opted-out contact is refused with
422, never silently skipped. This matches the M14 broadcast invariants.

## Platforms

### `GET /api/reviews/platforms`

Review platforms (Google / Facebook) with connection state. The Google/Facebook
API seam is `unconfigured` in M16 — the real integrations need OAuth
credentials — so both platforms are created (if absent) and reported as
unconfigured. Soft-deleted rows excluded.

Response: `{ data: { platforms } }` — `{ id, name, provider, isConnected,
createdAt }`.

## Requests

### `GET /api/reviews/requests?status=`

Review requests, optionally filtered by `status`
(`created|sent|responded|expired|cancelled`). Newest first. Soft-deleted rows
excluded.

Response: `{ data: { requests } }` — `{ id, contactId, contactDisplayName,
appointmentId, appointmentStartsAt, platformId, platformName, platformProvider,
status, sentAt, respondedAt, expiresAt, createdAt }`.

### `POST /api/reviews/requests`

Creates a review request. Requires `review:write`. Body:

```json
{
  "contactId": "…",
  "appointmentId": "…",
  "platformId": "…"
}
```

The appointment must exist (404), be `completed` (409 otherwise), belong to the
same contact (422), and the contact must have consented (422). The request is
created `created` with an `expiresAt` 14 days out. Response (201):
`{ data: { request } }`.

### `PATCH /api/reviews/requests/[id]`

Lifecycle transition. Requires `review:write`. Body:

```json
{ "action": "send" | "cancel" }
```

- `send` marks a `created` request `sent` (`sentAt`) through the transport stub
  seam (the real WhatsApp path lands with the messaging milestone). A
  non-created request cannot be sent (409).
- `cancel` aborts a `created` or `expired` request. A `sent` or `responded`
  request cannot be cancelled (409).

Cross-tenant or missing ids return 404. Response: `{ data: { request } }`.

## Reviews

### `GET /api/reviews?status=`

Reviews, optionally filtered `?status=needs-attention` (ratings below 4).
Newest first by `receivedAt`. Soft-deleted rows excluded.

Response: `{ data: { reviews } }` — `{ id, contactId, contactDisplayName,
platformId, platformName, platformProvider, requestId, rating, text,
externalReviewId, receivedAt, createdAt, needsAttention }`.

### `POST /api/reviews`

Records a review. Requires `review:write`. Body:

```json
{
  "contactId": "…",
  "platformId": "…",
  "requestId": "…",
  "rating": 4,
  "text": "Great service",
  "externalReviewId": "…"
}
```

`rating` must be 1–5 (422 otherwise); `contactId` and `platformId` must exist in
the org (404). When `requestId` is present, the linked request advances to
`responded` (`respondedAt`). Response (201): `{ data: { review } }`.

## Automation worker

`npm run reviews:work` runs the DB-polled worker: per organization it finds
completed appointments past a 24-hour grace window whose contacts have
consented and have no review request, creates a request against the Google
platform (ensuring the default platforms exist), and marks it `sent` through
the stub seam. It also sweeps sent requests whose `expiresAt` has passed into
`expired`. Idempotent via the unique `(appointmentId, platformId)` guard.
