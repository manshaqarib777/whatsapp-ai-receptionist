# Milestone 17 — Loyalty — Progress

Status: Completed; re-certified
Started: 2026-08-17
Last updated: 2026-08-23

## Completed Tasks

- [x] `MILESTONE_17_PLAN.md` written (points, membership, coupons, rewards, referrals)
- [x] Migration — `loyalty_programs`, `loyalty_accounts`, `loyalty_transactions`, `coupons`, `coupon_redemptions`, `referrals` (2 migrations)
- [x] Repository — scoped loyalty data access (`forScope` everywhere)
- [x] Service — points math, tier derivation, redeem guards, coupon logic
- [x] Worker — `npm run loyalty:work` (paid invoices → earn + referral bonus)
- [x] API routes — `/api/loyalty/*` (accounts, programs, coupons, referrals)
- [x] `/loyalty` pages + nav + permissions
- [x] Unit (8) + component (7) + integration (13) tests
- [x] E2E spec (3 × 2 projects) + axe audits clean
- [x] Docs — `schema-change.md`, `docs/api/loyalty.md`, `CHANGELOG.md`, README, architecture
- [x] Exit gate — typecheck, lint, test, e2e, build, drift, axe all green

## Pending Tasks

None — milestone complete.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Prisma schema drift: `totalEarned`/`pointsDelta` columns missing `@map`; program indexes omitted from the initial migration | Resolved | `@map("total_earned")`/`@map("points_delta")` added; follow-up migration `20260817110000_loyalty_indexes` |
| 2 | The tenant-scoped client forbids `update()` by unique key on `loyaltyAccount` | Resolved | `updateMany` + `findFirstOrThrow` inside the transaction (the scoped-prisma rule) |
| 3 | Referrer's account did not exist on first referral bonus, so the bonus was skipped and the referral stayed `pending` | Resolved | The worker creates the referrer's account on first bonus, mirroring first-earn |
| 4 | Permissions test caught `loyalty:read` missing on `member` while viewer held it | Resolved | Role matrix completed — all four roles hold `loyalty:read`; owner/admin/member hold `loyalty:write` |
| 5 | E2E strict-mode violation on "silver" (filter button + badge) | Resolved | Exact matcher |
| 6 | One-off `ECONNRESET` on org creation during a loyalty E2E run | Resolved (environmental) | Infra-level connection drop, not a code defect; passed on re-run (documented precedent from M11) |
| 7 | Coupon redemption consumed a slot but applied no discount; limits and point spends had race windows; repository was 577 lines | Resolved | Transactional draft-invoice discounts with snapshots/locks, conditional balance update, and program/coupon/referral repository splits |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-17 | Points earned on paid invoices (floor(totalAmount × rate)) | Invoices carry a monetary total and a `paidAt` — the natural earn trigger; the ER diagram's `invoice_id` FK confirms it | Flat per-appointment points |
| 2026-08-17 | Ledger is the source of truth | Transactions are the only writes to the balance; no recompute drift | Deriving balance from invoices each read |
| 2026-08-17 | Tier derived from `totalEarned` at earn time, stored | The member list filters without aggregation | Aggregating per read |
| 2026-08-17 | Referrer account created on first bonus | A referrer who never spends still earns the bonus | Skipping the bonus when no account exists |

## Database Changes

| Migration | Description | Applied to |
|---|---|---|
| `20260817100000_loyalty` | Six loyalty tables + enums + CHECKs | Applied |
| `20260817110000_loyalty_indexes` | Program organization/branch indexes | Applied |

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `GET /api/loyalty/accounts`, `GET /api/loyalty/accounts/[id]`, `POST /api/loyalty/accounts/[id]/redeem` | New | No |
| `GET/POST /api/loyalty/programs` | New | No |
| `GET/POST /api/loyalty/coupons`, `POST /api/loyalty/coupons/[id]/redeem` | New | No |
| `GET/POST /api/loyalty/referrals` | New | No |

## Breaking Changes

None.
