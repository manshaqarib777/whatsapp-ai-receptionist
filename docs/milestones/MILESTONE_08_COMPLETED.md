# Milestone 8 — Completed

Completed: 2026-08-23
Status: Re-certified after safety, durability, structure, and release-gate repair

## Outcome

The AI engine is implemented as a tenant-scoped, provider-independent turn pipeline.
It classifies intent, builds bounded conversation context, resolves versioned prompts,
executes authorized tools, retrieves cited knowledge, applies safety and cost guards,
and records observable run outcomes.

AI execution is durable. `POST /api/ai/runs` accepts only an already-persisted inbound
customer-message id. A unique database job makes repeated enqueue requests idempotent;
the worker claims jobs atomically, retries failures up to the recorded limit, reclaims
stale work, and uses the job UUID as the run UUID. If a worker crashes after persisting
the run but before acknowledging the job, the next worker links that run without a
second provider invocation. Raw customer text is never copied into the queue payload.

## Structural Result

- API handlers validate and authorize; repositories own scoped persistence; the worker
  owns background orchestration.
- System-wide tenant discovery and atomic claims remain isolated in the explicit
  database-system repository.
- `ai-engine.service.ts` is 294 lines after run recording and tool-context resolution
  were extracted into focused services.
- Both run listing and job status are real API surfaces; the UI no longer targets an
  absent GET handler.

## Safety Result

- Human-owned/escalated conversations suppress provider replies.
- Prompt-injection and hard-escalation signals are withheld from the provider.
- Tools are restricted by a code-owned allow-list and server-derived tenant scope.
- Unsupported knowledge answers refuse instead of inventing; supported answers retain
  real chunk citations.
- Provider execution is timed, retried three times, and escalates on exhaustion.
- Output removes prompt leaks, internal UUIDs, arbitrary URLs, and excess length.
- Per-turn token/cost ceilings fail closed to human handling.

## Evidence

| Gate | Result |
|---|---|
| TypeScript | Pass |
| ESLint | Pass, zero warnings |
| AI unit/integration/component/evaluation tests | 39/39 pass |
| Schema drift | Pass; documented unmanaged indexes only |
| Production build | Pass; 55 static pages |
| AI Playwright E2E | 6/6 desktop/mobile, including queue → worker → run log and axe |

## Completion Checklist

- [x] Intent detection and confidence
- [x] Windowed memory and conversation context
- [x] Versioned prompt templates
- [x] Authorized tool calling and confirmation-gated writes
- [x] Hallucination refusal, fallback, escalation, and citations
- [x] Run telemetry: model, tokens, cost, latency, intent, confidence, outcome
- [x] Durable, idempotent, PII-minimizing background execution
- [x] Tenant isolation and crash-resume coverage
- [x] Responsive/accessible UI and production E2E
- [x] Build, static, database, and documentation gates
