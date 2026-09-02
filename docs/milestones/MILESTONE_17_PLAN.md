# Milestone 17 — Loyalty

Created: 2026-08-17
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 17`
Status: Completed 2026-08-18 — see `MILESTONE_17_COMPLETED.md`

---

## Objective

Build the Loyalty system: points, membership, coupons, rewards, and referrals.
The M4 ER diagram designed six Tier-2 tables — `loyalty_programs`,
`loyalty_accounts`, `loyalty_transactions`, `coupons`, `coupon_redemptions`,
`referrals` — which this milestone migrates for the first time.

True after this milestone, and not true now:

- **Loyalty programs are manageable**: a program has a name, a points-earn rate
  (points per currency unit on paid invoices), and an enabled state.
- **Loyalty accounts exist per contact**: an account holds a running points
  balance, a membership tier, and the program it belongs to. A contact gets an
  account automatically on first earn.
- **Points are real**: a DB-polled worker (`npm run loyalty:work`) finds paid
  invoices that have not yet earned points, credits the contact's account
  (`points = floor(totalAmount × earnRate)`), and records one
  `loyalty_transaction` per invoice (unique `(invoiceId, kind)` so a re-run
  cannot double-award — the P2002 pattern).
- **Membership tiers are derived**: a tier (bronze/silver/gold) comes from the
  account's total earned points, with thresholds; the tier is shown on the
  account and the member list.
- **Rewards are redeemable**: an account can redeem points for a reward
  (negative transaction with a reason); the balance cannot go below zero
  (409).
- **Coupons exist**: coupons carry a code, a discount (percent or fixed), an
  expiry, and a redemption limit; redemption atomically applies and snapshots
  the discount on a matching draft invoice.
- **Referrals exist**: a referral links a referring contact to a referred
  contact; when the referred contact's account first earns points, the referrer
  earns a bonus (a second transaction kind).
- **The `/loyalty` UI** lists accounts (tier + balance), programs, coupons, and
  referrals, with create dialogs for programs and coupons.
- Typecheck, lint, unit/integration/E2E, and build all pass; axe audits the
  loyalty pages clean; `db:check-drift` stays green.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` +
`npm run test:e2e` pass; `npm run build` succeeds; `npm run db:check-drift` green.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 17`:

```
Loyalty

Points

Membership

Coupons

Rewards

Referrals

STOP
```

---

## Architecture Decisions

### AD-1 — The six Tier-2 tables, migrated now

| Table | Purpose | Key columns |
|---|---|---|
| `loyalty_programs` | The program (earn rate, enabled) | name, pointsPerCurrency, isEnabled |
| `loyalty_accounts` | One per contact | programId, contactId, balance, totalEarned, tier |
| `loyalty_transactions` | Points ledger | accountId, invoiceId?, appointmentId?, kind, pointsDelta, reason |
| `coupons` | The discount | code, type (percent/fixed), value, expiresAt, maxRedemptions |
| `coupon_redemptions` | A coupon used by a contact | couponId, contactId, redeemedAt |
| `referrals` | A contact referring another | referrerId, referredContactId, bonusPoints, status |

All branch-scoped with the cross-cutting columns; tenant-isolated through
`forScope`. The unique business keys that make the worker and redeem paths
idempotent: `loyalty_transactions (invoice_id, kind)` (a paid invoice earns
once), `coupon_redemptions (coupon_id, contact_id)`, `loyalty_accounts
(contact_id, program_id)`, `referrals (referrer_id, referred_contact_id)`.

### AD-2 — Points math

`points = floor(invoice.totalAmount × program.pointsPerCurrency)`. Earned on a
paid invoice (`status = 'paid'`, `paidAt != null`). `pointsPerCurrency` is a
`Decimal(6,4)` (e.g. 1 point per 1 SAR). Referral bonus is a flat constant on
the program. All ledger entries are integer deltas; the balance is the running
sum, never recomputed from invoices.

### AD-3 — Membership tiers are derived

`bronze < 500`, `silver 500–1999`, `gold ≥ 2000` total earned points. The tier
is a stored column updated when the account earns (so the member list filters
without aggregation), derived from `totalEarned` at earn time.

### AD-4 — The earn worker

`npm run loyalty:work`: per organization, finds paid invoices (with a paid
contact and an enabled program) that have no `loyalty_transaction` of kind
`earn` yet, credits the account, and resolves referral bonuses. Idempotent via
the unique `(invoice_id, kind)` transaction guard (P2002 swallowed). The
worker's steps are plain async functions so the integration test drives them
without faking timers.

### AD-5 — Redemption

`redeem(accountId, points, reason)`: refuses when the balance is insufficient
(409), writes a negative `spend` transaction, and decrements the balance. A
spend cannot take the balance below zero.

### AD-6 — API surface

| Route | Method | Permission | Body / query | Returns |
|---|---|---|---|---|
| `/api/loyalty/accounts` | GET | `loyalty:read` | `?tier=` | `{ accounts }` |
| `/api/loyalty/accounts/[id]` | GET | `loyalty:read` | — | `{ account, transactions }` |
| `/api/loyalty/accounts/[id]/redeem` | POST | `loyalty:write` | `{ points, reason }` | `{ account, transaction }` |
| `/api/loyalty/programs` | GET / POST | `loyalty:read` / `loyalty:write` | `{ name, pointsPerCurrency }` | `{ programs }` / `{ program }` 201 |
| `/api/loyalty/coupons` | GET / POST | `loyalty:read` / `loyalty:write` | `{ code, type, value, expiresAt?, maxRedemptions? }` | `{ coupons }` / `{ coupon }` 201 |
| `/api/loyalty/coupons/[id]/redeem` | POST | `loyalty:write` | `{ contactId }` | `{ redemption }` |
| `/api/loyalty/referrals` | GET / POST | `loyalty:read` / `loyalty:write` | `{ referrerId, referredContactId }` | `{ referrals }` / `{ referral }` 201 |

Cross-tenant or missing ids are 404; illegal state (insufficient balance,
already-redeemed coupon, duplicate referral) is 409.

### AD-7 — UI

- `/loyalty` — account list (contact, tier, balance) with a tier filter.
- `/loyalty/accounts/[id]` — account detail: balance, tier, transaction
  history, and a redeem doorway.
- `/loyalty/programs` — program list + create.
- `/loyalty/coupons` — coupon list + create.
- `/loyalty/referrals` — referral list.
- States: loading/error/empty per the house rules; responsive and axe-clean.

---

## Dependencies

No new packages. Upstream: M4 schema (Tier-2 tables designed), M10 CRM
(contacts), M12 invoices (the earn trigger), M16 worker pattern.

## Database Impact

New migration: `20260817_milestone_17_loyalty` creating the six tables with
enums (`loyalty_tier`, `loyalty_transaction_kind`, `coupon_type`,
`referral_status`), the cross-cutting columns, the unique business keys, and
CHECK constraints (balance ≥ 0, points per currency ≥ 0). `schema-change.md`
gains a Milestone 17 section.

## API Impact

New surface (AD-6). All routes follow the house envelope. No breaking changes.

## UI Impact

- `/loyalty` + `/loyalty/accounts/[id]` + `/loyalty/programs` + `/loyalty/coupons` + `/loyalty/referrals`.
- Nav item + icon; `loyalty:read` / `loyalty:write` permissions.

## AI Impact

None. Loyalty is deterministic ledger math; no model calls.

## Security Considerations

| Area | Consideration |
|---|---|
| Tenant isolation | Every query through `forScope`; cross-tenant reads 404 |
| Ledger integrity | Balance never recomputed from source data — transactions are the ledger; the CHECK guards negative balances |
| Double-award | Unique `(invoice_id, kind)` transaction + P2002 swallow; re-runs are no-ops |
| Coupon abuse | Unique `(coupon_id, contact_id)` redemption; per-coupon max guard |
| PII | Points and coupons reference contacts by id only in the view model; no phone numbers exposed |

## Testing Strategy

- **Unit**: points math (floor, per-currency), tier derivation (bronze/silver/
  gold thresholds), redeem guards (insufficient balance), coupon value math.
- **Component**: account/program/coupon list states, redeem dialog, axe-clean.
- **Integration** (real Postgres): earn worker credits a paid invoice exactly
  once (idempotent), referral bonus resolves, redemption decrements and refuses
  below zero, coupon redemption is unique, **org A never sees org B**.
- **E2E**: seeded account list, create program, redeem dialog, axe clean.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Double-awarding points | Medium | Ledger corruption | Unique `(invoice_id, kind)` + P2002 swallow, integration-tested |
| Balance going negative | Low | Trust damage | CHECK + service guard (409), tested |
| Points math drift (recompute vs ledger) | Medium | Wrong balances | Ledger is the source of truth; `totalEarned` updated at earn time only |
