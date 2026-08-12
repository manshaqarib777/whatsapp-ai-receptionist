# Milestone 7 — Progress

Status: In Progress
Started: 2026-08-12
Last updated: 2026-08-12

Plan: `MILESTONE_07_PLAN.md` (approved 2026-08-12).

## Completed Tasks

- [x] `MILESTONE_07_PLAN.md` written and approved

## Pending Tasks

- [ ] Migration: source-kind enum values (pdf/docx/csv), document file fields,
      version chunkCount/checksum, job progress/documentId/versionId, trgm on chunks
- [ ] `src/lib/ai-gateway.ts` + env additions (OPENAI_API_KEY, EMBEDDING_PROVIDER,
      EMBEDDING_MODEL)
- [ ] `src/features/knowledge/` — repository, service, chunker, parsers, ocr, hooks,
      validators, retrieval, components
- [ ] `src/workflows/knowledge-ingestion.worker.ts` + `npm run knowledge:work` +
      docker-compose worker service
- [ ] `knowledge:*` permissions
- [ ] Knowledge API routes (sources, documents, versions, jobs, search)
- [ ] `/knowledge` + `/knowledge/documents/[id]` pages
- [ ] Integration, unit, component, E2E tests + seed knowledge rows
- [ ] Docs: `CHANGELOG.md`, `docs/api/knowledge.md`, schema-change entry
- [ ] `MILESTONE_07_COMPLETED.md` — only after all exit criteria pass
- [ ] Exit gate: typecheck, lint, unit/integration, E2E, build, drift check

## Issues

| # | Issue | Status | Resolution |
|---|---|---|---|

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

## API Changes

| Route | Change | Breaking? |
|---|---|---|

## Breaking Changes

None.
