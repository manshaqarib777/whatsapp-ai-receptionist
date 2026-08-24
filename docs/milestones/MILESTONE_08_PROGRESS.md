# Milestone 8 — Progress

Status: Complete — re-certified 2026-08-23
Started: 2026-08-13
Completed: 2026-08-23

Plan: `MILESTONE_08_PLAN.md` (approved 2026-08-13).

## Completed Tasks

- [x] Provider gateway with deterministic local and OpenAI implementations
- [x] Intent classification, windowed memory, versioned prompts, and authorized tools
- [x] Retrieval-backed citations, confidence/refusal behavior, and human escalation
- [x] Injection/hard-trigger detection, output sanitation, budgets, timeout, and retry
- [x] Durable `ai_turn_jobs` queue carrying only a persisted inbound message reference
- [x] Idempotent enqueue, bounded attempts, stale-claim recovery, and deterministic run ids
- [x] Tenant-scoped job status API and `npm run ai:work` worker entry point
- [x] Run/template UI, component accessibility coverage, and deterministic safety evals
- [x] API, database, changelog, progress, and completion documentation
- [x] Typecheck, lint, focused tests, schema drift, production build, and M8 E2E gates

## Resolved Issues

| Issue | Resolution |
|---|---|
| Provider exhaustion was recorded as answered | Three bounded attempts now end in `failed` and human escalation. |
| Tool authorization existed only in documentation | Every tool executes through the server-side authorized registry. |
| Citation ids were placeholders | Retrieval carries and persists real tenant-scoped chunk ids. |
| Guardrails and evaluations were incomplete | Injection/hard triggers, sanitation, URL/id filtering, budgets, and deterministic evals are covered. |
| Build downloaded Google Fonts | The application uses packaged local Geist assets and builds offline. |
| API accepted duplicated raw message text | It now accepts only an existing inbound customer-message UUID. |
| AI execution was synchronous and not crash-safe | A DB-polled worker claims jobs atomically and reuses a deterministic run after a crash. |
| Engine orchestration exceeded the 300-line structural target | Run recording and tool-context resolution were extracted; the orchestrator is 294 lines. |
| Run-log hook called an absent GET endpoint | `GET /api/ai/runs` is implemented and covered by the production E2E path. |

## Database Changes

| Migration | Description |
|---|---|
| `20260823133000_ai_turn_jobs` | Adds job status enum, durable AI job table, tenant/branch/message/run relations, unique idempotency keys, and claim indexes. |
| `20260823134500_align_ai_turn_jobs` | Aligns hand-authored defaults and foreign-key update actions with the Prisma schema. |

## Verification

- `npm run typecheck` — pass
- `npm run lint` — pass, zero warnings
- Focused AI Vitest — 39/39 pass
- `npm run db:check-drift` — pass; only documented HNSW/trigram indexes
- `npm run build` — pass; 55 static pages generated
- `npx playwright test tests/e2e/ai.spec.ts` — 6/6 pass across desktop and mobile

The fixture-onboarding notification bell still logs the previously documented
operational “Select an organization to continue” message before an organization is
selected; it does not fail or mask the tested AI behavior.

## Breaking Changes

`POST /api/ai/runs` now requires `{ "inputMessageId": "uuid" }`, returns HTTP 202 with
`{ "job": ... }`, and no longer accepts caller-supplied conversation text. This is an
intentional privacy and durability correction made before a stable external API release.
