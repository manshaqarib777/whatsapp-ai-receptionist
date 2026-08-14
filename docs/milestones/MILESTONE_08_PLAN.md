# Milestone 8 — AI Engine

Created: 2026-08-13
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 8`
Status: Draft for approval

---

## Objective

Build the AI Engine that powers the WhatsApp receptionist: intent detection,
classification, memory, conversation context, prompt templates, tool calling,
hallucination detection, confidence scoring, fallback, and citations. The M6
heuristic suggestions and M7 knowledge retrieval are replaced behind the same UI
seams by a real (provider-backed, but locally testable) engine. Every AI turn is
recorded in `ai_runs` with model, tokens, cost, latency, outcome, and citations.

True after this milestone, and not true now:

- An inbound message is classified (intent + confidence) through the AI Gateway,
  with the M6 heuristic summary/suggestions replaced by the engine's output.
- Prompt templates are versioned, org-scoped, editable, and activated
  (`prompt_templates` / `prompt_template_versions`).
- The engine can call tools (knowledge lookup, check availability, book, escalate)
  with server-side authorization per `AI_ENGINE_RULES.md` — code, not prompt.
- Conversation memory is windowed + summarised per `AI_ENGINE_RULES.md` — never
  the full history.
- Hallucination guard: if retrieval finds no supporting chunk, the answer is
  refused/held rather than invented, and the run outcome records it.
- Citations are written to `ai_run_citations` when the knowledge base supports an
  answer.
- Every turn records an `AiRun` row (model, tokens, cost, latency, outcome,
  intent, confidence) and surfaces in a run log.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` +
`npm run test:e2e` pass; `npm run build` succeeds; axe clean on the new AI pages.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 8`:

```
AI Engine

Intent Detection

Classification

Memory

Conversation Context

Prompt Templates

Tool Calling

Hallucination Detection

Confidence Score

Fallback

Citation

STOP
```

---

## Architecture Decisions

### AD-1 — `src/features/ai/` feature domain, mirroring inbox/knowledge

```
src/features/ai/
  repositories/ai.repository.ts        # only DB access; forScope everywhere
  services/ai-engine.service.ts        # turn orchestration: classify → context → tools → answer
  services/classifier.ts               # intent detection + confidence (rule + provider seam)
  services/memory.ts                   # window + summary (persisted, tenant/conversation-scoped)
  services/prompts.ts                  # versioned template resolution + rendering
  services/tools/                      # tool registry: knowledge, availability, book, escalate
    registry.ts
    knowledge.tool.ts
    book-appointment.tool.ts           # write tool — confirmation-gated
    escalate.tool.ts
  validators/ai.validators.ts          # zod schemas
  components/                          # AI run log, prompt editor, confidence meter
  tests/ai.integration.test.ts         # real Postgres
  lib/                                # gateway helper, cost model
```

The engine is a service that takes a `MessageRow` + conversation context and
returns a structured `TurnResult` (intent, confidence, reply text, citations,
outcome). It is **deterministic and testable without a live LLM**: the classifier
and summariser run through the same `AI_GATEWAY` seam with a local rule-based
provider for tests (mirroring M7's local embeddings).

### AD-2 — The provider seam

`src/lib/ai-gateway.ts` grows an `LLMProvider` interface:

```ts
export interface LLMProvider {
  classify(input: { text: string; labels: string[] }): Promise<{ label: string; confidence: number }>;
  summarize(input: { turns: string[] }): Promise<string>;
  draftReply(input: { context: string; promptVersion: string }): Promise<string>;
}
export function llmProvider(): LLMProvider;
```

- `local` (default) — deterministic rule-based classifier + template summariser,
  unit-testable, no key.
- `openai` — chat completions via the OpenAI SDK when `OPENAI_API_KEY` is set and
  `LLM_PROVIDER=openai`.
- Provider/model strings follow `AI_ENGINE_RULES.md`: `anthropic/claude-haiku-4-5`
  for classification, `anthropic/claude-sonnet-5` for replies (config, not
  hardcoded at call sites).

### AD-3 — Tool calling, authorized in code

`AI_ENGINE_RULES.md` Tool Rules: every tool has a Zod schema, server-side
authorization independent of the model, tenant scoping from the session, and
idempotency. M8 implements:

- `knowledge.lookup` — hybrid retrieval (M7), returns top chunks with citations.
- `availability.slots` — read tool over M9's service (the schema already exists;
  this milestone provides the read path the engine uses; full M9 booking UI is
  the next milestone).
- `appointment.book` — **write tool**, confirmation-gated: returns a proposed
  booking, the engine must confirm before the service commits.
- `escalate.human` — write tool, sets conversation to human handover.

Authorization: tools resolve `can(permission)` from the session scope; a tool the
model is not permitted to call returns a typed refusal.

### AD-4 — Hallucination guard + confidence + fallback

- If `knowledge.lookup` returns no chunk above the similarity threshold, the
  engine must not answer from thin air: outcome `refused`, reply asks for
  clarification or offers escalation (per `AI_ENGINE_RULES.md` → Guardrails).
- Confidence below a threshold → `escalated` outcome and human handover.
- Fallback: model failure → holding message + `failed` outcome recorded, human
  notified.
- Output validation: strip anything that looks like a system-prompt leak, an
  internal id, or a non-allowlisted URL.

### AD-5 — Memory

Window the last N turns + a persisted summary (`conversation_summaries`, model
`ai-engine`). Summarisation is a separate call, persisted, not recomputed per
turn. Never the full history; never another contact's data.

### AD-6 — Prompt templates

`prompt_templates` (key + name, branch-scoped) with versioned bodies
(`prompt_template_versions`, status draft/active/archived). Seeded with the
receptionist system prompt, booking prompt, and FAQ prompt. The engine resolves
`currentVersionId`; a template edit creates a draft version and must be activated
to take effect. Template CRUD is admin/owner-only (`ai:manage`).

### AD-7 — Permissions

`src/features/auth/permissions.ts` gains:

| Permission | owner | admin | member | viewer |
|---|---|---|---|---|
| `ai:read` (run log, templates read) | ✓ | ✓ | ✓ | ✓ |
| `ai:manage` (template CRUD, activate) | ✓ | ✓ | — | — |
| `ai:run` (trigger engine turns) | ✓ | ✓ | ✓ | — |

### AD-8 — API routes (all `withApiHandler` + `requireOrg`/`requirePermission`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/ai/runs?conversationId=` | `ai:read` | Run log for a conversation (or recent org-wide) |
| `GET /api/ai/templates` | `ai:read` | List templates |
| `POST /api/ai/templates` | `ai:manage` | Create template + draft version |
| `GET /api/ai/templates/[id]` | `ai:read` | Template + versions |
| `POST /api/ai/templates/[id]/versions` | `ai:manage` | Add a draft version |
| `POST /api/ai/templates/[id]/versions/[versionId]/activate` | `ai:manage` | Set currentVersionId |
| `POST /api/ai/runs` | `ai:run` | Run a turn (message + conversation) — the engine entry |

---

## Dependencies

**New packages**: `openai` (already present for embeddings — the LLM provider
reuses it). No other new runtime deps.

**Upstream**: 6 (inbox conversation model, summaries), 7 (knowledge retrieval,
gateway). **External**: OpenAI API key (optional — local provider covers
tests/CI).

---

## Database Impact

No migration needed — the M4 schema already has `prompt_templates`,
`prompt_template_versions`, `ai_runs`, `ai_run_citations`, and
`conversation_summaries` carries a `model` column for the AI-engine summary.

**Seed**: `prisma/seed/ai.ts` adds a system/booking/FAQ prompt template (active
versions) and a couple of `ai_runs` from the demo conversation so the run log
renders.

**Rollback**: no production data; `prisma migrate reset` + `db:deploy`.

---

## API Impact

See AD-8. New `/api/ai/*` routes only. The inbox keeps its heuristic seam — the
engine becomes the provider behind it when configured.

---

## UI Impact

- `src/app/(app)/ai/` — templates list + editor (`/ai/templates`), and a run log
  view. Nav item "AI".
- Components: `template-list.tsx`, `template-editor.tsx`, `version-timeline.tsx`,
  `run-log.tsx`, `confidence-meter.tsx`, `ai-error.tsx`.
- Reuse: `DataTable`, `Badge`, `Button`, `Dialog`, `Tabs`, `EmptyState`/
  `ErrorState`/`LoadingState`, `Markdown`, `PageHeader`.
- States: per-view loading skeleton, per-view `ErrorState` with retry,
  `EmptyState`, populated. Keyboard-reachable rows; template editor labelled;
  axe-clean.

---

## AI Impact

The full engine turn is the AI surface: classification (haiku-class model),
reply drafting (sonnet-class model), summarisation (cheap model), tool calls
(registry), citations (`ai_run_citations`), and per-turn observability
(`ai_runs` with tokens/cost/latency/outcome). `AI_ENGINE_RULES.md` is honored:
provider/model strings, no hardcoded SDK at call sites, prompts versioned,
memory windowed, write tools confirmation-gated, token/cost ceilings enforced.

---

## Security Considerations

| Area | Consideration |
|---|---|
| Tenant isolation | Every query through `forScope`; tools scope from session, never args |
| Authorization | `ai:read/manage/run` enforced server-side; write tools confirm |
| Prompt injection | Message content is data, never instructions; system prompt states it; injection attempts logged |
| PII | Never log raw customer content in AI traces — reference message ids |
| Secrets | `OPENAI_API_KEY` optional, only read in `src/lib/env.ts` |
| Cost | Per-turn token/cost ceiling; exceeding it escalates rather than truncating |

---

## Testing Strategy

- **Unit**: classifier (rule provider determinism + confidence), memory windowing
  + summary persistence, prompt resolution/rendering, tool registry authorization,
  hallucination guard (no chunk → refused), output sanitizer.
- **Integration** (real Postgres): template CRUD + activate sets currentVersionId,
  run records `ai_runs` row with outcome/intent/confidence, citations written for
  retrieval-backed answers, escalation on low confidence, org A never sees org B's
  runs/templates.
- **Component**: template list/editor/run log states, axe-clean.
- **E2E**: seeded templates render; run log renders after a turn; axe audits the
  AI pages.
- **Seed**: prompt templates + demo runs.

**Exit gate**: typecheck (0), lint (0), `npm run test`, `npm run test:e2e`,
`npm run build`, drift check green, axe-clean AI pages, docs + `CHANGELOG.md`
updated, `MILESTONE_08_COMPLETED.md` written.

---

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Provider key absent → no real LLM in demo | Medium | Medium | Local provider is the default; the seam is unit-tested; `embeddingModel`-style recording |
| R-2 | Tool-calling loop unbounded | Medium | High | Max iterations per turn, enforced in the engine |
| R-3 | Hallucinated answers | Medium | High | Retrieval-gated answering + confidence threshold + refusal outcome |
| R-4 | Cost blowout | Medium | Medium | Per-turn and per-conversation token ceilings; escalated not truncated |
| R-5 | Scope creep into M9 (full booking UI) | High | Medium | Availability/book tools are read/proposal only; the M9 UI is the next milestone |
