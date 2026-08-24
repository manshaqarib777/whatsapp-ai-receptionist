# Milestone 1 — Progress

Status: Repair complete — preview verification assigned to Milestone 25
Started: 2026-08-01
Completed: 2026-08-01
Last updated: 2026-08-23

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

- [x] Replace network-fetched Google fonts with packaged local Geist fonts.
- [x] Resolve the current `deepmerge-ts` high-severity advisory without downgrading
      Prisma.
- [x] Re-run format, typecheck, lint, unit/integration/component, build, E2E, schema
      drift and dependency-audit gates.
- [x] Correct the completion report with current reproducible evidence.
- [x] Preview verification explicitly assigned to Milestone 25 by user direction on
      2026-08-23; no preview target exists yet.

Previously deferred items, recorded as Known Limitations 5 and 7 in the completion
report:

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
| 8 | Production build depends on downloading Geist from Google | Resolved | Replaced `next/font/google` with packaged `geist` local-font exports. A fresh production build succeeds without a Google Fonts request. |
| 9 | `npm audit` reports `deepmerge-ts <8` through Prisma tooling | Resolved | Pinned patched `deepmerge-ts` 8 through npm overrides. `npm audit` reports zero vulnerabilities; Prisma-backed tests and schema drift pass. |
| 10 | `npm run test:e2e` fails during test-module collection because required environment variables are undefined | Resolved | Playwright now calls Next 16's documented `loadEnvConfig()` before test imports. Also aligned the email send guard with the already-validated `E2E_TEST_RUN` exception. The suite collects and executes all 232 tests. |
| 11 | Fresh full E2E run is 229/232: three mobile assertions use ambiguous text selectors | Resolved | Replaced them with semantic main/heading/list-item scoped locators. Focused desktop/mobile regression runs pass, followed by a fresh full run: 232/232 in 8.4 minutes with one worker and zero retries. |
| 12 | Full Vitest run failed appointment reminder assertion under concurrent verification load | Resolved | The fixture added only one week to an expired date, which was still in the past on 2026-08-23; the service correctly scheduled no reminders. It now books a fixed future Sunday covered by the availability rule. Focused regression passes and the fresh full suite is 927/927. Prettier also passes. |
| 13 | Preview deployment exit criterion cannot be exercised | Deferred by user direction | The Vercel CLI is authenticated, but the account has no project for this repository and the worktree has no `.vercel` link. On 2026-08-23 the user directed the repair pass to proceed to the next milestone; preview provisioning and verification remain owned by Milestone 25. |

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
