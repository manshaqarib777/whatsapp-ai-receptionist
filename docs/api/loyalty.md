# Loyalty API

Milestone 17. All routes are wrapped in `withApiHandler` (correlation id,
structured logging, consistent envelope), require an authenticated session with
an active organization, and validate request bodies with Zod. Errors return the
standard `{ error: { code, message, details? } }` envelope.

Tenant scope always comes from the session — never from a request parameter.
Every query runs through `forScope`, so a cross-tenant read or write returns 404
(house rule). All six loyalty tables are branch-scoped; writes go through the
org's default branch.

Permissions (`loyalty:read` / `loyalty:write`):

| Role | read | write |
|---|---|---|
| owner | ✓ | ✓ |
| admin | ✓ | ✓ |
| member | ✓ | ✓ |
| viewer | ✓ | — |

## Points model

- **Earn**: `floor(invoice.totalAmount × program.pointsPerCurrency)` on a paid
  invoice (`status = 'paid'`, `paidAt != null`). The `loyalty:work` worker does
  this; a paid invoice earns exactly once (unique `(invoiceId, kind)` guard).
- **Ledger**: `loyalty_transactions` is the source of truth — the account
  `balance` is only ever changed by applying a transaction, never recomputed
  from invoices.
- **Tiers**: derived from lifetime `totalEarned` — `bronze < 500`, `silver
  500–1999`, `gold ≥ 2000`.

## Programs

### `GET /api/loyalty/programs`

Loyalty programs. Soft-deleted rows excluded.

Response: `{ data: { programs } }` — `{ id, name, pointsPerCurrency, isEnabled,
createdAt }`.

### `POST /api/loyalty/programs`

Creates a program. Requires `loyalty:write`. Body:

```json
{ "name": "Smile Rewards", "pointsPerCurrency": 1 }
```

`pointsPerCurrency` must be ≥ 0 (422 otherwise). Response (201):
`{ data: { program } }`.

## Accounts

### `GET /api/loyalty/accounts?tier=`

Loyalty accounts, optionally filtered by `tier` (`bronze|silver|gold`). Ordered
by lifetime earned, descending.

Response: `{ data: { accounts } }` — `{ id, contactId, contactDisplayName,
programId, programName, balance, totalEarned, tier, createdAt }`.

### `GET /api/loyalty/accounts/[id]`

Account detail plus its transaction history. Cross-tenant or missing ids return
404.

Response: `{ data: { account, transactions } }` — `transactions` are `{ id,
accountId, invoiceId, kind, pointsDelta, reason, createdAt }`, newest first.

### `POST /api/loyalty/accounts/[id]/redeem`

Redeems points for a reward. Requires `loyalty:write`. Body:

```json
{ "points": 300, "reason": "Free check-up" }
```

Refuses when the balance is insufficient (409) or `points` is not a positive
integer (422). Writes a negative `spend` transaction and decrements the balance
atomically with the ledger row. Response: `{ data: { account, transaction } }`.

## Coupons

### `GET /api/loyalty/coupons`

Coupons with redemption counts.

Response: `{ data: { coupons } }` — `{ id, code, type, value, expiresAt,
maxRedemptions, redemptionCount, createdAt }`.

### `POST /api/loyalty/coupons`

Creates a coupon. Requires `loyalty:write`. Body:

```json
{ "code": "WELCOME10", "type": "percent", "value": 10, "maxRedemptions": 1 }
```

A percent coupon must be ≤ 100 (422). Response (201): `{ data: { coupon } }`.

### `POST /api/loyalty/coupons/[id]/redeem`

Applies a coupon to a matching draft invoice. Requires `loyalty:write`. Body:
`{ "contactId": "…", "invoiceId": "…" }`.

The percent/fixed discount is capped at the invoice total and snapshotted on
both the redemption and invoice. Redemption-limit locking, redemption creation,
and the invoice total update are one transaction. Expired, exhausted,
duplicate, already-discounted, non-draft, or mismatched-contact uses are refused.
Response (201): `{ data: { redemption } }` including `invoiceId` and
`discountAmount`.

## Referrals

### `GET /api/loyalty/referrals`

Referrals, newest first.

Response: `{ data: { referrals } }` — `{ id, referrerId, referrerDisplayName,
referredContactId, referredDisplayName, bonusPoints, status, createdAt }`.

### `POST /api/loyalty/referrals`

Creates a referral. Requires `loyalty:write`. Body:

```json
{ "referrerId": "…", "referredContactId": "…" }
```

A contact cannot refer themselves (422). When the referred contact's account
first earns, the worker credits the referrer the bonus and marks the referral
`rewarded`. Response (201): `{ data: { referral } }`.

## Earn worker

`npm run loyalty:work` runs the DB-polled worker: per organization it finds
paid invoices with no `earn` transaction, credits the contact's account
(creating it on first earn), updates the tier from the new lifetime total, and
resolves pending referral bonuses. Idempotent via the unique `(invoiceId, kind)`
guard — a re-run cannot double-award.
