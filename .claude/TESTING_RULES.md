# Testing Rules

## Core Rule

Every feature requires:

- **Unit tests**
- **Integration tests**
- **Component tests**
- **E2E tests**

**Never mark complete without tests.** Tests ship in the same commit as the code.

---

## Stack

| Layer | Tool |
|---|---|
| Unit, integration | Vitest |
| Component | Vitest + React Testing Library |
| E2E | Playwright |
| API contract | Vitest against a running route handler |
| AI behaviour | Eval suite (`evaluations/`) |

---

## What Each Layer Covers

### Unit — services, repositories, validators, utils
Pure logic in isolation. Dependencies stubbed at the boundary.
Every branch, every error path, every edge case.

### Integration — controller → service → repository → database
Real database (branch DB or containerised Postgres). No mocked repositories.
Covers transactions, constraints, tenant scoping, and idempotency for real.

### Component — rendered UI
All four states: loading, error, empty, success. Keyboard interaction. Accessible names
and roles. Never assert on class names or internal state.

### E2E — real user journeys
- Inbound WhatsApp message → AI reply delivered
- Human takes over a conversation and replies
- Escalation triggers and alerts an agent
- Booking an appointment end to end
- Settings change alters AI behaviour
- Auth: sign in, sign out, unauthorised access blocked

---

## Rules

- Test behaviour, not implementation. If a refactor breaks a test that should still
  pass, the test was wrong.
- One assertion concept per test. Descriptive names:
  `rejects a webhook with an invalid signature`.
- Arrange–Act–Assert, visibly separated.
- Deterministic. No sleeps, no real clock, no network, no `Math.random`. Fake timers and
  fixed seeds.
- Independent and order-agnostic. Each test creates and cleans its own data.
- No shared mutable fixtures between tests.
- Never test a mock. If the assertion only proves the stub was called, delete it.

---

## Mandatory Test Cases

These have bitten this class of system before. Each must be covered explicitly:

- Webhook with an **invalid signature** → 401, nothing persisted.
- **Duplicate webhook delivery** → processed once (unique constraint holds).
- Webhook processed while a **human owns the thread** → AI does not reply.
- **Cross-tenant access attempt** → 404, no data leak.
- `tenantId` supplied in a **request body** → ignored.
- Model call **times out** → holding message sent, conversation escalated.
- Model attempts a **tool it is not authorized** for → rejected in code.
- **Prompt injection** in a customer message → instructions ignored.
- **Double booking** of the same slot → 409, one booking persisted.
- **Rate limit** exceeded → 429 with `Retry-After`.
- **Opted-out contact** → no outbound message sent.

---

## Coverage

- Services, validators, repositories: **90%** minimum.
- Controllers and components: **80%** minimum.
- Every bug fix ships with a regression test that fails before the fix.

Coverage is a floor, not a goal. 100% coverage with no assertion of behaviour is worth
nothing.

---

## Test Data

- Synthetic only. **Never** production data, real phone numbers, or real customer
  messages — in tests, fixtures, seeds, or snapshots.
- Factories over literal fixtures; override only the field under test.
- Phone numbers from the reserved test ranges. WhatsApp calls go to a test number or a
  stub, never the live number.

---

## CI Gate

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

- All green, or the change does not merge. No skipping, no `--force`.
- No `.skip`, `.only`, or commented-out tests in committed code.
- Flaky tests are fixed or deleted, never retried into passing.

**If tests fail: STOP.** Do not write more code on a red suite (`RULES.md` §12).
