# Milestone 8 — Progress

Status: In Progress
Started: 2026-08-13
Last updated: 2026-08-13

Plan: `MILESTONE_08_PLAN.md` (approved 2026-08-13).

## Completed Tasks

- [x] `MILESTONE_08_PLAN.md` written
- [x] `src/lib/llm-gateway.ts` — LLM provider seam (openai + deterministic local)
- [x] `src/lib/env.ts` — `LLM_PROVIDER`, `LLM_CLASSIFY_MODEL`, `LLM_REPLY_MODEL`
- [x] `knowledge:read/write/approve` → added `ai:read/manage/run`,
      `appointment:read/write`, `crm:read/write` permission matrix
- [x] `src/features/ai/` — repository, classifier, memory, prompts, engine service
- [x] Tool registry — knowledge lookup, availability proposal, booking proposal,
      escalation (write tools confirmation-gated)
- [x] API routes — `/api/ai/runs`, `/api/ai/templates`, template versions + activate
- [x] `/ai` page — run log, template list, run-turn test surface
- [x] AI seed — prompt templates (active versions) + demo runs
- [x] Integration tests (7), unit tests (9), E2E (3)
- [ ] Docs: `CHANGELOG.md`, `docs/api/ai.md`, `MILESTONE_08_COMPLETED.md`

## Pending Tasks

- [ ] `docs/api/ai.md`
- [ ] `CHANGELOG.md` entry
- [ ] `MILESTONE_08_COMPLETED.md`
- [ ] Exit gate

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | `AiRun`/`PromptTemplate` are branch-scoped; `resolveScope` (branchId null) refused writes | Resolved | Repository derives a branch scope (`writeScope(branchId)`) for writes — the branch comes from the conversation or the org's default branch, never a request param |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-13 | LLM provider seam mirrors M7's embedding seam | Tests/CI run deterministic local provider; live provider behind `LLM_PROVIDER=openai` | Hardcoding the OpenAI SDK at call sites |
| 2026-08-13 | Engine is read-mostly in M8 (reply not auto-persisted) | The caller (inbox/webhook) decides when to write the reply; keeps the surface testable | Auto-sending from the engine |

## Database Changes

| Migration | Description | Applied to |
|---|---|---|
| None (M4 schema) | — | — |

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `GET/POST /api/ai/runs` | New | No |
| `GET/POST /api/ai/templates` | New | No |
| `GET /api/ai/templates/[id]` | New | No |
| `POST /api/ai/templates/[id]/versions` | New | No |
| `POST /api/ai/templates/[id]/versions/[versionId]/activate` | New | No |

## Breaking Changes

None.
