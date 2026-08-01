# WhatsApp AI Receptionist

An AI-powered receptionist that operates over WhatsApp — answering customer messages,
qualifying enquiries, booking appointments, and escalating to humans when needed.

---

## Status

**Milestone 2 — Authentication.** Complete.

Development is milestone-driven and sequential. The roadmap and requirements live in
[`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md); progress per milestone
is in [`docs/milestones/`](docs/milestones/).

What exists so far: the foundation (tooling, database, configuration, logging, error
handling, health checks, CI) and a complete multi-tenant authentication system —
sign-up, sign-in, magic links, OAuth, two-factor, organizations, RBAC, sessions, and
an append-only audit log.

There is no product functionality yet. The dashboard is a placeholder; the design
system is Milestone 3.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript, strict |
| Database | PostgreSQL 17 + Prisma 7 |
| Async state | React Query v5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Icons / Fonts | Lucide / Geist |
| Auth | Better Auth v1.6 ([ADR-0001](docs/architecture/decisions/ADR-0001-better-auth.md)) |
| Validation | Zod |
| Logging | Pino (structured, with redaction) |
| Testing | Vitest + Testing Library, Playwright |
| Tooling | ESLint, Prettier, Husky, Commitlint, lint-staged |
| Local infra | Docker Compose |

---

## Prerequisites

- Node.js >= 22
- npm >= 10
- Docker and Docker Compose

---

## Local Setup

From a clean clone:

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env.local
cp .env.example .env          # Prisma CLI reads .env

# 3. Start Postgres (host port 5433)
npm run db:up

# 4. Apply migrations and seed
npm run db:migrate
npm run db:seed

# 5. Run the app
npm run dev
```

Then create an account at http://localhost:3000/signup. The verification link is
printed to the terminal running `npm run dev` — open it to activate the account.

---

## Environment Variables

Names and purpose only — never commit values. See [`.env.example`](.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | Postgres connection string |
| `NEXT_PUBLIC_APP_URL` | **yes** | Public base URL; exposed to the browser |
| `LOG_LEVEL` | no (defaults to `info`) | Pino log level |
| `AUTH_SECRET` | **yes** | Session signing secret, 32+ chars. `openssl rand -base64 32` |
| `EMAIL_FROM` | no | From address on outbound mail |
| `GOOGLE_CLIENT_ID` / `_SECRET` | no | Enables Google sign-in when both are set |
| `GITHUB_CLIENT_ID` / `_SECRET` | no | Enables GitHub sign-in when both are set |

`NODE_ENV` is deliberately **not** set in `.env` — Next.js manages it, and overriding
it makes a production server behave as though it were in development.

**No email provider is configured.** In development, verification, password-reset, and
magic-link messages are written to the application log. Look there for the link.

Configuration is validated by Zod at boot in [`src/lib/env.ts`](src/lib/env.ts). The
application **refuses to start** on a missing or malformed variable, and the error
names every offending variable. `process.env` is read nowhere else — enforced by lint.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` — must be 0 errors |
| `npm run lint` | ESLint — must be 0 errors, 0 warnings |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Verify formatting |
| `npm run test` | Unit, integration, component tests |
| `npm run test:coverage` | Tests with coverage |
| `npm run test:e2e` | Playwright E2E |
| `npm run verify` | typecheck → lint → test → build |
| `npm run db:up` / `db:down` | Start / stop Postgres |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply migrations (CI/production) |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Prisma Studio |

Integration tests require Postgres to be running. They **fail** rather than skip when
it is unreachable — a skipped integration suite reports green while proving nothing.

---

## Project Structure

```
.claude/            Development rules — read these before contributing
docs/               Requirements, milestones, architecture, API, database docs
docker/             Local Postgres
prisma/             Schema, migrations, seed
src/
  app/              Routing only (App Router)
  features/         Business domains — vertical slices
  components/ui/    Design system primitives (shadcn/ui)
  lib/              env, logger, errors, prisma client
  providers/        React context providers
  server/           Server-only: the API handler wrapper
tests/e2e/          Playwright specs
```

Architecture is feature-first with Controller → Service → Repository layering inside
each feature. Components never access the database. See
[`.claude/ARCHITECTURE_RULES.md`](.claude/ARCHITECTURE_RULES.md).

---

## Development Rules

This project follows a strict, documented process. Before contributing, read:

| File | Covers |
|---|---|
| [`.claude/CLAUDE.md`](.claude/CLAUDE.md) | Start here — execution order, requirement source |
| [`.claude/RULES.md`](.claude/RULES.md) | Master rules |
| [`.claude/ARCHITECTURE_RULES.md`](.claude/ARCHITECTURE_RULES.md) | Layering, folder structure |
| [`.claude/CODING_STANDARDS.md`](.claude/CODING_STANDARDS.md) | Code style, forbidden patterns |
| [`.claude/DESIGN_RULES.md`](.claude/DESIGN_RULES.md) | Visual system — start here for design |
| [`.claude/DESIGN_TOKENS.md`](.claude/DESIGN_TOKENS.md) | Token values, dark mode, elevation |
| [`.claude/COMPONENT_DESIGN.md`](.claude/COMPONENT_DESIGN.md) | Cards, forms, tables, dashboard, charts |
| [`.claude/MOTION_RULES.md`](.claude/MOTION_RULES.md) | Interaction states, motion, skeletons |
| [`.claude/ACCESSIBILITY_RULES.md`](.claude/ACCESSIBILITY_RULES.md) | WCAG 2.2 AA conformance |
| [`.claude/RTL_I18N_RULES.md`](.claude/RTL_I18N_RULES.md) | Arabic / RTL support |
| [`.claude/LANDING_PAGE_RULES.md`](.claude/LANDING_PAGE_RULES.md) | Marketing surfaces |
| [`.claude/UI_RULES.md`](.claude/UI_RULES.md) | Component construction |
| [`.claude/DATABASE_RULES.md`](.claude/DATABASE_RULES.md) | Schema, migrations, queries |
| [`.claude/API_RULES.md`](.claude/API_RULES.md) | Route contracts |
| [`.claude/TESTING_RULES.md`](.claude/TESTING_RULES.md) | Test requirements |
| [`.claude/SECURITY_RULES.md`](.claude/SECURITY_RULES.md) | Secrets, PII, tenant isolation |

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) and are
enforced by Commitlint. Pre-commit runs lint-staged and the type-checker.

---

## Deployment

Not yet configured. Deployment, monitoring, tracing, and rollback are **Milestone 25**.
