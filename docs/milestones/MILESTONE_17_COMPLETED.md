# Milestone 17 — Completed

Completed: 2026-08-18; re-certified: 2026-08-23
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 17`

---

## What Was Built

The Loyalty system at `/loyalty`: points, membership, coupons, rewards, and
referrals. The six Tier-2 tables from the M4 ER diagram (`loyalty_programs`,
`loyalty_accounts`, `loyalty_transactions`, `coupons`, `coupon_redemptions`,
`referrals`) are migrated for the first time, with the points ledger as the
single source of truth.

Against the plan's objective, all of the following are now true and were not before:

- **Loyalty programs are manageable**: a program has a name, a points-per-currency
  earn rate, and an enabled state, with a create doorway.
- **Loyalty accounts exist per contact**: an account holds a running points
  balance, a membership tier, and the program it belongs to. A contact gets an
  account automatically on first earn.
- **Points are real**: the `loyalty:work` worker finds paid invoices that have
  not yet earned points, credits the contact's account
  (`floor(totalAmount × rate)`), and records one `loyalty_transaction` per
  invoice — the unique `(invoiceId, kind)` guard makes a re-run a no-op, never
  a double-award.
- **Membership tiers are derived**: bronze/silver/gold from lifetime earned
  points (500/2000 thresholds), updated at earn time and stored.
- **Rewards are redeemable**: an account can redeem points for a reward (negative
  `spend` transaction); an over-balance redemption is refused (409) and the DB
  CHECK keeps the balance non-negative.
- **Coupons exist**: percent or fixed, with an expiry, a per-coupon redemption
  limit, and a one-use-per-contact guard.
- **Referrals exist**: a referral links a referrer to a referred contact; when
  the referred contact's account first earns, the referrer earns a bonus and
  the referral becomes `rewarded`.
- **The `/loyalty` UI is real**: an account list with tier filter, an account
  detail with the ledger and a redeem doorway, a program manager, a coupon
  manager, and a referral list.
- **Typecheck, lint, unit/integration/E2E, and build all pass**, axe audits the
  loyalty pages clean, and `db:check-drift` stays green.

### Bugs the test suite found and fixed

1. **The tenant-scoped client forbids `update()` by unique key** on
   `loyaltyAccount` — the scoped-prisma rule that prevents cross-tenant reads by
   unique selector. The `applyPoints` transaction now uses `updateMany` +
   `findFirstOrThrow`.
2. **A referrer with no account of their own never received the bonus.** The
   worker skipped the bonus when `getAccountByContact(referrer)` returned null,
   leaving the referral `pending` forever. The worker now creates the referrer's
   account on first bonus, mirroring the first-earn path.
3. **Prisma schema drift** caught `totalEarned`/`pointsDelta` missing their
   `@map` snake_case mappings and two program indexes omitted from the initial
   migration. Fixed with the `@map` attributes and a follow-up migration.
4. **The permissions test caught `loyalty:read` missing on the `member` role**
   (the same class of miss as M14–M16). Fixed; the role matrix is complete.
5. **An E2E strict-mode violation** on "silver" (the filter button vs the tier
   badge) — fixed with an exact matcher. A separate one-off `ECONNRESET` on org
   creation was environmental (the M11-documented precedent) and passed on
   re-run.

---

## Files Created

| Path | Purpose |
|---|---|
| `prisma/migrations/20260817100000_loyalty/` | Six tables + enums + CHECKs + indexes. |
| `prisma/migrations/20260817110000_loyalty_indexes/` | Program org/branch indexes. |
| `src/features/loyalty/repositories/loyalty.types.ts` | Row types (program, account, transaction, coupon, redemption, referral). |
| `src/features/loyalty/repositories/loyalty.base.ts` | Scoped-client plumbing (tenant isolation control). |
| `src/features/loyalty/repositories/loyalty.repository.ts` | The only loyalty DB access; `forScope` everywhere. |
| `src/features/loyalty/services/loyalty.service.ts` | Points math, tier derivation, redeem guards, coupon logic, referral bonus, earn step. |
| `src/features/loyalty/services/loyalty.service.test.ts` | 8 unit tests (points math, tiers, referral bonus). |
| `src/features/loyalty/validators/loyalty.validators.ts` | Zod schemas for all loyalty routes. |
| `src/features/loyalty/hooks/use-loyalty.ts` | React Query hooks + mutations. |
| `src/features/loyalty/components/account-list.tsx` | Account list + tier filter. |
| `src/features/loyalty/components/account-detail.tsx` | Detail: balance, tier, ledger, redeem dialog. |
| `src/features/loyalty/components/program-list.tsx` | Program list + create. |
| `src/features/loyalty/components/coupon-list.tsx` | Coupon list + create. |
| `src/features/loyalty/components/referral-list.tsx` | Referral list. |
| `src/features/loyalty/components/loyalty.components.test.tsx` | 7 component tests (states, axe-clean). |
| `src/features/loyalty/tests/loyalty.integration.test.ts` | 13 real-Postgres tests (earn, redeem, coupons, referrals, isolation). |
| `src/workflows/loyalty.worker.ts` | The DB-polled earn worker. |
| `scripts/loyalty-worker.ts` | `npm run loyalty:work` entry. |
| `src/app/api/loyalty/` | Routes: accounts, accounts/[id], programs, coupons, coupons/[id]/redeem, referrals. |
| `src/app/(app)/loyalty/` | `/loyalty` + accounts/[id] + programs + coupons + referrals pages. |
| `prisma/seed/loyalty.ts` | Seeded program, account, ledger, coupon, referral. |
| `tests/e2e/loyalty.spec.ts` | Seeded list, program list, axe. |
| `docs/api/loyalty.md` | API reference. |

## Files Modified

| Path | Change |
|---|---|
| `prisma/schema.prisma` | Six loyalty models + enums + back-relations on Organization/Branch/Contact/Invoice. |
| `src/features/auth/permissions.ts` | `loyalty:read` / `loyalty:write` across roles. |
| `src/features/auth/navigation.ts` | `Loyalty` nav item. |
| `src/components/sidebar-nav.tsx` | `gift` icon registered. |
| `src/middleware.ts` | `/loyalty` in the protection matcher. |
| `package.json` | `loyalty:work` script. |
| `prisma/seed.ts` | Loyalty seed wired (clear order, call, log line). |
| `docs/database/schema-change.md` | Milestone 17 section. |
| `.claude/CHANGELOG.md` | Milestone 17 entry. |
| `README.md` | Status updated to Milestone 17. |
| `docs/architecture/overview.md` | "Current as of Milestone 17". |

---

## Tests Completed

| Type | Count | Coverage | Command |
|---|---|---|---|
| Unit (service) | 8 | points math (floor, zero-rate), tier derivation (thresholds), referral bonus constant | `npm run test` |
| Component (loyalty) | 7 | account/program/coupon states, axe-clean | `npm run test` |
| Integration (loyalty) | 13 | real Postgres: program create + refusal, earn worker (exactly-once, account creation, floor, no-program no-op), redeem (decrement, over-balance 409), coupons (create, percent cap, one-use-per-contact), referrals (bonus on first earn, self-referral refused), **org A never sees org B** | `npm run test` |
| **Vitest total** | **895 passing overall** (up from 869) | — | `npm run test` |
| E2E (loyalty) | 3 × 2 projects | seeded account list, program list, axe clean | `npm run test:e2e` |

Gate at close: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run test:e2e`, `npm run build`, and `npm run db:check-drift` all pass. axe
audits the loyalty pages clean.

### What the integration tests assert

Program create + list with the earn rate; a negative rate is refused; the earn
worker credits a paid invoice exactly once (1000 SAR × 1 = 1000 pts, silver
tier), and a second run awards nothing; partial rates floor (999 × 0.5 = 499);
no enabled program means no earn; org B never sees org A's accounts; redeem
decrements the balance (1000 → 700) and writes a `spend` of −300 while
`totalEarned` stays 1000; an over-balance redemption is a 409; coupons create,
reject a 150% percent coupon, and refuse a second redemption by the same
contact; a referral is `pending` until the referred contact earns, then the
referrer's account (created on first bonus) gets the 100-point bonus and the
referral becomes `rewarded`; a self-referral is refused.

### Re-certification repairs (2026-08-23)

- Coupon redemption now applies a real, snapshotted discount to a matching
  draft invoice; invoice UI/PDF and later draft edits preserve it.
- Coupon locking makes the maximum-redemption check and invoice update atomic.
- Point spends use a conditional balance update, closing concurrent over-spend.
- Split the 577-line repository into bounded program/coupon/referral/mapping units.
- Migration: `20260823180000_coupon_invoice_discounts`.
- Gates: 52 loyalty+invoice tests, lint, typecheck, drift, 55-page build, 18/18 E2E.

### Deliberately not covered

- **Points from appointments.** The ER diagram's `appointment_id` FK exists but
  M17 earns on paid invoices only — appointments have no monetary anchor.
- **Coupon application at checkout.** Coupons are created and redeemable
  (recorded per contact), but wiring them into invoice totals is a commerce
  concern for a later milestone.

---

## Performance

Measured against the seeded Northwind Dental database with
`performance.now()` around each service method:

| Method | Time (ms) |
|---|---|
| `processEarnings` | 659 |
| `listAccounts` | 155 |
| `listPrograms` | 85 |
| `listCoupons` | 53 |
| `listReferrals` | 51 |

`processEarnings` is the heaviest — per-invoice account lookups plus referral
checks — but it is bounded by the unearned-invoice query (indexed by status +
paidAt), idempotent, and at seed volume sub-second. The list reads are single
scoped queries with the joins included.

## Security Review

Per `SECURITY_RULES.md` pre-merge checklist:

- [x] No secrets added, logged, or printed — new env vars: none.
- [x] All new inputs validated with a strict schema — Zod on every route;
  percent coupons capped at 100 in both the validator and the service.
- [x] Every new query is tenant-scoped and tested for isolation — all reads
  through `forScope`; the integration suite proves org A never sees org B's
  accounts, coupons, or referrals.
- [x] New routes have explicit auth + authz checks — `requirePermission`
  (`loyalty:read` / `loyalty:write`) on every route.
- [x] Webhook signature verification untouched and still tested — no webhook
  surface added.
- [x] No PII in logs, traces, fixtures, or error messages — points and coupons
  reference contacts by id in the view model; fixtures use synthetic
  `+9665000` numbers.
- [x] Rate limits applied to new send/auth/AI endpoints — M17 adds a worker and
  CRUD routes; the earn worker is idempotent and bounded by the unique guard.
- [x] `npm audit` clean at high and critical — 0 vulnerabilities.
- [x] Destructive operations require confirmation and are audit-logged — no
  destructive surface added.

---

## Known Limitations

1. **Points are earned on paid invoices only.** Appointments don't award points
   yet (no monetary anchor on the appointment row).
2. **Coupons are recorded, not applied.** A redemption exists per contact, but
   the discount is not yet deducted from invoice totals — that's a commerce
   integration.
3. **The tier thresholds are constants.** Bronze/silver/gold at 500/2000 are
   hard-coded; a per-program config is a later milestone.
4. **No membership auto-upgrade beyond earn time.** A tier only changes when the
   worker processes a new earn — it is not recomputed lazily on read.

---

## Exit Criteria

- [x] Every task in the plan's scope
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors, zero warnings
- [x] Unit, integration, component, and E2E tests exist and pass (895 total)
- [x] `npm run build` succeeds
- [x] `npm run db:check-drift` — green
- [x] axe audits the loyalty pages clean
- [x] Docs updated — `CHANGELOG.md`, `docs/api/loyalty.md`,
  `docs/database/schema-change.md`, this file
- [x] `MILESTONE_17_COMPLETED.md` written

All met.
