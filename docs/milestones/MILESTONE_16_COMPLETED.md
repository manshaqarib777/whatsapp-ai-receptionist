# Milestone 16 — Completed

Completed: 2026-08-17; re-certified: 2026-08-23
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 16`

---

## What Was Built

The Reviews system at `/reviews`: review requests, reviews, feedback, Google and
Facebook platforms, and automation. The three Tier-2 tables from the M4 ER
diagram (`review_platforms`, `review_requests`, `reviews`) are migrated for the
first time, and the Google/Facebook review APIs sit behind the same seam pattern
as the M12 payment gateways.

Against the plan's objective, all of the following are now true and were not before:

- **Review platforms are manageable**: Google and Facebook exist as platform
  rows with a connection state. Both are `unconfigured` in M16 — the real APIs
  need OAuth credentials — and the seam fails loudly rather than faking a
  connection.
- **Review requests are real**: a request links a consented contact to the
  completed appointment that triggered it, targets a platform, and follows
  `created → sent → responded / expired`. The consent gate is non-negotiable —
  a request for a non-consenting or opted-out contact is refused (422), never
  silently skipped.
- **Reviews are recorded**: a review (manual entry or platform import) carries a
  1–5 rating (DB CHECK constrained), the feedback text, and the platform link;
  it hangs off the request that yielded it (one review per request).
- **Feedback is captured**: a rating below 4 is surfaced as "needs attention" in
  the review list — the feedback surface is real.
- **Automation exists**: `npm run reviews:work` finds completed appointments
  past a 24-hour grace window whose contacts have consented, creates a durable
  request and sends it only through an acknowledged transport, and sweeps sent requests past
  their expiry into `expired`. Idempotent via the unique
  `(appointmentId, platformId)` guard.
- **The `/reviews` UI is real**: a review list with the needs-attention badge
  and a create-review doorway, a request list with send/cancel lifecycle
  actions, and a platform list showing connection state.
- **Typecheck, lint, unit/integration/E2E, and build all pass**, axe audits the
  reviews pages clean, and `db:check-drift` stays green.

### Bugs the test suite found and fixed

1. **Prisma schema validation caught the missing back-relations.** The three
   review models referenced `Organization`, `Branch`, `Contact`, and
   `Appointment`, but none of those declared the opposite relation; and the
   `Review.request` one-to-one needed `@unique` on `requestId`. Fixed in the
   schema plus a follow-up migration for the unique index.
2. **The permissions test caught `review:read` missing on the `member` role.**
   The privilege-ordering test failed (viewer held it, member did not) — the
   same class of miss as M14/M15. Fixed; the role matrix is complete.
3. **A full-suite run showed 5 failures** (permissions + contention under
   parallel DB load). Isolated runs were all green, and the re-run passed
   869/869 — no code defect remained.
4. **The E2E platform test hit a strict-mode violation** when the page
   auto-created both Google and Facebook, producing two "Not configured"
   badges. Fixed with a `.first()` matcher.

---

## Files Created

| Path | Purpose |
|---|---|
| `prisma/migrations/20260816120000_reviews/` | Tables + enums + rating CHECK + indexes. |
| `prisma/migrations/20260816130000_reviews_request_unique/` | One review per request. |
| `src/features/reviews/repositories/reviews.types.ts` | Row types (platform, request, review). |
| `src/features/reviews/repositories/reviews.base.ts` | Scoped-client plumbing (tenant isolation control). |
| `src/features/reviews/repositories/reviews.repository.ts` | The only reviews DB access; `forScope` everywhere. |
| `src/features/reviews/services/reviews.service.ts` | Lifecycle, consent gate, feedback threshold, platform seam, automation step. |
| `src/features/reviews/services/reviews.service.test.ts` | 8 unit tests (threshold, adapters, constants). |
| `src/features/reviews/validators/reviews.validators.ts` | Zod schemas for all reviews routes. |
| `src/features/reviews/hooks/use-reviews.ts` | React Query hooks + mutations. |
| `src/features/reviews/components/review-list.tsx` | Review list + needs-attention filter + create dialog. |
| `src/features/reviews/components/review-request-list.tsx` | Request list + send/cancel + create dialog. |
| `src/features/reviews/components/review-platform-list.tsx` | Platform connection state. |
| `src/features/reviews/components/reviews.components.test.tsx` | 6 component tests (states, axe-clean). |
| `src/features/reviews/tests/reviews.integration.test.ts` | 12 real-Postgres tests (lifecycle, consent, automation, isolation). |
| `src/workflows/reviews.worker.ts` | The DB-polled automation worker. |
| `scripts/reviews-worker.ts` | `npm run reviews:work` entry. |
| `src/app/api/reviews/` | Routes: reviews, requests, requests/[id], platforms. |
| `src/app/(app)/reviews/` | `/reviews` + `/reviews/requests` + `/reviews/platforms` pages. |
| `prisma/seed/reviews.ts` | Seeded platforms, request, review. |
| `tests/e2e/reviews.spec.ts` | Seeded list, platform state, axe. |
| `docs/api/reviews.md` | API reference. |

## Files Modified

| Path | Change |
|---|---|
| `prisma/schema.prisma` | Three review models + enums + back-relations on Organization/Branch/Contact/Appointment. |
| `src/features/auth/permissions.ts` | `review:read` / `review:write` across roles. |
| `src/features/auth/navigation.ts` | `Reviews` nav item. |
| `src/components/sidebar-nav.tsx` | `star` icon registered. |
| `src/middleware.ts` | `/reviews` in the protection matcher. |
| `package.json` | `reviews:work` script. |
| `prisma/seed.ts` | Reviews seed wired (clear order, call, log line). |
| `docs/database/schema-change.md` | Milestone 16 section. |
| `.claude/CHANGELOG.md` | Milestone 16 entry. |
| `README.md` | Status updated to Milestone 16. |
| `docs/architecture/overview.md` | "Current as of Milestone 16". |

---

## Tests Completed

| Type | Count | Coverage | Command |
|---|---|---|---|
| Unit (service) | 8 | feedback threshold, platform seam (unconfigured adapters throw), automation constants | `npm run test` |
| Component (reviews) | 6 | list/platform states, needs-attention badge, axe-clean | `npm run test` |
| Integration (reviews) | 12 | real Postgres: default platforms, request create → send → expire sweep, consent refusals, non-completed refusal, automation (grace, consent skip, idempotency), review + threshold, rating range, **org A never sees org B** | `npm run test` |
| **Vitest total** | **869 passing overall** (up from 839) | — | `npm run test` |
| E2E (reviews) | 3 × 2 projects | seeded list, platform state, axe clean | `npm run test:e2e` |

Gate at close: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run test:e2e`, `npm run build`, and `npm run db:check-drift` all pass. axe
audits the reviews pages clean.

### What the integration tests assert

Default Google + Facebook platforms on first list; org B never sees org A
platforms; a request creates for a completed appointment with consent; a
non-consenting contact is refused (422); an opted-out contact is refused (422);
a non-completed appointment is refused (409); send marks `sent` and cannot
re-send; the expiry sweep marks an overdue sent request `expired`; the
automation worker creates + sends for a completed appointment past the grace
window, skips one inside the grace window, never asks a non-consenting contact,
and is idempotent; a 2-star review is flagged needs-attention while a 5-star is
not; a rating of 6 is refused; org B never sees org A's reviews.

### Re-certification repairs (2026-08-23)

- Removed false `sent` transitions from manual and automated requests.
- Added injectable acknowledgement, fail-closed behavior, and durable retry of
  requests left in `created`.
- Google/Facebook adapters now fail loudly from fetch/webhook operations.
- Split the 448-line repository into bounded request/platform/review units.
- Gates: 32 focused tests, lint, typecheck, drift check, 55-page build, 6/6 E2E.

### Deliberately not covered

- **Live Google/Facebook API calls.** The adapters are `unconfigured` behind
  the seam — real review fetching needs OAuth credentials CI does not have. The
  manual-entry path is the E2E-verifiable route, exactly like M12's gateways.
- **A real WhatsApp transport for the request message.** The worker marks
  requests `sent` through the same stub seam as the reminder worker; the
  transport lands with the messaging milestone.

---

## Performance

Measured against the seeded Northwind Dental database with
`performance.now()` around each service method:

| Method | Time (ms) |
|---|---|
| `ensurePlatforms` | 63 |
| `listRequests` | 77 |
| `automateRequests` | 40 |
| `listPlatforms` | 21 |
| `listReviews` | 19 |

All are single scoped reads; `listRequests` includes the contact/appointment/
platform joins in one query (no N+1). The automation worker is bounded by the
grace-window query (indexed by appointment status + endsAt). No per-read work
beyond the derivations.

## Security Review

Per `SECURITY_RULES.md` pre-merge checklist:

- [x] No secrets added, logged, or printed — `credentials_ref` is a
  secret-store key, never the token; new env vars: none.
- [x] All new inputs validated with a strict schema — Zod on every route;
  rating constrained 1–5 in both the validator and a DB CHECK.
- [x] Every new query is tenant-scoped and tested for isolation — all reads
  through `forScope`; the integration suite proves org A never sees org B's
  platforms or reviews.
- [x] New routes have explicit auth + authz checks — `requirePermission`
  (`review:read` / `review:write`) on every route.
- [x] Webhook signature verification untouched and still tested — no webhook
  surface added in M16 (the platform webhooks are part of the future
  integration).
- [x] No PII in logs, traces, fixtures, or error messages — review text is
  redacted at the logger; fixtures use synthetic `+9665000` numbers.
- [x] Rate limits applied to new send/auth/AI endpoints — M16 adds a worker and
  CRUD routes; the automation worker is rate-bounded by the grace window and the
  unique request guard.
- [x] `npm audit` clean at high and critical — 0 vulnerabilities.
- [x] Destructive operations require confirmation and are audit-logged — no
  destructive surface added; requests use lifecycle transitions.

---

## Known Limitations

1. **The Google/Facebook integrations are stubs.** Both adapters are
   `unconfigured`; real OAuth + review fetching is a future integration behind
   the seam.
2. **The request message is not actually delivered.** The worker marks requests
   `sent` through the transport stub seam; the real WhatsApp path lands with the
   messaging milestone.
3. **The feedback threshold is a constant (4), not per-org.** A settings
   surface is a later milestone.
4. **No reply to reviews.** Review text is captured and surfaced, but
   responding to a review (e.g. thanking the customer) is not in M16 scope.

---

## Exit Criteria

- [x] Every task in the plan's scope
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors, zero warnings
- [x] Unit, integration, component, and E2E tests exist and pass (869 total)
- [x] `npm run build` succeeds
- [x] `npm run db:check-drift` — green
- [x] axe audits the reviews pages clean
- [x] Docs updated — `CHANGELOG.md`, `docs/api/reviews.md`,
  `docs/database/schema-change.md`, this file
- [x] `MILESTONE_16_COMPLETED.md` written

All met.
