# Milestone 21 — Completed

Completed: 2026-08-24

## What Was Built

The guarded AI engine now supports Reception, Sales, Support, Marketing, Analytics,
Billing, Manager, and Knowledge specialists. A deterministic router selects an enabled
branch specialist; its effective tools cannot exceed the immutable server catalog.
Prompt-injection, sanitation, confirmation, tenant scope, fallback, and handover
controls remain one shared execution path.

## Files Created

- `prisma/migrations/20260824120000_ai_agents/migration.sql` — additive persistence.
- `src/features/ai/repositories/agents.repository.ts` and `agents.types.ts` — scoped
  storage and feature-owned contracts.
- `src/features/ai/services/agent-catalog.ts`, `agent-router.ts`, and
  `agents.service.ts` — capability ceilings, selection, DTOs, updates, and local tests.
- `src/app/api/ai/agents/**` — read, update, and deterministic test endpoints.
- `src/features/ai/components/agent-list.tsx` — accessible management surface.
- Unit, integration, component, and E2E test files for the specialist domain.
- `docs/api/ai-agents.md` — endpoint and security contract.

## Files Modified

- `prisma/schema.prisma`, `prisma/seed/ai.ts`, and `prisma/seed.ts` — agent records,
  run attribution, repeatable specialist inventory, and cross-tenant fixture.
- AI engine, tool context, run recorder/repository, validators, hooks, and page — one
  bounded specialist execution path and management tab.
- Audit actions, database change log, demo-data guide, and changelog.

## Tests Completed

| Type | Count | Coverage | Command |
|---|---:|---|---|
| Focused unit/integration/component | 9 | Catalog, routing, validation, capability intersection, tenant isolation, concurrency, prompt ownership, RBAC UI, axe | `npx vitest run ...agents...` |
| Full Vitest | 1,002 | 107 repository test files | `npm test` |
| Focused E2E | 1 | Eight seeded agents, disabled state, billing route, axe | `npx playwright test tests/e2e/agents.spec.ts --project=chromium` |
| Full E2E | 244 | Desktop and mobile regression matrix | `npm run test:e2e` |

TypeScript, ESLint with zero warnings, schema drift, repeat seed, production build,
`git diff --check`, and the high-severity production dependency audit all passed.

## Performance Results

- Production compilation: 33.3 seconds; 65 pages/routes generated.
- Full Playwright matrix: 11.5 minutes, one worker, 244 journeys.
- Deterministic repeat seed: 3.464 seconds for the complete demo dataset.
- New feature files and the shared engine remain below 300 lines.

## Known Limitations

- Local test replies validate routing and safety boundaries, not linguistic quality.
- Marketing is deliberately disabled in the demo to expose inactive-state behavior.
  Enabling it does not send a campaign; delivery remains in Broadcast.
- No external model or production deployment was used, per the project safety rule.
