# Milestone 6 — Progress

Status: In Progress
Started: 2026-08-12
Last updated: 2026-08-12

Plan: `MILESTONE_06_PLAN.md` (approved 2026-08-12).

## Completed Tasks

- [x] `MILESTONE_06_PLAN.md` written and approved

## Pending Tasks

- [ ] Migration: `ConversationRead`, `conversation_typing`, `Message.readAt`, `pg_trgm`
      GIN index, `ConversationSummary`, `ActivityKind` extension
- [ ] `src/features/inbox/repositories/inbox.repository.ts` + service
- [ ] `src/features/inbox/hooks/use-inbox.ts` + validators
- [ ] Inbox API routes (list, thread, messages, send, read, typing, archive, labels,
      search, attachments)
- [ ] Inbox components (list, thread, composer, labels, assignment, filters, search,
      attachments, voice, emoji, pinned, archive, AI suggestions, summary)
- [ ] `/inbox` and `/inbox/[id]` pages rebuilt
- [ ] Integration + unit tests
- [ ] Component tests (axe-clean)
- [ ] E2E `tests/e2e/inbox.spec.ts` (update stale dashboard doorway assertions)
- [ ] Docs: `CHANGELOG.md`, `docs/api/inbox.md`, schema-change entry
- [ ] `MILESTONE_06_COMPLETED.md` — written only after all exit criteria pass
- [ ] Exit gate: typecheck, lint, unit/integration, E2E, build all pass

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-12 | Heuristic AI suggestions + summary (no LLM) | AI Engine is M8; heuristic UI-only keeps scope | LLM via gateway; defer entirely |
| 2026-08-12 | React Query polling for real-time | Zero infra, survives `next start`/Vercel, provider already wired | SSE, WebSockets |
| 2026-08-12 | All 15 PRD features in scope | Faithful to PRD | Core subset |

## Database Changes

| Migration | Description | Applied to |
|---|---|---|

## API Changes

| Route | Change | Breaking? |
|---|---|---|

## Breaking Changes

None.
