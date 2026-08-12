# Milestone 6 — Progress

Status: **Complete — see `MILESTONE_06_COMPLETED.md`**
Started: 2026-08-12
Last updated: 2026-08-12

Plan: `MILESTONE_06_PLAN.md` (approved 2026-08-12).

## Completed Tasks

- [x] `MILESTONE_06_PLAN.md` written and approved
- [x] Migration: `ConversationRead`, `conversation_typing`, `Message.readAt`, `pg_trgm`
      GIN index, `ConversationSummary`, `ActivityKind` extension
- [x] `src/features/inbox/repositories/inbox.repository.ts` + service
- [x] `src/features/inbox/hooks/use-inbox.ts` + validators
- [x] Inbox API routes (list, thread, messages, send, read, typing, archive, labels,
      search, attachments)
- [x] Inbox components (list, thread, composer, labels, assignment, filters, search,
      attachments, voice, emoji, pinned, archive, AI suggestions, summary)
- [x] `/inbox` and `/inbox/[id]` pages rebuilt
- [x] Integration + unit tests
- [x] Component tests (axe-clean)
- [x] E2E `tests/e2e/inbox.spec.ts` (update stale dashboard doorway assertions)
- [x] Docs: `CHANGELOG.md`, `docs/api/inbox.md`, schema-change entry
- [x] `MILESTONE_06_COMPLETED.md`
- [x] Exit gate: typecheck, lint, unit/integration, E2E, and build all pass

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Scoped-client `upsert` refused on `markRead`/`setTyping` | Fixed | Check-then-update/create (integration tests caught it at runtime) |
| 2 | `Label` create throws under org-level scope (branch-scoped model) | Fixed | Resolve default branch + branch-scoped client for that one create |
| 3 | Radix Tabs `aria-controls` axe false positive in jsdom | Fixed | Tabs audit moved to E2E (real browser) |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-12 | Heuristic AI suggestions + summary (no LLM) | AI Engine is M8; heuristic UI-only keeps scope | LLM via gateway; defer entirely |
| 2026-08-12 | React Query polling for real-time | Zero infra, survives `next start`/Vercel, provider already wired | SSE, WebSockets |
| 2026-08-12 | All 15 PRD features in scope | Faithful to PRD | Core subset |

## Database Changes

| Migration | Description | Applied to |
|---|---|---|
| `20260812092315_inbox` | Read receipts, typing, summary, readAt, trgm, ActivityKind | local |

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `/api/inbox/*` (13 routes) | New | No |
| `/api/storage/[token]` | New | No |

## Breaking Changes

None.
