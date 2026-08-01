# Changelog

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Updating this file is part of development, not a follow-up task. Every user-visible
change gets an entry in the same PR.

---

## Rules

- Add to `[Unreleased]` as you work. Never write an entry after the fact from git log.
- Categories, in this order: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`,
  `Security`.
- Write for the reader, not the author. Describe the change in behaviour, not the diff.
- Mark breaking changes with **BREAKING** and state the migration path.
- Never include secrets, customer data, phone numbers, or internal-only identifiers.
- On release, rename `[Unreleased]` to `[x.y.z] - YYYY-MM-DD` and open a fresh
  `[Unreleased]`.
- Version bumps: `MAJOR` breaking, `MINOR` new feature, `PATCH` fix.

---

## [Unreleased]

### Added

**Email delivery — real SMTP**

- SMTP transport via nodemailer, working against any provider (Resend, Postmark, SES,
  Gmail, a corporate relay). Selected with `EMAIL_TRANSPORT=smtp`; switching provider
  changes environment variables only.
- The `console` transport now prints each message as a delimited block with the link on
  its own line, so a verification link is usable without a mail server.
- Environment validation refuses to boot in production unless `EMAIL_TRANSPORT=smtp`,
  and rejects a half-set SMTP credential pair — the dangerous state is one where the
  app starts and account-critical mail silently goes nowhere.
- The health check now verifies the SMTP connection alongside the database, in
  parallel. The console transport reports `not-configured` rather than `error`, so a
  deliberate development setting does not mark the service degraded.

**Milestone 2 — Authentication**

- Email/password sign-up and sign-in with mandatory email verification.
- Password reset via a single-use, one-hour, emailed link.
- Magic-link sign-in — single-use, 15-minute expiry.
- TOTP two-factor authentication with ten single-use backup codes, plus enrolment
  and removal from `/settings/security`. Both require the account password.
- OAuth via Google and GitHub, enabled only when credentials are configured.
- Organizations: create, list, switch, and manage members. Creator becomes owner.
- RBAC — four roles (`owner`, `admin`, `member`, `viewer`) across 18 permissions,
  enforced server-side on every protected route. Unknown roles are denied everything.
- Append-only audit log with PII sanitisation, exposed at `GET /api/audit-logs`.
- Database-backed sessions with immediate revocation.
- Auth screens: login, signup, forgot/reset password, verify email, two-factor
  challenge, security settings, members, and organization onboarding.

**Milestone 1 — Project Foundation**

- Next.js 16 (App Router) + React 19 + TypeScript in strict mode, with
  `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature`.
- PostgreSQL 17 in Docker Compose, bound to loopback on host port 5433.
- Prisma 7 with the `@prisma/adapter-pg` driver adapter, initial migration, and seed.
- Environment validation (`src/lib/env.ts`) — Zod-parsed at boot; the app refuses to
  start on a missing or malformed variable and names every offending one.
- Structured logging (`src/lib/logger.ts`) — Pino with PII redaction configured at the
  logger, so a careless call site fails safe.
- Typed domain errors (`src/lib/errors.ts`) mapped to the documented status codes.
- API handler wrapper (`src/server/api-handler.ts`) providing correlation ids,
  request logging, and a consistent error envelope to every route.
- `GET /api/health` — liveness and database check with a 2-second timeout.
- React Query provider, Tailwind v4, shadcn/ui (Nova preset: Lucide + Geist).
- Error boundaries: route-level, global, and 404.
- Test suites: 72 unit/integration/component (Vitest) and 14 E2E (Playwright,
  five viewports from mobile to ultra-wide).
- CI pipeline: audit → generate → migrate → typecheck → lint → format → test →
  build → E2E, with a Postgres service container.
- Tooling gates: ESLint (0 warnings), Prettier, Husky, lint-staged, Commitlint.
- Documentation: README, architecture overview, API reference, schema-change record.

**Design system documentation** (audit against premium SaaS standards)

- `DESIGN_TOKENS.md` — three-tier token architecture, OKLCH colour values for light
  and dark, status and chart token specifications, two-layer elevation scale, named
  z-index scale, ramp generation, dark-mode strategy.
- `COMPONENT_DESIGN.md` — visual hierarchy, per-component spacing table, and visual
  specifications for cards, forms, tables, sidebar and navigation, dashboards, charts,
  badges, toasts, and modals. Includes SaaS dashboard best practice.
- `MOTION_RULES.md` — interaction state matrix (rest, hover, focus, pressed, selected,
  disabled, loading, error), Framer Motion API rules, micro-interaction catalogue,
  skeleton loader construction, page transitions.
- `ACCESSIBILITY_RULES.md` — WCAG 2.2 Level AA named as the conformance target, with
  the criteria most at risk in this product and a per-component and per-milestone
  verification procedure.
- `RTL_I18N_RULES.md` — Arabic and right-to-left support: logical properties, what
  flips and what does not, bidi text, numerals, Arabic typography, translation rules.
- `LANDING_PAGE_RULES.md` — marketing surface standards distinct from the product.

### Changed
- **BREAKING** `AUTH_SECRET` is now required and must be at least 32 characters. The
  application refuses to start without it. Add it to every environment; generate with
  `openssl rand -base64 32`.
- `withApiHandler` now passes Next's route context as a third argument, so dynamic
  segments can read their params. Existing routes are unaffected.
- `DESIGN_RULES.md` — added a design-system file index, a layout composition section,
  and an expanded mobile-first strategy. Corrected the token location from the
  non-existent `src/ui/tokens.css` to `src/app/globals.css`.
- `MILESTONE_RULES.md` — recorded the token debt Milestone 3 must clear before any
  component is authored.

### Deprecated
- Nothing yet.

### Removed
- Nothing yet.

### Fixed
- **Signup was completely broken.** Better Auth generates nanoid-style ids, which
  Postgres rejected for the `@db.Uuid` primary keys, so every registration failed with
  `P2007` and no account was created. The auth layer now generates real UUIDs
  (`advanced.database.generateId`). Found while manually verifying the setup, not by
  the test suite — see below.
- Signup no longer treats HTTP 400/422 as success. That masking existed to hide
  duplicate addresses, but the auth layer already handles duplicates
  enumeration-safely by returning 200 with no token. The masking instead concealed the
  id bug above, letting the E2E suite pass against a flow that created zero accounts.
  Added an API-level regression guard that asserts a real UUID is returned.
- Removed `NODE_ENV` from `.env`. Next.js sets it itself, and overriding it made
  `next start` behave as a development server — including injecting the dev-tools
  overlay into production HTML. Caught by the Milestone 1 tripwire test.

### Security
- `organizationId` is derived server-side from the session row and never from client
  input, which is what makes tenant scoping trustworthy. Proven by 17 integration tests.
- Cross-tenant access returns 404 rather than 403, so existence is never confirmed
  across tenants.
- Account enumeration is prevented on sign-in, sign-up, password reset, and magic
  link — all four return identical outcomes whether or not an address is registered.
- Open-redirect defence on the post-login `next` parameter: absolute, protocol-relative,
  backslash, encoded-traversal, and control-character vectors are all rejected. 30 tests.
- Privilege escalation is blocked — only an owner may create another owner, and the
  last owner can be neither demoted nor removed.
- Rate limiting on sign-in, sign-up, password reset, magic link, and two-factor.
- Audit metadata is stripped of PII in code, so a careless caller cannot write it.
- Security headers on every response: CSP, HSTS, `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- `X-Powered-By` suppressed so the framework version is not advertised.
- Pinned `postcss` and `sharp` via npm overrides to clear three high-severity
  advisories inherited transitively from Next.js 16.2.12. `npm audit` reports 0
  vulnerabilities; CI fails the build on high or critical.
- Lint rules forbid reading `process.env` outside `src/lib/env.ts` and importing
  `@prisma/client` outside `src/lib/prisma.ts`.

---

## Template

```markdown
## [1.2.0] - 2026-08-14

### Added
- Human takeover in the inbox: an agent can claim a conversation and the AI stops
  replying until the thread is released. (Milestone 07)

### Changed
- **BREAKING** `POST /api/conversations/:id/messages` now requires `authorType`.
  Migration: send `"agent"` for staff-authored messages. Clients on the old contract
  receive 400 from 2026-09-01.

### Fixed
- Duplicate replies when Meta redelivered a webhook. Deliveries are now deduped on
  `whatsapp_message_id`.

### Security
- Webhook signatures are now compared in constant time.
```
