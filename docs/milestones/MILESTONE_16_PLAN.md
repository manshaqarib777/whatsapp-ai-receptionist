# Milestone 16 — Reviews

Created: 2026-08-16
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 16`
Status: Completed 2026-08-17 — see `MILESTONE_16_COMPLETED.md`

---

## Objective

Build the Reviews system: review requests, reviews, feedback, Google and
Facebook platforms, and automation. The M4 ER diagram designed three Tier-2
tables — `review_platforms`, `review_requests`, `reviews` — which this milestone
migrates for the first time. The Google/Facebook review APIs are external; the
same seam pattern as the M12 payment gateways keeps them behind one interface.

True after this milestone, and not true now:

- **Review platforms are manageable**: Google and Facebook registered as
  platform rows with a connection status (connected/unconfigured), mirroring the
  payment-gateway seam.
- **Review requests are real**: a request is asked of a contact, links the
  completed appointment that triggered it, targets a platform, and follows a
  lifecycle (created → sent → responded / expired). Only consented,
  non-opted-out contacts are eligible (the M14 consent invariants apply).
- **Reviews are recorded**: a review arrives (manually entered or via a platform
  webhook stub) with a rating, text, and platform link; it hangs off the request
  that yielded it and is tenant-scoped.
- **Feedback is captured**: a review's text and rating are the feedback surface;
  a negative review (rating below a threshold) is surfaced as needing attention.
- **Automation exists**: a DB-polled worker (`npm run reviews:work`) finds
  completed appointments past a grace window whose contacts have consented, and
  creates + sends a review request through the message transport stub seam —
  the same pattern as the M9 reminder worker.
- **The `/reviews` UI** lists reviews and requests, shows platform connection
  state, and exposes a create-review doorway and the automation status.
- Typecheck, lint, unit/integration/E2E, and build all pass; axe audits the
  reviews pages clean; `db:check-drift` stays green.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` +
`npm run test:e2e` pass; `npm run build` succeeds; `npm run db:check-drift` green.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 16`:

```
Reviews

Google Reviews

Facebook

Automation

Feedback

STOP
```

---

## Architecture Decisions

### AD-1 — The three Tier-2 tables, migrated now

From `docs/database/er-diagram.md` §10 (columns indicative; this milestone owns
the real requirements):

| Table | Purpose | Key columns |
|---|---|---|
| `review_platforms` | Google / Facebook as rows | name, provider, `isConnected`, credentials ref (seam) |
| `review_requests` | A review asked of a contact | contactId, appointmentId, platformId, status, sentAt, respondedAt |
| `reviews` | The review a request yielded | requestId, platformId, rating, text, externalReviewId, receivedAt |

All three are **branch-scoped** (carry `organizationId` + `branchId`), follow
the cross-cutting column convention (`created_at`, `updated_at`, `deleted_at`,
`version`), and are tenant-isolated through `forScope`. `reviews` soft-delete
hides a review; `review_requests` never hard-deletes (audit trail).

### AD-2 — Platform seam, mirroring the payment gateways

`ReviewPlatformAdapter` interface (submit a review request / verify a webhook /
fetch reviews) with Google and Facebook adapters. Both are `unconfigured` in M16
— the real APIs need OAuth credentials that CI does not have — and fail with a
clear error rather than a silent no-op (the `UnconfiguredGateway` pattern). The
`configured` flag drives the UI's connection badge.

### AD-3 — Review request lifecycle

`created → sent → responded / expired`. Creating a request for a completed
appointment is gated on the contact's consent (`hasConsent && !optedOutAt`).
Sending marks `sent` only after the injectable transport acknowledges delivery;
an unconfigured transport throws and leaves the request durable in `created`.
A manual or webhook-entered review transitions the request to
`responded`; an unreplied request past its expiry window becomes `expired`
(worker-swept).

### AD-4 — The automation worker

`npm run reviews:work`: a DB-polled worker that, per organization, finds
`completed` appointments whose `endsAt` is past a grace window (default 24h) and
that have no existing review request; creates a `ReviewRequest` (default
platform = the first connected one, else Google) and marks it `sent` through the
stub seam. Idempotent by the unique `(appointmentId, platformId)` request guard.

### AD-5 — Feedback threshold

A review with `rating < 4` is "needs attention": the list surfaces it with a
destructive badge and the detail links back to the contact. The threshold is a
constant, not a per-org setting (no new config surface in M16).

### AD-6 — API surface

| Route | Method | Permission | Body / query | Returns |
|---|---|---|---|---|
| `/api/reviews` | GET | `review:read` | `?status=` | `{ reviews }` |
| `/api/reviews` | POST | `review:write` | `{ contactId, rating, text, platformId?, requestId? }` | `{ review }` 201 |
| `/api/reviews/requests` | GET | `review:read` | `?status=` | `{ requests }` |
| `/api/reviews/requests` | POST | `review:write` | `{ contactId, appointmentId, platformId }` | `{ request }` 201 |
| `/api/reviews/requests/[id]` | PATCH | `review:write` | `{ action: 'send' \| 'cancel' }` | `{ request }` |
| `/api/reviews/platforms` | GET | `review:read` | — | `{ platforms }` |

Cross-tenant or missing ids are 404; illegal transitions are 409; a review
request for a non-consenting contact is 422.

### AD-7 — UI

- `/reviews` — a review list (rating, platform, contact, needs-attention badge)
  with a create-review doorway.
- `/reviews/requests` — the request list (contact, appointment, platform,
  status) with a create-request dialog and send/cancel actions.
- `/reviews/platforms` — platform connection state (Google/Facebook badges).
- States: loading/error/empty per the house rules; responsive and axe-clean
  (WCAG 2.2 AA).

---

## Dependencies

No new packages. The Google/Facebook review APIs are external integrations that
need OAuth credentials — deferred behind the seam exactly like HyperPay/PayTabs
in M12. Upstream: M4 schema (Tier-2 tables designed), M9 appointments (the
trigger source), M10 CRM (contacts), M14 consent invariants.

## Database Impact

New migration: `20260816_milestone_16_reviews` creating `review_platforms`,
`review_requests`, `reviews`. Cross-cutting columns per DATABASE_RULES; enums
for `review_request_status` and `review_platform_provider`; CHECK-style
constraints on rating range and platform provider. Every FK indexed;
`(appointmentId, platformId)` unique on review requests. `schema-change.md`
gains a Milestone 16 section.

## API Impact

New surface (AD-6). All routes follow the house envelope (`withApiHandler`,
`jsonSuccess`, Zod validation, correlation id). No breaking changes.

## UI Impact

- `/reviews` — list + create doorway.
- `/reviews/requests` — request list + create/send/cancel.
- `/reviews/platforms` — platform connection state.
- Nav item + icon; `review:read` / `review:write` permissions.

## AI Impact

None in M16. Review analysis (sentiment on feedback) is a possible later
milestone; M16 stores the text and rating as data only.

## Security Considerations

| Area | Consideration |
|---|---|
| Tenant isolation | Every query through `forScope`; cross-tenant reads 404 |
| Consent | A review request for a non-consenting or opted-out contact is refused (422), never silently skipped |
| External APIs | Google/Facebook behind the seam; `unconfigured` adapters fail loudly, never fake a connection |
| PII | Review text is customer data; redacted at the logger; no phone numbers in the view model beyond the contact link |

## Testing Strategy

- **Unit**: lifecycle guards (created → sent → responded/expired), consent gate,
  feedback threshold, platform seam (unconfigured adapters throw).
- **Component**: list/request/platform states (loading/error/empty/populated),
  lifecycle buttons, axe-clean.
- **Integration** (real Postgres): platform CRUD, request create → send →
  respond, consent refusal, worker creates requests for completed appointments
  (idempotent), expiry sweep, **org A never sees org B**.
- **E2E**: seeded list, create review from dialog, request lifecycle, axe clean.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Google/Facebook APIs unavailable | High | Live review fetching can't be exercised | Seam + `unconfigured` adapters; manual-entry path is the E2E-verifiable route |
| Review request spam | Medium | Contact annoyance / compliance | Consent gate, one request per appointment+platform (unique), grace window |
| Duplicate reviews | Medium | Distorted ratings | `(appointmentId, platformId)` unique; P2002 swallowed |
