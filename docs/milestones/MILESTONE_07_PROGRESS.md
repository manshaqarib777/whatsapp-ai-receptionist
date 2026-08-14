# Milestone 7 — Progress

Status: Complete
Started: 2026-08-12
Last updated: 2026-08-13

Plan: `MILESTONE_07_PLAN.md` (approved 2026-08-12).

## Completed Tasks

- [x] `MILESTONE_07_PLAN.md` written and approved
- [x] Migration: source-kind enum values (pdf/docx/csv), document file fields,
      version chunkCount/checksum, job progress/documentId/versionId, trgm on chunks
      (`20260812185009_knowledge`)
- [x] `src/lib/ai-gateway.ts` + env additions (OPENAI_API_KEY, EMBEDDING_PROVIDER,
      EMBEDDING_MODEL)
- [x] `src/features/knowledge/` — repository, service, chunker, parsers, ocr, hooks,
      validators, retrieval, components
- [x] `src/workflows/knowledge-ingestion.worker.ts` + `npm run knowledge:work` +
      docker-compose worker service
- [x] `knowledge:*` permissions
- [x] Knowledge API routes (sources, documents, versions, jobs, search)
- [x] `/knowledge` + `/knowledge/documents/[id]` + `/knowledge/sources/[id]` pages
- [x] Integration, unit, component, E2E tests + seed knowledge rows
- [x] Docs: `CHANGELOG.md`, `docs/api/knowledge.md`, schema-change entry
- [x] Exit gate: typecheck, lint, unit/integration, E2E, build, drift check
- [x] `MILESTONE_07_COMPLETED.md` — written after all exit criteria passed

## Pending Tasks

None. Milestone 7 is complete.

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | E2E inbox/dashboard suite failing (14 tests) at exit gate | Resolved | Pre-existing M6 bugs surfaced by the full-suite run: `ConversationRow` called `.toISOString()` on JSON-string dates; the thread view polled a GET route that only implemented PATCH; the labels hook read the wrong response shape; the filter tabs emitted `aria-controls` to non-existent panels (axe critical); the dashboard→inbox nav and several specs used ambiguous selectors. All fixed with regression coverage; 152 E2E now pass. |
| 2 | Inbox list preview assertion expected the older message | Resolved | The row preview shows the newest message; the spec's list assertion was stale. Updated to assert the actual preview. |

## Technical Decisions

| Date | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| 2026-08-12 | OpenAI embeddings + local hash fallback | 1536-dim schema; tests/seed need no key; gateway seam now | Defer embeddings; OpenAI only |
| 2026-08-12 | Upload/FAQ/Website sources in scope | Notion + Google Docs need OAuth creds that don't exist | All 7 source types |
| 2026-08-12 | DB-polled worker (src/workflows) | ARCHITECTURE_RULES §11; no Redis until M24 | BullMQ, in-request sync, HTTP-triggered |
| 2026-08-12 | OCR + retrieval endpoint, no LLM | M8 wires citations + answers | No OCR; full RAG |

## Database Changes

| Migration | Description | Applied to |
|---|---|---|
| `20260812185009_knowledge` | Source-kind enum values (pdf/docx/csv), document file fields, version chunkCount/checksum, job progress/documentId/versionId, trgm on chunks, HNSW recreated | local + CI |

## API Changes

| Route | Change | Breaking? |
|---|---|---|
| `GET/POST /api/knowledge/sources` | New (AD-8) | No |
| `GET /api/knowledge/sources/[id]` | New | No |
| `POST /api/knowledge/sources/[id]/documents` | New | No |
| `GET /api/knowledge/documents/[id]` | New | No |
| `POST /api/knowledge/documents/[id]/versions/[versionId]/submit` | New | No |
| `POST /api/knowledge/documents/[id]/versions/[versionId]/approve` | New | No |
| `POST /api/knowledge/documents/[id]/versions/[versionId]/archive` | New | No |
| `GET /api/knowledge/jobs/[id]` | New | No |
| `GET /api/knowledge/search` | New | No |
| `GET /api/inbox/conversations/[id]` | **Added** — the thread endpoint was missing (only PATCH existed); `useThread` polled it and every thread view 403'd/errored | No (bug fix) |

## Breaking Changes

None.
