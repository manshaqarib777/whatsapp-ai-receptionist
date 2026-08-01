# Milestone 1 — Project Foundation

Status: Planned
Created: 2026-08-01
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 1`

---

## Objective

A production-ready starter that every later milestone builds on without rework.

Concretely, at the end of this milestone the following are true and not true now:

- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all pass from a
  clean clone.
- A Postgres database runs locally in Docker and Prisma connects to it.
- The app refuses to boot on a missing or malformed environment variable, with a
  message naming the variable.
- Every request has a correlation id and structured logs; no `console.log` anywhere.
- Unhandled errors return a safe, typed JSON envelope — never a stack trace.
- `GET /api/health` reports process and database liveness.
- A commit is impossible without passing lint, types, and a conventional commit message.
- CI runs the full gate on every push and pull request.

No product features. No pages beyond what proves the stack works. No design system —
that is Milestone 3.

---

## Requirements

Copied verbatim from `/docs/PRODUCT_REQUIREMENTS.md`:

```
# MILESTONE 1

Project Foundation

Tasks

Create project

Configure

TypeScript

ESLint

Prettier

Husky

Commitlint

Tailwind

shadcn

React Query

Prisma

Postgres

Docker

Environment Validation

Logger

Configuration

Error Handling

Health Check

CI/CD

Tests

Deliverables

Production-ready starter.

STOP

Run all tests.

Document everything.

Wait.
```

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16, App Router | PRD requires Server Components by default |
| Language | TypeScript strict, `noUncheckedIndexedAccess` | PRD: strict only |
| Runtime | Node.js. No `runtime = 'edge'` | `ARCHITECTURE_RULES.md` §12 |
| Package manager | npm | PRD verification commands are `npm run *` |
| ORM | Prisma | PRD, Milestone 1 |
| Database | Postgres 17 in Docker | PRD, Milestone 1 |
| Async state | React Query v5 | PRD coding standards |
| Styling | Tailwind v4 + shadcn/ui | PRD, Milestone 1 |
| Validation | Zod | PRD coding standards |
| Testing | Vitest + RTL, Playwright for E2E | `TESTING_RULES.md` |
| Logging | Pino, structured JSON, redaction at the logger | `SECURITY_RULES.md` PII rule |
| CI | GitHub Actions | Standard; no platform lock-in at this stage |

**Directory layout** — created per `ARCHITECTURE_RULES.md` §4, but only the directories
this milestone actually populates. Empty scaffolding for future milestones is not
created (`RULES.md` §6: never create random files).

This milestone establishes three cross-cutting foundations that later milestones
consume rather than reinvent:

1. **`src/lib/env.ts`** — the single place `process.env` is read, Zod-validated at
   module load. Importing it from anywhere gives typed, guaranteed-present config.
2. **`src/lib/logger.ts`** — Pino with a redaction list. PII redaction lives at the
   logger so a careless call site fails safe (`SECURITY_RULES.md`).
3. **`src/lib/errors.ts` + `src/server/api-handler.ts`** — typed domain errors and one
   wrapper that maps them to the response envelope in `API_RULES.md`. Every future
   route uses this wrapper; none re-implements error mapping.

**Deferred deliberately**
- Auth — Milestone 2. No session, user, or RBAC code here.
- Full schema — Milestone 4. This milestone creates only what proves Prisma works.
- Design system — Milestone 3. Tailwind and shadcn are *installed and configured*
  only; no component library is authored.
- Redis — Milestone 24.

---

## Dependencies

**Runtime**
| Package | Purpose |
|---|---|
| `next`, `react`, `react-dom` | Framework |
| `@prisma/client` | DB client |
| `zod` | Validation, env parsing |
| `@tanstack/react-query` | Async state (PRD) |
| `pino`, `pino-pretty` | Structured logging |
| `tailwindcss`, `@tailwindcss/postcss` | Styling |
| `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` | shadcn deps |

**Development**
| Package | Purpose |
|---|---|
| `typescript`, `@types/*` | Types |
| `eslint`, `eslint-config-next`, `@typescript-eslint/*` | Lint |
| `prettier`, `prettier-plugin-tailwindcss` | Format |
| `husky`, `lint-staged`, `@commitlint/{cli,config-conventional}` | Commit gates |
| `prisma` | Migrations, client generation |
| `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/*` | Unit/component tests |
| `@playwright/test` | E2E |
| `tsx` | Run TS scripts (seed) |

**External**
- Docker + Docker Compose — verified present (29.1.3 / 2.40.3).
- Node 22.20.0, npm 10.9.3 — verified present.
- git — present; repository must be initialised for Husky to install hooks.

No credentials required this milestone. No third-party accounts.

---

## Database Impact

Minimal by design — the full schema is Milestone 4.

**Created**
- `docker/docker-compose.yml` — Postgres 17, named volume, health check.
- `prisma/schema.prisma` — datasource, generator, and one model.
- One model, `HealthCheck`, whose only purpose is to prove that migrations apply and
  the client round-trips:

```prisma
model HealthCheck {
  id        String   @id @default(uuid()) @db.Uuid
  checkedAt DateTime @default(now()) @map("checked_at")
  @@map("health_checks")
}
```

- Initial migration `0001_init`.

**Not created**: tenants, users, conversations, messages. Those belong to Milestones
2 and 4. Creating them now would be implementing future-milestone scope.

**Migration strategy**: `prisma migrate dev` locally, `prisma migrate deploy` in CI.
**Rollback**: this is the initial migration — rollback is dropping the database, which
holds no data. Documented in `/docs/database/schema-change.md`.

Naming note: `DATABASE_RULES.md` mandates `tenant_id` on every table. `health_checks`
is infrastructure, not tenant data, and is exempt. The rule applies from Milestone 2
onward; the exemption is recorded in the schema-change doc so it is not read as
precedent.

---

## API Impact

One route.

```
GET /api/health
```

| Aspect | Detail |
|---|---|
| Auth | None — must be reachable by an uptime probe before auth exists |
| Rate limit | None this milestone (Redis is M24); documented as a known limitation |
| 200 | `{ data: { status: "ok", uptime, timestamp, checks: { database: "ok" } } }` |
| 503 | `{ error: { code: "UNHEALTHY", message, details: [...] } }` when the DB check fails |

It exercises the full stack the milestone builds: env → logger → handler wrapper →
error envelope → Prisma. If health passes, the foundation is wired correctly.

Per `API_RULES.md`, all seven requirements apply even here. Auth and authorization are
explicitly *not applicable* and that is documented rather than silently skipped.

---

## UI Impact

Intentionally near-zero. **Design system is Milestone 3; pages must not be built
before it** (PRD).

- `src/app/layout.tsx` — root layout, font setup (Inter/Geist), providers.
- `src/app/page.tsx` — a minimal status page proving Tailwind, React Query, and the
  API round-trip work end to end. Explicitly a scaffold, marked as such, replaced in
  M3/M5.
- `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/global-error.tsx` — error
  boundaries, required by the PRD's "comprehensive error boundaries".
- `src/providers/query-provider.tsx` — React Query client and devtools.
- Theme tokens for light/dark are *stubbed* in CSS variables so M3 has a place to land.
  No component library is authored here.

Accessibility and responsiveness of the scaffold page still verified — the standard
applies from the first screen.

---

## AI Impact

None. No prompts, tools, models, or agent code in this milestone. The AI Engine is
Milestone 8; agents are Milestone 21.

No AI SDK dependency is installed yet — installing it now would be unused surface.

---

## Security Considerations

| Area | This milestone |
|---|---|
| Secrets | `.env*` gitignored from the first commit. `.env.example` documents names only. |
| Env validation | Zod at boot; the process exits on invalid config rather than running degraded. |
| `process.env` | Read only in `src/lib/env.ts`. Enforced by an ESLint `no-restricted-properties` rule. |
| Logging | Pino redaction paths configured now: `authorization`, `cookie`, `password`, `token`, `phone`, `body`. Redaction at the logger, not the call site. |
| Error leakage | The handler wrapper returns generic messages; detail goes to logs with a correlation id. Stack traces never reach a response. |
| Headers | HSTS, CSP, `nosniff`, `X-Frame-Options: DENY`, referrer policy, permissions policy set in `next.config.ts`. |
| Health endpoint | Returns liveness only. No versions, dependency lists, connection strings, or host details — those are reconnaissance. |
| Dependencies | Lockfile committed; `npm audit` runs in CI and fails the build on high/critical. |
| Docker | Postgres bound to `127.0.0.1` only, never `0.0.0.0`. Dev credentials are dev-only and clearly marked. |

Tenant isolation, authn/authz, and rate limiting arrive with Milestones 2 and 23. That
is a **known limitation** of this milestone, recorded as such — not an oversight.

---

## Testing Strategy

All four layers, per `TESTING_RULES.md`. Tests ship with the code, not after.

**Unit**
- `env.ts`: valid config parses; missing variable throws naming it; malformed
  `DATABASE_URL` rejected; defaults applied.
- `errors.ts`: each domain error maps to its documented status code.
- `logger.ts`: configured redaction paths are actually redacted in output.

**Integration**
- `GET /api/health` with the database up → 200, `checks.database === "ok"`.
- `GET /api/health` with the database unreachable → 503, correct error envelope, no
  stack trace or connection string in the body.
- Prisma round-trip against real Postgres: migrate, insert, read back.

**Component**
- Root layout renders children.
- The scaffold status page renders loading, error, and success states.
- An error boundary catches a thrown child and renders recovery UI with a retry.

**E2E (Playwright)**
- App boots, the status page loads, health reports ok.
- Keyboard navigation reaches every interactive element with a visible focus ring.
- Light and dark render without contrast failures.

**Coverage**: 90% on `src/lib`, per `TESTING_RULES.md`.

**CI gate**: `npm ci` → typecheck → lint → test → build → e2e → `npm audit`. Any red
step fails the build.

---

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Integration tests need real Postgres; CI without a DB service silently skips them, giving false green | Medium | High | Postgres as a GitHub Actions service container; a test asserts the DB is reachable and **fails** rather than skips if not |
| 2 | Husky hooks require a git repo; none exists yet | High | Low | `git init` as an explicit first step, before `husky init` |
| 3 | Tailwind v4 changed configuration (CSS-first, no `tailwind.config.js`); shadcn setup differs from most documentation | Medium | Medium | Follow the shadcn CLI for the installed version rather than memorised steps; verify styles actually apply before closing the milestone |
| 4 | Over-scoping — foundation work invites building auth models or design tokens "while we're here" | High | High | Scope frozen to the PRD's task list. Anything else is deferred to its milestone and logged in PROGRESS |
| 5 | Strict lint rules (`no-restricted-properties` on `process.env`) may fight framework files | Medium | Low | Scoped override for `src/lib/env.ts` and config files only, with a comment explaining why |
| 6 | Next 16 + React 19 peer-dependency churn across testing libraries | Medium | Medium | Install and run the full gate immediately after scaffolding, before writing application code, so breakage surfaces early |
| 7 | Docker Postgres port 5432 already in use on the host | Medium | Low | Map to 5433 on the host; `DATABASE_URL` in `.env.example` matches |

---

## Definition of Done

Per `MILESTONE_RULES.md` §8. Notable items for this milestone:

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run lint` — 0 errors, 0 warnings
- [ ] `npm run test` — unit, integration, component all pass
- [ ] `npm run test:e2e` — passes
- [ ] `npm run build` — compiles
- [ ] Performance baseline **recorded** (First Paint, LCP, bundle size, hydration,
      memory) — this milestone establishes the baseline that later milestones are
      measured against
- [ ] Accessibility verified on the scaffold page
- [ ] Responsive verified: desktop, laptop, tablet, mobile, ultra-wide
- [ ] README, architecture, API, and database docs written
- [ ] `CHANGELOG.md` updated
- [ ] `MILESTONE_01_COMPLETED.md` written
- [ ] **STOP** — report, then wait for approval before Milestone 2
