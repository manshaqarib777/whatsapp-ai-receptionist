# Milestone 2 — Completed

Completed: 2026-08-01
Plan: [`MILESTONE_02_PLAN.md`](MILESTONE_02_PLAN.md)
Progress: [`MILESTONE_02_PROGRESS.md`](MILESTONE_02_PROGRESS.md)

---

## What Was Built

| PRD requirement | Status | Where |
|---|---|---|
| Login | Done | `/login` — password, magic link, OAuth |
| Signup | Done | `/signup` |
| Forgot Password | Done | `/forgot-password` |
| Reset Password | Done | `/reset-password` |
| 2FA | Done | `/two-factor`, `/settings/security` — TOTP + backup codes |
| Magic Link | Done | 15-minute single-use link |
| OAuth | **Code complete, unverified** | Google + GitHub; needs credentials (Limitation 2) |
| RBAC | Done | 4 roles × 18 permissions, `permissions.ts` |
| Permissions | Done | `requirePermission()` on every protected route |
| Organizations | Done | Create, list, switch, members |
| Sessions | Done | Database-backed, immediate revocation |
| Audit Logs | Done | Append-only, PII-sanitising |
| Tests | Done | 220 unit/integration/component + 38 E2E |

**Scope held.** No dashboard widgets, no product schema, no WhatsApp, no AI. The
dashboard page is an explicit placeholder that says so.

### The security property that matters most

`organizationId` is now derived **server-side from the session row** and never from
client input. `requireOrg()` and `requirePermission()` return it, and every
organization-scoped query is filtered by it. This is what makes every subsequent
milestone's tenant scoping trustworthy, and it is proven by 17 integration tests rather
than asserted in a comment.

### Architecture

Better Auth is confined to `src/lib/auth.ts` and `src/features/auth/`. Application code
depends on `getAuthContext` / `requireAuth` / `requireOrg` / `requirePermission` in
`src/server/auth-context.ts`. Replacing the library means rewriting that one file
(ADR-0001).

---

## Files Created

**Auth core**
```
src/lib/auth.ts                                    Better Auth configuration
src/lib/auth-client.ts                             Browser client
src/lib/email.ts                                   EmailPort + console/in-memory adapters
src/lib/rate-limit.ts                              In-process limiter
src/server/auth-context.ts                         THE auth boundary
src/middleware.ts                                  Optimistic redirect (not the boundary)
```

**Feature**
```
src/features/auth/permissions.ts                   RBAC matrix — pure, no I/O
src/features/auth/configured-providers.ts          Which OAuth providers are live
src/features/auth/validators/auth.validators.ts    Shared Zod schemas
src/features/auth/validators/redirect.ts           Open-redirect defence
src/features/auth/services/audit-log.service.ts    Append-only audit
src/features/auth/services/organization.service.ts Org + membership logic
```

**Components**
```
src/features/auth/components/form-field.tsx            Labelled field, a11y-wired
src/features/auth/components/login-form.tsx
src/features/auth/components/signup-form.tsx
src/features/auth/components/password-reset-forms.tsx
src/features/auth/components/two-factor-form.tsx       Challenge
src/features/auth/components/two-factor-settings.tsx   Enrolment
src/features/auth/components/oauth-buttons.tsx
src/features/auth/components/create-organization-form.tsx
src/features/auth/components/members-table.tsx
src/features/auth/components/app-header.tsx            Org switcher + account menu
```

**Routes**
```
src/app/api/auth/[...all]/route.ts
src/app/api/organizations/route.ts
src/app/api/organizations/active/route.ts
src/app/api/members/route.ts
src/app/api/members/[id]/route.ts
src/app/api/audit-logs/route.ts

src/app/(auth)/layout.tsx + login, signup, forgot-password,
                            reset-password, verify-email, two-factor
src/app/(app)/layout.tsx  + dashboard, onboarding/organization,
                            settings/security, settings/members
```

**Tests**
```
src/features/auth/permissions.test.ts                        41 tests
src/features/auth/validators/redirect.test.ts                30 tests
src/features/auth/components/login-form.test.tsx             15 tests
src/features/auth/tests/tenant-isolation.integration.test.ts 17 tests
src/features/auth/tests/audit-log.integration.test.ts        25 tests
src/lib/rate-limit.test.ts                                   12 tests
tests/e2e/auth.spec.ts                                       24 tests
```

**Documentation**
```
docs/architecture/decisions/ADR-0001-better-auth.md
docs/api/auth.md
docs/api/organizations.md
docs/database/schema-change.md                     (Milestone 2 section appended)
docs/milestones/MILESTONE_02_{PLAN,PROGRESS,COMPLETED}.md
```

## Files Modified

| File | Change |
|---|---|
| `prisma/schema.prisma` | +8 models, mapped and indexed |
| `src/lib/env.ts` | `AUTH_SECRET`, `EMAIL_FROM`, optional OAuth credentials |
| `src/lib/env.test.ts` | Fixture updated; +8 tests for the new variables |
| `src/server/api-handler.ts` | Generic `RouteParams<T>` for dynamic segments |
| `vitest.config.ts` | Auth variables in the test environment |
| `.env.example` / `.env` / `.env.local` | Auth variables; **`NODE_ENV` removed** |
| `README.md` | Auth setup, new variables, new commands |
| `.claude/CHANGELOG.md` | Milestone 2 entry |

---

## Tests Completed

| Type | Count | Command |
|---|---|---|
| Unit | 163 | `npm run test` |
| Integration | 42 | `npm run test` (real Postgres) |
| Component | 15 | `npm run test` |
| E2E | 38 | `npm run test:e2e` |
| **Total** | **258** | |

**Coverage**: `permissions.ts` 100% statements, `redirect.ts` 93.8%,
`src/lib` 90%+ maintained.

### What the security tests actually prove

- **Cross-tenant access returns 404, not 403** — and the target row is verifiably
  unchanged after a rejected attempt.
- **An admin cannot create an owner**; a member cannot change any role.
- **The last owner cannot be demoted or removed** — the organization can never become
  unadministrable.
- **Audit metadata is stripped of PII even when a caller passes it** — the test writes
  an email and a name, then asserts neither reaches the database.
- **The audit service exports no update/delete**, and the table has no `updated_at` or
  `deleted_at`.
- **Sign-in, signup, reset, and magic link are indistinguishable** for existing and
  non-existing accounts — asserted by comparing rendered message text across both cases.
- **An unauthenticated API request returns 401 even though middleware does not cover
  that path**, proving middleware is not load-bearing for security.
- **30 open-redirect vectors rejected**, including double-encoded and
  control-character-smuggled schemes.
- **Unknown roles are denied every one of the 18 permissions** — the model fails closed.

---

## Performance Results

Measured against a production build, same method as Milestone 1.

| Route | min | p50 | p95 |
|---|---|---|---|
| `GET /api/health` | 5 ms | 6 ms | 9 ms |
| `GET /login` | 3 ms | 4 ms | 6 ms |

**Bundle**: `.next/static` grew from 956 KB to 1.4 MB. The increase is the auth client,
form primitives, and dropdown/avatar/OTP components. Auth routes are not in the
dashboard's critical path.

**Build**: 9.0 s. **E2E suite**: 11.4 s for 38 tests.

No regression against the Milestone 1 baseline on shared routes.

---

## Known Limitations

1. **No email provider.** Verification, reset, magic-link, and invitation messages go
   to the log via a console adapter. `sendEmail` **throws in production** rather than
   silently dropping account-critical mail. Wiring a provider means implementing one
   `EmailPort` method. **Needs credentials.**
2. **OAuth is unverified end to end.** Google and GitHub are configured, and the
   enable/disable logic is tested, but no redirect round-trip has been exercised
   because no client credentials exist. **Needs credentials.**
3. **Rate limiting is per-process** and resets on deploy. With multiple instances an
   attacker gets N× the allowance. Redis replaces the store in Milestone 24.
4. **Invitation acceptance has no UI.** The send path, expiry, and email are wired;
   `/accept-invitation/:id` is not built. Deferred deliberately — it needs the design
   system for a decent first-run experience.
5. **No session-management UI.** "Sign out everywhere" and a device list are not built.
   The data supports both.
6. **2FA enrolment shows the TOTP URI as text, not a QR code.** Functional and more
   accessible, but a QR renderer is expected. Milestone 3.
7. **No brute-force lockout beyond rate limiting.** Progressive lockout after repeated
   failures was planned but not implemented; the rate limiter blunts the attack.
   Milestone 23.
8. **Auth pages are visually plain.** By agreement — the design system is Milestone 3,
   which restyles them. Structure and accessibility are complete.
9. **No preview deployment.** Verified against a local production build. Milestone 25.

---

## Deviations From the Plan

1. **The `admin` plugin was dropped.** It governs *platform*-level administrators
   (impersonation, cross-tenant user management), which is Milestone 22 — not
   organization RBAC. Including it would have been future-milestone scope. Organization
   roles come from the `organization` plugin.
2. **`react-hook-form` was installed but not used.** The shadcn `form` primitive was
   absent from the registry preset, and the forms are simple enough that Zod plus local
   state is less machinery. The dependency should be removed or adopted consistently in
   Milestone 3.
3. **Progressive brute-force lockout was not implemented** (Limitation 7).

---

## Bug Found and Fixed Outside the Milestone Scope

**`NODE_ENV=development` was set in `.env`**, a Milestone 1 mistake. Next.js sets
`NODE_ENV` itself; overriding it in `.env` makes `next start` — a production server —
behave as though it were in development, including injecting the Next.js dev-tools
overlay into production HTML.

This was surfaced by the **tripwire test written in Milestone 1**, which asserts the
scaffold page has zero focusable elements. It failed because the dev-tools button is
focusable. The test was designed to fail when an interactive control appeared; it
caught a production-configuration bug instead.

Fixed by removing `NODE_ENV` from `.env`, `.env.local`, and `.env.example`, with a
comment explaining why it must not be set.

---

## Definition of Done

| Criterion | Status |
|---|---|
| All acceptance criteria met | Yes, except OAuth end-to-end (Limitation 2) |
| Tests pass (unit, integration, component, E2E) | Yes — 258 passing |
| Build succeeds with zero errors | Yes |
| Lint and type checks pass | Yes — 0 errors, 0 warnings |
| Performance budget maintained | Yes, no regression |
| Accessibility satisfied | Yes — labels, focus, aria-invalid, keyboard, one h1 per screen |
| Responsive verified | Yes — 375/768/1920/2560 |
| Documentation updated | Yes |
| Code reviewed and refactored | Yes |
| No known bugs remain | Yes |
| Dummy data covers realistic scenarios | **No** — Milestone 4 |
| UI matches premium Framer-quality standards | **No** — by agreement, Milestone 3 |

---

## STOP

Milestone 2 ends here. All tests run, everything documented.

**Awaiting approval before Milestone 3 (Design System).**

Milestone 3 also carries recorded debt from Milestones 1–2 — see
`.claude/MILESTONE_RULES.md` §7: set `--radius` to 16px, add the status and chart
tokens, add shadow and z-index scales, the no-flash theme script, the RTL lint rule,
`vitest-axe`, and an RTL Playwright project.
