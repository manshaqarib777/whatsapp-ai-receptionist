# Milestone 2 — Progress

Status: Complete
Started: 2026-08-01
Completed: 2026-08-01
Last updated: 2026-08-01

See [`MILESTONE_02_COMPLETED.md`](MILESTONE_02_COMPLETED.md) for the final report.

---

## Completed Tasks

- [x] Resolve the page-vs-design-system conflict (user decision)
- [x] Choose an auth foundation — ADR-0001
- [x] Better Auth configuration with organization, twoFactor, magicLink plugins
- [x] Prisma schema: 9 tables, mapped to snake_case, fully indexed
- [x] Migration `20260801021835_auth`
- [x] Environment: `AUTH_SECRET`, `EMAIL_FROM`, optional OAuth credentials
- [x] Email port with console (dev) and in-memory (test) adapters
- [x] RBAC — 4 roles, 18 permissions, pure and unit-testable
- [x] Auth context — `requireAuth`, `requireOrg`, `requirePermission`, `can`
- [x] Open-redirect validator
- [x] Rate limiter
- [x] Audit log service — append-only, PII-sanitising
- [x] Organization service — create, list, members, role change, removal
- [x] API: organizations, active organization, members, member by id, audit logs
- [x] Login (password + magic link + OAuth)
- [x] Signup
- [x] Forgot password / reset password
- [x] Verify email
- [x] Two-factor challenge (TOTP + backup codes)
- [x] Two-factor settings (enrol, disable, backup codes)
- [x] Members management screen
- [x] Organization onboarding
- [x] App shell with organization switcher and account menu
- [x] Middleware (optimistic) + server-side authoritative checks
- [x] Unit tests (permissions, redirect, rate limit, env, audit sanitisation)
- [x] Integration tests (tenant isolation, audit log)
- [x] Component tests (login form)
- [x] E2E tests (route protection, signup, sign-in, reset, redirect, a11y, responsive)
- [x] Docs: ADR-0001, schema-change, api/auth.md, api/organizations.md
- [x] README and changelog

## Pending Tasks

None. Deferred with reasons, recorded as Known Limitations in the completion report:

- Real email provider → needs credentials
- OAuth end-to-end verification → needs credentials
- Distributed rate limiting → Milestone 24
- Invitation acceptance UI → see Limitation 4

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | `EMAIL_FROM` default `noreply@localhost` failed Zod email validation at boot | Resolved | The env validator did its job. Changed to `noreply@whatsapp-receptionist.local`. |
| 2 | Better Auth `admin` plugin rejected `adminRoles: ['owner','admin']` | Resolved | The `admin` plugin governs **platform**-level administrators, which is Milestone 22 (Admin Portal) — not organization RBAC. Removed it; org roles come from the `organization` plugin. Avoided implementing future-milestone scope by accident. |
| 3 | Generated Prisma schema used camelCase, no `@map`, no indexes (predicted as Risk 3) | Resolved | Mapped every model by hand and added indexes for all foreign keys and query columns. Regeneration procedure documented in schema-change.md. |
| 4 | `withApiHandler` had no route-context parameter, so dynamic segments (`/api/members/:id`) could not read params | Resolved | Extended the wrapper with a generic `RouteParams<T>` third argument, defaulting to an empty object so Milestone 1 routes are unaffected. |
| 5 | `authClient.forgetPassword` did not exist | Resolved | The method is `requestPasswordReset`. Corrected. |
| 6 | **Open-redirect bypass found by my own test**: `/%09javascript:alert(1)` passed | Resolved | The control-character check ran *before* decoding, so an encoded tab slipped through. Added a post-decode control-character check and `trimStart()` before the scheme test. |
| 7 | Milestone 1 env tests failed after `AUTH_SECRET` became required | Resolved | Updated the fixture and added 8 tests covering the new variables, including the minimum-length rule. |
| 8 | E2E reported 404 on every new API route | Resolved | A stale Milestone 1 `next-server` was still listening on 3000 and Playwright's `reuseExistingServer` adopted it. Killed it and rebuilt. **The tests were correct; the environment was stale.** |
| 9 | E2E password-validation locator matched two elements | Resolved | The field hint and the error both mention "12 characters". Scoped the assertion to `role="alert"`. |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-01 | Better Auth v1.6.25 | Plugins cover nearly the whole milestone; least hand-written security code | Auth.js v4 (no 2FA/orgs/RBAC), custom build (highest risk), Lucia (maintenance mode), Clerk/Auth0 (conflicts with M18/22/23) |
| 2026-08-01 | Database-backed sessions | Revocation must be immediate — role change, sign-out-all, compromised account | Stateless JWT |
| 2026-08-01 | Active organization on the **session row** | Makes `organizationId` server-derived and therefore trustworthy | Client-supplied header or body field |
| 2026-08-01 | Roles on `members`, not on `users` | A person may be owner of one org and viewer of another | Global role column |
| 2026-08-01 | Explicit role→permission lists, not a hierarchy | A hierarchy hides what each role can do; explicit lists make escalation visible in the diff | Numeric privilege levels |
| 2026-08-01 | Role read fresh from the DB on every request | A role change must take effect on the next request, not at session expiry | Trusting the session payload |
| 2026-08-01 | Cross-tenant → 404, never 403 | 403 confirms the resource exists in another tenant | 403 |
| 2026-08-01 | Audit service exposes no delete/update | The absence is the control; a comment is not | Documented convention |
| 2026-08-01 | `AuditLog.actorId` `onDelete: SetNull` | Deleting a user must not erase what they did | Cascade |
| 2026-08-01 | Audit metadata sanitised in code | A careless caller must not be able to write PII | Trusting call sites |
| 2026-08-01 | Middleware is optimistic only | Middleware cannot be the security boundary; the server-side check is | Session validation in middleware |

## Database Changes

| Migration | Description | Applied to |
|---|---|---|
| `20260801021835_auth` | 9 tables: users, sessions, accounts, verifications, two_factors, organizations, members, invitations, audit_logs | Local |

Documented in [`/docs/database/schema-change.md`](../database/schema-change.md).

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `ALL /api/auth/[...all]` | Added | No |
| `GET /api/organizations` | Added | No |
| `POST /api/organizations` | Added | No |
| `PATCH /api/organizations/active` | Added | No |
| `GET /api/members` | Added | No |
| `PATCH /api/members/:id` | Added | No |
| `DELETE /api/members/:id` | Added | No |
| `GET /api/audit-logs` | Added | No |

Documented in [`/docs/api/auth.md`](../api/auth.md) and
[`/docs/api/organizations.md`](../api/organizations.md).

## Breaking Changes

**`AUTH_SECRET` is now required.** The application refuses to start without it, and
rejects anything under 32 characters.

Migration: add `AUTH_SECRET` to every environment.
Generate with `openssl rand -base64 32`. Documented in `.env.example` and the README.

Internal only — no external consumers exist yet.
