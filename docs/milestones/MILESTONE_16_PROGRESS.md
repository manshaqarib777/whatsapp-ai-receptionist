# Milestone 16 — Reviews — Progress

Status: In Progress
Started: 2026-08-16
Last updated: 2026-08-16

## Completed Tasks

- [x] `MILESTONE_16_PLAN.md` written (reviews, Google/Facebook platforms, automation, feedback)
- [x] Migration — `review_platforms`, `review_requests`, `reviews` + enums + constraints (2 migrations)
- [x] Repository — scoped reviews data access (`forScope` everywhere)
- [x] Service — lifecycle, consent gate, feedback threshold, platform seam
- [x] Worker — `npm run reviews:work` automation (completed appointments → requests + expiry sweep)
- [x] API routes — `/api/reviews/*` (reviews, requests, platforms)
- [x] `/reviews` pages + nav + permissions
- [x] Unit (8) + component (6) + integration (12) tests
- [x] E2E spec (3 × 2 projects) + axe audits clean
- [x] Docs — `schema-change.md`, `docs/api/reviews.md`, `CHANGELOG.md`, README, architecture
- [x] Exit gate — typecheck, lint, test, e2e, build, drift, axe all green

## Pending Tasks

None — milestone complete.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | The explore agent errored early (sub-agent crash) | Resolved | Gathered the gateway seam, worker, repository facade, and seed patterns directly from files |
| 2 | Prisma schema validation: missing back-relations on `Organization`/`Branch`/`Contact`/`Appointment` for the three review models; `Review.request` one-to-one needed `@unique` | Resolved | Back-relations added; `requestId @unique` + follow-up migration `20260816130000_reviews_request_unique` |
| 3 | Permissions test caught `review:read` missing on `member` while viewer held it | Resolved | Role matrix completed — all four roles hold `review:read`; owner/admin/member hold `review:write` |
| 4 | Full-suite run showed 5 failures under parallel DB load | Resolved | All isolated runs green; re-run of the full suite passed 869/869 (the failures were the permissions gap plus contention) |
| 5 | E2E strict-mode violation on duplicated "Not configured" badges | Resolved | `.first()` matcher |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-16 | Three Tier-2 tables migrated now | The ER diagram designed them at M4; this milestone owns the real requirements | Deferring them again |
| 2026-08-16 | Platform seam mirrors the M12 payment gateways | Google/Facebook need OAuth credentials CI lacks; `unconfigured` adapters fail loudly | Building the live integrations now |
| 2026-08-16 | Consent gate on review requests | The M14 invariants apply to any outbound customer communication | Sending requests regardless |
| 2026-08-16 | Automation targets the Google platform when present | A sensible default; the worker ensures the default platforms exist first | Prompting per appointment |

## Database Changes

| Migration | Description | Applied to |
|---|---|---|
| `20260816120000_reviews` | New tables: `review_platforms`, `review_requests`, `reviews` + enums + rating CHECK | Applied |
| `20260816130000_reviews_request_unique` | `reviews.request_id` unique (one review per request) | Applied |

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `GET/POST /api/reviews` | New | No |
| `GET/POST /api/reviews/requests`, `PATCH /api/reviews/requests/[id]` | New | No |
| `GET /api/reviews/platforms` | New | No |

## Breaking Changes

None.
