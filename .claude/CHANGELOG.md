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

**Milestone 4 — Database**

- The data model for the whole product: 50 new tables covering the inbox, knowledge
  base, AI runs, scheduling, CRM, quotes, invoices, payments, workflows, and campaigns.
  An ER diagram covering all 85 tables across all 25 milestones is committed at
  `docs/database/er-diagram.md`.
- Businesses can have multiple branches. Every organization gets one automatically, and
  conversations, contacts, calendars, knowledge, and AI settings all belong to a
  specific branch — so a two-location business sees two separate inboxes rather than
  one merged list.
- Appointments cannot be double-booked. Two people booking the same person or room at
  overlapping times is refused by the database itself, so it holds even when both
  bookings arrive at the same instant.
- Deleting something moves it to the trash and it can be restored. This is separate
  from erasing a customer's personal data, which is now a distinct, tested operation.
- A customer can ask for their data to be erased. Their name, phone number, email,
  message contents, attachments, and any notes quoting them are overwritten, while the
  record of the request being honoured survives — so the business can still prove it
  complied.
- Money is stored to four decimal places with its currency alongside, and tax is
  recorded as the rate that applied on the day plus the amount it produced. Reissuing
  an old invoice will not silently reprice it at today's VAT rate.
- Appointments store both the exact instant and the timezone they were booked in, so
  "9am local" survives a daylight-saving rule change.
- `npm run db:seed` now produces a database you can demo from: two businesses, staff in
  every role, conversations in every state, appointments past and upcoming, and enough
  CRM and invoice history for charts to render. It is deterministic, so screenshots and
  end-to-end tests are reproducible.

### Changed

- **Local Postgres image is now `pgvector/pgvector:pg17`.** Stock `postgres:17-alpine`
  does not include the `vector` extension the knowledge base needs. Run
  `npm run db:up` to pick it up; existing local data is preserved.

### Fixed

- Every timestamp in the database is now stored with its timezone. They were previously
  stored without one, which would have produced wrong appointment times for any
  business operating across more than one region.

### Security

- Queries are scoped to the signed-in organization and branch centrally rather than at
  each call site, and database operations that cannot be scoped safely are refused
  outright. Covered by 32 tests that attempt cross-tenant access and prove it returns
  nothing. Reaching for the unscoped database client from feature code is now a build
  error rather than a review comment, so the guarantee cannot be stepped around by
  accident.
- Inbound WhatsApp messages are de-duplicated by the database, so a retried delivery
  from Meta cannot create a second copy of the same message.

**Milestone 3 — Design System**

- Design tokens completed: `--success`, `--warning`, `--info` (each with `-foreground`
  and `-subtle`), a categorical six-colour chart palette separated by hue rather than
  lightness, a two-layer `--elevation-xs…xl` scale, a named `--z-*` scale, and
  `--radius` corrected to 16px. Every component consumes tokens only.
- Light and dark themes, switchable and remembered, with no flash of the wrong theme
  on load. A theme switcher offers light, dark, or follow-the-system.
- `prefers-reduced-motion` is honoured globally, and components that animate in
  JavaScript check it individually rather than relying on the CSS reset.
- Form components: labelled field wrapper, text field, select, textarea, checkbox,
  radio, switch, date picker (localised, popover calendar), and time picker (fixed
  slots, canonical 24-hour value, localised display).
- Data components: sortable table with `aria-sort`, pagination, and table-shaped empty
  and loading states; metric card that requires a comparison period and colours by
  sentiment rather than by sign; line, area, bar, and sparkline charts, each shipping a
  screen-reader data table; timeline; markdown renderer.
- Rich text editor whose schema is the allow-list, so unknown markup is dropped rather
  than escaped, and `javascript:`/`data:` links never become links.
- File uploader with drag and drop, a keyboard route, previews, progress, and
  client-side type and size validation.
- Overlays: dialog, sheet, dropdown, popover, tooltip, toasts, and a ⌘K/Ctrl+K command
  palette that matches on keywords as well as labels.
- Navigation: collapsible sidebar whose active item comes from the route and whose
  collapse state survives a reload, sticky page header, breadcrumbs, tabs, accordion,
  and an application shell that turns the sidebar into a drawer on a phone.
- Empty, error, and loading states as components, so no screen can omit one.
- A development-only component gallery at `/design` showing every component in every
  state, with theme and direction toggles. It 404s in a production build.

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

- Auth screens are restyled onto the design system — a card surface, the shared field
  components, and a theme switcher. Structure and behaviour are unchanged; Milestone
  2's auth tests pass unmodified.
- `--muted-foreground`, `--destructive`, and `--success` are darker in light mode. All
  three failed the WCAG AA 4.5:1 text threshold at their previous values (4.34, 4.00,
  and 4.44 respectively), measured on the gallery.
- `--sidebar-accent` is darker in light mode. At 0.97 lightness against a 0.985 rail the
  active navigation item was all but invisible, which is the one state a sidebar cannot
  afford to be subtle about.
- The shared form field moved from `src/features/auth/components/form-field.tsx` to
  `src/components/form-field.tsx` and is now `TextField`. It is domain-agnostic and no
  longer implies that labelled inputs are an auth concern.

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

- Chart data tables no longer cause horizontal page overflow on a phone. `sr-only` on a
  `<table>` does not clamp it, so a full-width table sat off-screen and widened the
  document; the wrapper carries the class instead.
- The page header no longer nests an `<li>` inside an `<li>`, which the browser
  silently reshuffled into markup React disagreed with — discarding and re-rendering
  that part of the page on every load.
- The command palette no longer throws when opened. It rendered its input and items
  without the cmdk root that supplies their context.
- Rendering a stored rich-text document containing an unknown node no longer throws.
  Unknown content is rewritten to text rather than crashing the page around it.
- Loading regions carry `role="status"`. `aria-label` on a bare `<div>` is invalid ARIA
  and is ignored, so what was loading was announced as nothing at all.
- The gallery's animation section no longer renders different text on the server and the
  client, which made React discard and rebuild that part of the page under reduced
  motion.

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
