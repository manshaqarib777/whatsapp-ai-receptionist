# WhatsApp AI Receptionist

An AI-powered receptionist that operates over WhatsApp — answering customer messages,
qualifying enquiries, booking appointments, and escalating to humans when needed.

---

## Status

**Sequential implementation is complete through Milestone 25.** The repository produces
an immutable, non-root standalone container and includes CI, trace propagation,
liveness/readiness probes, monitoring guidance, alerts, deployment, and rollback
contracts. Final certification is local; no external preview or production environment
was deployed or verified.

Development is milestone-driven and sequential. The roadmap and requirements live in
[`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md); progress per milestone
is in [`docs/milestones/`](docs/milestones/).

What exists so far: the foundation (tooling, database, configuration, logging, error
handling, health checks, CI), a complete multi-tenant authentication system — sign-up,
sign-in, magic links, OAuth, two-factor, organizations, RBAC, sessions, and an
append-only audit log — a token-driven design system every later screen is built from,
the persistent data model the whole product runs on (covering the inbox,
knowledge base, AI runs, scheduling, CRM, quotes, invoices, payments, workflows,
campaigns, reviews, and loyalty), the dashboard and inbox, the knowledge base, the AI
engine, the appointment engine, CRM, quotations, invoicing and payments, the workflow
builder, the broadcast system, the analytics surface, the reviews system, and the
loyalty system (points, membership tiers, coupons, rewards, and referrals), trusted
multi-branch sessions, sandbox integrations, Voice AI, eight bounded AI specialist
agents, a separately authorized platform admin portal, hardened security/privacy
operations, and optional Redis-backed caching/rate limiting with streaming,
code-splitting, virtualization, and enforced asset budgets. Login-ready deterministic data is documented in
[`docs/DEMO_DATA.md`](docs/DEMO_DATA.md).

Browse the components at **<http://localhost:3000/design>** while the development
server is running. It is a development tool, not a product page, and 404s in a
production build.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript, strict |
| Database | PostgreSQL 17 + Prisma 7 |
| Cache / ephemeral state | Redis 8 (optional; safe PostgreSQL/direct-read fallbacks) |
| Async state | React Query v5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Icons / Fonts | Lucide / packaged local Geist |
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

Then create an account at http://localhost:3000/signup. With the default `console`
transport, the verification link is printed in the terminal running `npm run dev`.
See **Email** below to send real mail instead.

---

## Environment Variables

Names and purpose only — never commit values. See [`.env.example`](.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | Postgres connection string |
| `NEXT_PUBLIC_APP_URL` | **yes** | Public base URL; exposed to the browser |
| `APP_URL` | production | Server-only canonical runtime URL; permits one image digest across environments |
| `LOG_LEVEL` | no (defaults to `info`) | Pino log level |
| `AUTH_SECRET` | **yes** | Session signing secret, 32+ chars. `openssl rand -base64 32` |
| `EMAIL_FROM` | no | From address on outbound mail |
| `EMAIL_TRANSPORT` | no (`console`) | `smtp` for real delivery. **Required to be `smtp` in production.** |
| `SMTP_HOST` | if `smtp` | SMTP server hostname |
| `SMTP_PORT` | no (`587`) | 587 STARTTLS, 465 implicit TLS |
| `SMTP_USER` / `SMTP_PASSWORD` | no | Set both or neither |
| `SMTP_SECURE` | no (`false`) | `true` for implicit TLS on port 465 |
| `GOOGLE_CLIENT_ID` / `_SECRET` | no | Enables Google sign-in when both are set |
| `GITHUB_CLIENT_ID` / `_SECRET` | no | Enables GitHub sign-in when both are set |

`NODE_ENV` is deliberately **not** set in `.env` — Next.js manages it, and overriding
it makes a production server behave as though it were in development.

### Email

Two transports, selected by `EMAIL_TRANSPORT`:

**`console`** (default) — writes each message to the terminal with the link on its own
line. Zero setup. Use this if you just want to click a verification link locally.

**`smtp`** — real delivery through nodemailer. Works with any provider:

| Provider | `SMTP_HOST` | `SMTP_PORT` |
|---|---|---|
| Resend | `smtp.resend.com` | 587 |
| Postmark | `smtp.postmarkapp.com` | 587 |
| Amazon SES | `email-smtp.<region>.amazonaws.com` | 587 |
| Gmail | `smtp.gmail.com` | 587 |

Set `SMTP_USER` and `SMTP_PASSWORD` together — a half-set pair is rejected at boot.
For Gmail, `SMTP_PASSWORD` must be an
[App Password](https://myaccount.google.com/apppasswords), not your account password,
and `EMAIL_FROM` must match `SMTP_USER` or Gmail will rewrite it.

**Production refuses to boot unless `EMAIL_TRANSPORT=smtp`** — an app that starts while
silently discarding password-reset mail is worse than one that does not start.

Configuration is validated by Zod at boot in [`src/lib/env.ts`](src/lib/env.ts). The
application **refuses to start** on a missing or malformed variable, and the error
names every offending variable. `process.env` is read nowhere else — enforced by lint.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server (component gallery at `/design`) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` — must be 0 errors |
| `npm run lint` | ESLint — must be 0 errors, 0 warnings |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Verify formatting |
| `npm run test` | Unit, integration, component tests |
| `npm run test:coverage` | Tests with coverage |
| `npm run test:e2e` | Playwright E2E |
| `npm run performance:check` | Enforce production JS/CSS asset budgets after build |
| `npm run verify` | typecheck → lint → test → build |
| `npm run db:up` / `db:down` | Start / stop local Postgres, Redis, and worker services |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply migrations (CI/production) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Seed the database |
| `npm run db:check-drift` | Fail unless the only schema drift is the known HNSW drop |
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

Organizations can contain multiple branches. The active organization and branch are
trusted database-session state; appointment, knowledge, and AI data is isolated by
branch. Owners and admins manage locations at `/settings/branches`.

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

Build the production image with
`docker build -f docker/app.Dockerfile -t war-app:<version> .`. It runs the Next.js
standalone server as UID 1001 and probes `/api/health/ready`. CI verifies the image but
does not publish or deploy it; promotion remains an explicit operator action. See
[`docs/operations/deployment.md`](docs/operations/deployment.md) for the deployment and
rollback contract and [`docs/operations/observability.md`](docs/operations/observability.md)
for signals, alerts, and the incident runbook.
