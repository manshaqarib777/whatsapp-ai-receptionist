# Milestone 24 — Completed

Completed: 2026-08-24

## What Was Built

Redis 8 now provides optional multi-instance ephemeral state through one lazy typed
adapter. Rate limits use an atomic Redis script and fall back to the durable PostgreSQL
bucket when Redis is unavailable. Short-lived integration catalog caching uses
HMAC-digested tenant keys, exact mutation invalidation, and direct-read fallback; no
sessions, permissions, credentials, PII, or message bodies enter the cache.

The application keeps its per-request nonce CSP and streams an application-route
loading boundary. The workflow graph editor has a client dynamic-import boundary, and
large inbox result sets use an accessible overscanned window. Production JS/CSS asset
budgets are executable and documented.

## Files Created

- `src/lib/redis.ts`, `src/lib/cache.ts`, and `src/lib/db/redis-rate-limit.ts` — optional
  Redis, tenant cache, and atomic limiter adapters.
- `src/lib/virtual-window.ts` and `src/lib/performance-budget.ts` — pure window/budget logic.
- `src/features/workflow-builder/components/lazy-workflow-builder.tsx` — dynamic editor boundary.
- `scripts/check-performance-budget.ts` — production asset gate.
- `tests/e2e/performance.spec.ts` — Redis secrecy and immutable-asset browser evidence.
- `docs/architecture/performance.md` — performance and safe fallback contract.

## Tests Completed

| Type | Count | Coverage | Command |
|---|---:|---|---|
| Focused cache/integration | 4 | Real Redis exact invalidation, TTL, atomic rate limit, integration isolation | `REDIS_URL=... npx vitest run ...` |
| Full Vitest | 1,020 | 119 repository test files, Redis enabled | `REDIS_URL=... npm test` |
| Focused E2E | 10 | Performance desktop/mobile plus integration transition repeated 3× per project | `npm run test:e2e -- ...` |
| Full E2E | 256 | Desktop and mobile production regression matrix, Redis enabled | `REDIS_URL=... npm run test:e2e` |

TypeScript, zero-warning ESLint, Prettier, production build, schema drift, two
post-browser seed replays, `git diff --check`, new-file size policy, and high-severity
production dependency audit all passed.

## Performance Results

- Production compilation: 66 seconds; TypeScript: 84 seconds; 74 route entries generated.
- Asset budget: 93 JS/CSS assets; largest JS chunk 439,993 bytes (limit 512,000 bytes).
- Full Vitest: 129.07 seconds, 1,020 tests.
- Final full Playwright: 10.3 minutes, one worker, 256 journeys.
- Deterministic post-E2E seeds: 2.502 and 2.117 seconds.
- All new Milestone 24 production/test/script files are below 300 lines.

## Known Limitations

- Redis is optional and ephemeral; queues continue using PostgreSQL intentionally.
- Cache payloads are internal fixed DTOs rather than a general-purpose ORM cache.
- Nonce CSP requires request-time rendering; streaming and short aggregate caches
  mitigate it without weakening script policy.
- The 500 KiB JS / 150 KiB CSS limits are per emitted asset, not full-route transfer budgets.
- Production provisioning, observability, deployment, and rollback belong to Milestone 25.
- No production deployment or external service mutation occurred.
