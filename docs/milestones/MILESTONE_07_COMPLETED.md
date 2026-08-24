# Milestone 7 — Completed

> **Authoritative structural re-certification — 2026-08-23:** The sequential review
> found that automatic redirect following could bypass the website SSRF guard and that
> approval/current-version promotion contradicted AD-4's atomicity promise. Redirects
> are now followed manually with protocol and public-host validation on every hop, a
> five-hop ceiling, and a streaming 2 MB byte cap. Approval and promotion now execute
> in one scoped transaction. Ingestion orchestration was extracted, bringing the main
> service to 293 lines. Current evidence: knowledge tests 53/53, E2E 10/10 across
> desktop/mobile, typecheck/lint clean, successful production build, drift guard clean.

Completed: 2026-08-13
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 7`

---

## What Was Built

The Knowledge Base at `/knowledge`: upload PDF/DOCX/CSV documents, enter FAQs, and
ingest websites; parse, OCR when needed, chunk, embed, and index them in a
DB-backed worker; and search them. Documents go through a versioned,
approval-gated lifecycle — an unapproved document can never be cited. A retrieval
layer feeds the Milestone-8 AI Engine. Notion + Google Docs are explicitly
deferred (no OAuth credentials); the schema's `configRef` seam is documented.

Against the plan's objective, all of the following are now true and were not before:

- **A real knowledge base at `/knowledge`** — sources + documents on one tab,
  search on another, each view server-scoped, loading and failing independently,
  rendered from real seeded data.
- **Uploads (PDF/DOCX/CSV) are stored, parsed, OCR'd, chunked, embedded, and
  indexed by a DB-backed worker** — no LLM or external queue required. The
  database IS the queue (`ingestion_jobs`), atomically claimed with
  `FOR UPDATE SKIP LOCKED`; the worker runs via `npm run knowledge:work` or a
  docker-compose `worker` service.
- **FAQ entries and website fetches ingest through the same pipeline.** FAQs embed
  synchronously (small); websites are fetched by the worker behind an SSRF guard
  (http(s)-only, private/loopback range blocking, 2 MB cap).
- **Documents are versioned.** A new upload creates a new `draft` version; only an
  **approved** version becomes "current" and retrievable. The approval workflow is
  `draft → pending_approval → approved (admin/owner) / archived`, enforced by the
  `knowledge:approve` permission.
- **Vector search (HNSW) and keyword search return only approved-version chunks**,
  scoped to the org + branch. The raw-SQL similarity search self-scopes with an
  explicit `organization_id` + `branch_id` + current-approved-version join — the
  mandated seam (`src/lib/db/scoped-prisma.ts:39`) — with an integration test
  asserting org A never retrieves org B.
- **`ingestion_jobs` tracks queued/running/succeeded/failed with errors and
  progress**, polled by the UI.
- **Embeddings via a real AI Gateway** (`src/lib/ai-gateway.ts`): OpenAI
  `text-embedding-3-small` when `OPENAI_API_KEY` is set, else a deterministic
  local hash embedder so tests, CI, and the seed need no key. `embeddingModel` is
  recorded per chunk, so a provider switch is a re-embedding job, not a redesign.
- **Typecheck, lint, unit/integration, E2E, and build all pass**, and axe audits
  the knowledge pages clean in both themes, both directions, at desktop and mobile.

### Scope changes

None. The plan's scope guard held: Notion + Google Docs (external OAuth) are
deferred with the `configRef` seam documented, and the retrieval endpoint returns
chunks only — no LLM answers or citations (Milestone 8).

### Bugs the test suite found in the implementation

The exit-gate E2E run surfaced **four pre-existing Milestone-6 inbox bugs** — none
of them visible in the build, typecheck, or unit/integration suites, which is why
the M6 close didn't catch them:

1. **The conversation list crashed with `lastMessageAt.toISOString is not a
   function`** on every live render. The repository types declare `Date`, but the
   API serialises dates to ISO strings; `ConversationRow` and `MessageBubble`
   called date methods on them. Fixed by rehydrating the Date fields in the inbox
   hooks after fetch. (The component tests mocked Date-valued rows, so they never
   exercised the wire shape.)
2. **The thread view showed an error boundary — `useThread` polled
   `GET /api/inbox/conversations/[id]`, but that route only implemented `PATCH`.**
   The GET handler now returns the full thread (conversation, messages, notes,
   summary, suggestions, typing). This is why every thread interaction — open,
   reply, archive, search — failed in E2E.
3. **The thread's label list crashed with `(j.data ?? []).map is not a
   function`** — `GET /api/inbox/labels` returns `{ labels }` but `useLabels`
   treated the response as a bare array.
4. **The inbox filter tabs emitted `aria-controls` to panels that did not exist**,
   which axe flagged as a critical `aria-valid-attr-value` violation. Each tab now
   has a real (visually hidden) panel.

Plus two stale E2E assertions that no longer matched the product's actual
behaviour: the list preview shows the newest message (the spec expected the older
inbound text), and opening a thread marks it read, which legitimately replaces the
"Reply now" suggestion with "Mark resolved".

Each app-side fix is covered by the inbox unit/integration suites and the E2E
suite; the full suite now passes 152 E2E tests (76 × chromium + mobile), up from
138 before the fixes.

---

## Files Created

| Path | Purpose |
|---|---|
| `prisma/migrations/20260812185009_knowledge/migration.sql` | Enum values, file metadata, job links, trgm index, HNSW recreate. |
| `src/lib/ai-gateway.ts` | Embedding provider interface + OpenAI + local hash fallback (AD-2). |
| `src/features/knowledge/repositories/knowledge.repository.ts` | The only knowledge DB access; every query scoped via `forScope`. |
| `src/features/knowledge/services/knowledge.service.ts` | Pure orchestration: sources, versions, approval, ingestion pipeline, search. |
| `src/features/knowledge/services/chunker.ts` | ~800-token overlapping chunker with paragraph awareness + checksum. |
| `src/features/knowledge/services/parsers.ts` | pdf/docx/csv/website extraction + SSRF guard. |
| `src/features/knowledge/services/ocr.ts` | tesseract.js OCR for scanned PDFs (worker-only). |
| `src/features/knowledge/lib/embeddings.ts` | Feature-side embedding seam over the AI Gateway. |
| `src/features/knowledge/lib/retrieval.ts` | Self-scoped raw-SQL similarity + keyword search, chunk writes, job claim. |
| `src/features/knowledge/hooks/use-knowledge.ts` | React Query hooks with job-status polling. |
| `src/features/knowledge/validators/knowledge.validators.ts` | Zod schemas for sources, uploads, search, jobs. |
| `src/features/knowledge/components/` | Source list, document list, add-source dialog, search, job status, version timeline (+ tests). |
| `src/workflows/knowledge-ingestion.worker.ts` | The DB-polled worker loop (AD-3). |
| `scripts/knowledge-worker.ts` | `npm run knowledge:work` entry. |
| `docker/worker.Dockerfile` | Worker container for compose. |
| `src/app/(app)/knowledge/` | `/knowledge`, `/knowledge/sources/[id]`, `/knowledge/documents/[id]` pages. |
| `src/app/api/knowledge/` | All AD-8 routes. |
| `prisma/seed/knowledge.ts` | Deterministic knowledge seed (approved FAQ + policy, gated draft, cross-tenant beacon). |
| `docs/api/knowledge.md` | API reference. |

## Files Modified

| Path | Change |
|---|---|
| `prisma/schema.prisma` | File metadata, chunkCount/checksum, job links (committed with the migration). |
| `scripts/check-schema-drift.ts` | Whitelist the trgm + HNSW indexes. |
| `src/lib/env.ts`, `.env.example` | `OPENAI_API_KEY?`, `EMBEDDING_PROVIDER` (default `local`), `EMBEDDING_MODEL`. |
| `package.json`, `package-lock.json` | `openai`, `pdf-parse`, `mammoth`, `csv-parse`, `node-html-parser`, `tesseract.js`; `knowledge:work` script. |
| `docker/docker-compose.yml` | `worker` service. |
| `prisma/seed.ts` | Knowledge seed wired in. |
| `src/features/auth/permissions.ts` (+ tests) | `knowledge:read/write/approve` matrix. |
| `src/components/sidebar-nav.tsx`, `src/features/auth/navigation.ts` | Knowledge nav item (book-open icon). |
| `src/app/api/inbox/conversations/[id]/route.ts` | **Added `GET`** — the missing thread endpoint (Issue 1 in the bugs section). |
| `src/features/inbox/hooks/use-inbox.ts` | Rehydrate Date fields; `useLabels` reads `{ labels }`. |
| `src/features/inbox/components/conversation-list.tsx` | Hidden tab panels (axe). |
| `tests/e2e/inbox.spec.ts`, `tests/e2e/dashboard.spec.ts` | Stale assertions corrected (preview = newest message; mark-read changes suggestions; exact-match selectors). |
| `.claude/CHANGELOG.md` | Milestone 7 entry. |

---

## Tests Completed

| Type | Count | Coverage | Command |
|---|---|---|---|
| Unit (knowledge) | 31 | embeddings determinism, parsers (pdf/docx/csv/website/faq), chunker size/overlap/paragraph, service lifecycle | `npm run test` |
| Component (knowledge) | 10 | each view: loading/error/empty/populated, axe-clean | `npm run test` |
| Integration (knowledge) | 13 | real Postgres + pgvector: source CRUD, claim→parse→chunk→embed→draft, approval sets current, **org A never retrieves org B**, job success/failure + progress, archive | `npm run test` |
| **Vitest total** | **633 passing, 53 files** | — | `npm run test` |
| E2E (knowledge) | 5 × 2 projects | seeded render, approval-gated search, FAQ gate, axe clean, no mobile overflow | `npm run test:e2e` |
| **E2E total** | **152 passing** (76 × chromium + mobile) | — | `npm run test:e2e` |

Gate at close: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run
test:e2e`, `npm run build`, and `npm run db:check-drift` all pass. axe audits
`/knowledge` in both themes, both directions, at desktop and mobile with zero
violations.

### What the integration tests assert

Source CRUD and document counts; the upload → job → version pipeline driven
directly (claim → parse → chunk → embed → mark) without faking timers; the
approval transition pointing `currentVersionId` at the approved version; retrieval
returning only approved current-version chunks (a draft HR handbook in the seed is
never retrieved); similarity + keyword search; job success/failure with progress;
version archiving; and — the non-negotiable — org A never retrieves org B's chunks,
with the raw-SQL search self-scoping on every branch.

### Deliberately not covered

- **OpenAI live embeddings.** The suite runs on the local hash embedder by design
  (no key in CI). The OpenAI path is exercised only by the unit-tested provider
  seam and would need a key to verify end-to-end.
- **OCR correctness on real scans.** `ocr.ts` is covered by construction (the
  worker path) and the parser tests assert the text-layer-empty → needsOcr signal,
  but no fixture scan is OCR'd in CI (tesseract downloads models on first use).
- **Notion / Google Docs ingestion** — explicitly deferred.

---

## Performance

The worker is a separate process, so large PDFs and OCR run outside the request
path (plan R-4). Chunking bounds memory to ~800-token pieces; the website fetch is
capped at 2 MB. Retrieval runs through the HNSW index (`idx_knowledge_chunks_embedding_hnsw`)
for similarity and the trigram GIN index (`idx_knowledge_chunks_content_trgm`) for
keyword, both hand-written in the migration. No `EXPLAIN ANALYZE` was taken: the
seed volume is small, and the plan's R-3-style evidence requirement applies to a
raw-SQL rewrite under real load, which is not this milestone.

---

## Known Limitations

1. **Embeddings are local-hash by default.** Vectors are deterministic but not
   semantically meaningful; live ingestion needs `EMBEDDING_PROVIDER=openai` +
   `OPENAI_API_KEY`. The `embeddingModel` column means a switch is a re-embedding
   job, not a redesign.
2. **The worker only runs when started** (`npm run knowledge:work` or the compose
   `worker` service). A stopped worker leaves jobs visibly `queued` in the UI —
   there is no auto-start. Documented in the runbook/plan (R-2).
3. **Website sources record the URL as the document title** — the schema has no
   URL column on a source; a real column lands with website source management in a
   later milestone.
4. **Retrieval is org-scoped, not branch-scoped** — by design (AD-1). Branch
   selection is Milestone 18; `resolveScope` already returns `branchId: null`, so
   the switch is a one-line change per surface.
5. **No LLM answers or citations yet** — the retrieval endpoint returns chunks;
   Milestone 8 wires `AiRunCitation` and the answer engine.

---

## Exit Criteria

- [x] Every task in `PROGRESS.md` checked
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero errors, zero warnings
- [x] Unit, integration, component, and E2E tests exist and pass — 633 + 152
- [x] `npm run build` succeeds
- [x] `npm run db:check-drift` — green (only the documented HNSW/trgm drift)
- [x] axe audits `/knowledge` clean in both themes, both directions, desktop + mobile
- [x] Docs updated — `CHANGELOG.md`, `docs/api/knowledge.md`, `schema-change.md`,
      `PROGRESS.md`, this file
- [x] `MILESTONE_07_COMPLETED.md` written

All met.
