# Milestone 1 — Progress

Status: Complete
Started: 2026-08-01
Completed: 2026-08-01
Last updated: 2026-08-01

See [`MILESTONE_01_COMPLETED.md`](MILESTONE_01_COMPLETED.md) for the final report.

---

## Completed Tasks

- [x] Initialise git repository (`main`)
- [x] Scaffold Next.js 16 + TypeScript + App Router + `src/`
- [x] Configure TypeScript strict (+ `noUncheckedIndexedAccess`, 5 further checks)
- [x] Configure ESLint (custom rules, per-file overrides, 0 warnings enforced)
- [x] Configure Prettier (+ Tailwind class sorting)
- [x] Configure Husky (pre-commit: lint-staged + typecheck)
- [x] Configure Commitlint (conventional commits, 72-char header)
- [x] Configure Tailwind v4
- [x] Configure shadcn/ui (Nova preset — Lucide + Geist)
- [x] Configure React Query (provider, retry policy, staleTime)
- [x] Docker Postgres 17 (loopback-bound, health check)
- [x] Prisma schema + initial migration + seed
- [x] Environment validation — `src/lib/env.ts`
- [x] Logger — `src/lib/logger.ts` (Pino + redaction)
- [x] Configuration — env + `next.config.ts`
- [x] Error handling — `src/lib/errors.ts` + `src/server/api-handler.ts`
- [x] Error boundaries — route, global, 404
- [x] Health check — `GET /api/health`
- [x] Unit tests (51)
- [x] Integration tests (15, real Postgres)
- [x] Component tests (6)
- [x] E2E tests (14, five viewports)
- [x] CI/CD pipeline (GitHub Actions + Postgres service)
- [x] Security headers
- [x] Performance baseline recorded
- [x] Documentation — README, architecture, API, database
- [x] Changelog entry

## Pending Tasks

None. Two items deferred with reasons, recorded as Known Limitations 5 and 7 in the
completion report:

- Realistic dummy data → Milestone 4 (needs a real schema)
- Preview-deployment verification → Milestone 25 (owns deployment)

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | `create-next-app` produced 3 high-severity vulnerabilities (`postcss`, `sharp` via `next@16.2.12`) | Resolved | `npm audit fix --force` proposed downgrading to `next@9.3.3`. Instead pinned patched `postcss@^8.5.25` and `sharp@^0.35.3` via npm `overrides`. Audit now reports 0. Revisit when Next 16.3 ships. |
| 2 | Prisma 7 rejects `url` in `schema.prisma` | Resolved | Moved the URL to `prisma.config.ts` and adopted the `@prisma/adapter-pg` driver adapter. Added `@prisma/adapter-pg` and `pg`. |
| 3 | Vitest did not load `.env`, so `env.ts` threw during unit tests | Resolved | Declared test config explicitly in `vitest.config.ts` → `test.env`, so runs are deterministic across machines. Only `DATABASE_URL` is overridable, for CI. |
| 4 | `noPropertyAccessFromIndexSignature` broke `process.env.CI` in `playwright.config.ts` | Resolved | Switched to bracket notation. |
| 5 | E2E keyboard-navigation test failed — scaffold page has no interactive controls | Resolved | Rewritten as a tripwire asserting zero focusable elements, so it fails when M3 adds the first control and forces a real focus test. |
| 6 | Failure-path tests passed against the real database — `vi.resetModules()` + dynamic imports gave the service a fresh `prisma`, so the spy targeted a stale object | Resolved | Switched to static imports, dropped `resetModules`. Documented in the test file so it is not reintroduced. |
| 7 | Missing test committed to in the plan (DB-unreachable → 503) | Resolved | Added `health-degraded.test.ts` (6 tests) covering degraded status, 503 envelope, no leaked internals, correlation id, and the timeout race. |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-01 | Host Postgres port 5433 | 5432 commonly occupied on dev hosts (plan Risk 7) | 5432 |
| 2026-08-01 | npm `overrides` for `postcss`/`sharp` | Clears real advisories without downgrading Next 6 majors | `npm audit fix --force`; ignoring the audit |
| 2026-08-01 | Prisma driver adapter (`@prisma/adapter-pg`) | Required by Prisma 7 | Pinning Prisma 6 |
| 2026-08-01 | Test env declared in `vitest.config.ts` | Deterministic and identical in CI; no hidden `.env.test` | dotenv in setup file |
| 2026-08-01 | `no-restricted-properties` on `process.env` | Makes the env-validation rule enforceable rather than aspirational | Convention and code review |
| 2026-08-01 | `no-restricted-imports` on `@prisma/client` | Makes "components never touch the database" enforceable | Convention |
| 2026-08-01 | Playwright `retries: 0` in CI | `TESTING_RULES.md` forbids retrying a flaky test into passing | `retries: 2` |
| 2026-08-01 | Native `resolve.tsconfigPaths` | Plugin now recommends it; one fewer dependency | `vite-tsconfig-paths` |
| 2026-08-01 | `HealthCheck` exempt from `tenant_id` | Infrastructure table, no tenant data; exemption recorded so it is not precedent | Adding a meaningless `tenant_id` |

## Database Changes

| Migration | Description | Applied to |
|---|---|---|
| `20260801001459_init` | Creates `health_checks` (`id` uuid PK, `checked_at` timestamptz) | Local |

Documented in [`/docs/database/schema-change.md`](../database/schema-change.md).

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `GET /api/health` | Added | No — new endpoint |

Documented in [`/docs/api/health.md`](../api/health.md).

## Breaking Changes

None — initial milestone.
