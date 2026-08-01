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

### Changed
- Nothing yet.

### Deprecated
- Nothing yet.

### Removed
- Nothing yet.

### Fixed
- Nothing yet.

### Security
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
