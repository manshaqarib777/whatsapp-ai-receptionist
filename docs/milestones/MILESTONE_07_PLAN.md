# Milestone 7 — Knowledge Base

Created: 2026-08-12
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 7`
Status: **Complete — structurally re-certified 2026-08-23**

---

## Objective

Build the Knowledge Base: upload documents (PDF/DOCX/CSV), enter FAQs, and ingest
websites; parse, OCR when needed, chunk, embed (1536-dim, matching the schema's
`vector(1536)`), and search them. Documents go through a versioned, approval-gated
lifecycle — an unapproved document can never be cited. A retrieval layer feeds the
Milestone-8 AI Engine. Upload/FAQ/Website sources are in scope; Notion + Google Docs
(external OAuth credentials) are explicitly deferred.

True after this milestone, and not true now:

- A knowledge base at `/knowledge`: sources, documents, versions, and a search UI,
  all tenant-scoped, rendered from real data.
- Uploads (PDF/DOCX/CSV) are stored, parsed (OCR for scanned PDFs), chunked,
  embedded, and indexed by a DB-backed worker — no LLM or external queue required.
- FAQ entries and website fetches ingest through the same pipeline.
- Documents are versioned; a new upload creates a new version, and only an
  **approved** version becomes "current" and retrievable.
- Approval workflow: draft → pending_approval → approved (admin/owner) / archived.
- Vector search (HNSW) and keyword search return only approved-version chunks,
  scoped to the org + branch.
- An `ingestion_jobs` table tracks queued/running/succeeded/failed with errors.
- Typecheck, lint, unit/integration/E2E tests, and build all pass; axe audits the
  knowledge pages clean.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` +
`npm run test:e2e` pass; `npm run build` succeeds; axe clean on `/knowledge` in both
themes, both directions, desktop + mobile.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 7`:

```
Knowledge Base

Upload

PDF

DOCX

CSV

Website

FAQ

Notion

Google Docs

OCR

Chunking

Embedding

Search

Versioning

Approval

AI Retrieval

STOP
```

---

## Scope Decisions (from user answers)

- **Embeddings**: OpenAI `text-embedding-3-small` (matches the 1536-dim schema) as
  the wired provider, with a **deterministic local hash embedder** used by tests and
  seed so the suite needs no API key. The AI Gateway seam (`src/lib/ai-gateway.ts`)
  is built now; the real key is only needed for live ingestion.
- **Sources**: Upload (PDF/DOCX/CSV), FAQ (manual entry), Website (fetch + extract).
  Notion + Google Docs explicitly deferred (no OAuth credentials; the schema's
  `configRef` seam is documented). The `knowledge_source_kind` enum gains
  `pdf`/`docx`/`csv` via ALTER TYPE.
- **Ingestion**: a DB-polled worker in `src/workflows/` (mandated by
  `ARCHITECTURE_RULES.md` §11) that atomically claims `queued` IngestionJob rows,
  parses/chunks/embeds, and marks succeeded/failed. Fits the no-Redis-until-M24
  constraint. Integration tests drive the worker's steps directly.
- **OCR + AI Retrieval**: OCR via `tesseract.js` for image/scanned PDFs; a
  retrieval service + API endpoint returning approved-version chunks by similarity
  (self-scoped raw SQL). No LLM calls — M8 wires citations + answers.

---

## Architecture Decisions

### AD-1 — `src/features/knowledge/` feature domain, mirroring inbox/dashboard

```
src/features/knowledge/
  repositories/knowledge.repository.ts   # only DB access; forScope(scope) everywhere
  services/knowledge.service.ts          # pure orchestration; version lifecycle, search
  services/chunker.ts                    # pure text chunker (unit-tested)
  services/parsers.ts                    # pdf/docx/csv/website/faq → extracted text
  services/ocr.ts                        # tesseract.js OCR for image/scanned PDFs
  hooks/use-knowledge.ts                 # React Query hooks
  validators/knowledge.validators.ts     # zod schemas
  components/                            # client components (sources, documents, search)
  lib/embeddings.ts                      # embedding provider interface + local fallback
  lib/retrieval.ts                       # self-scoped $queryRaw similarity search
  tests/knowledge.integration.test.ts    # real Postgres + pgvector
  components/*.test.tsx                  # component tests, axe-clean
```

Repository bound to one tenant scope at construction (`static forOrganization`),
every Prisma query through `forScope(scope)`. **The pgvector similarity search is
raw SQL by necessity** (`KnowledgeChunk.embedding` is `Unsupported`), so it
self-scopes with explicit `organization_id` + `branch_id` + approved-version join —
the documented, mandated seam (`src/lib/db/scoped-prisma.ts:39`), with a test
asserting org A never retrieves org B.

### AD-2 — AI Gateway + embedding provider

`src/lib/ai-gateway.ts` — the first real AI module, per `AI_ENGINE_RULES.md`:

```ts
// provider interface; "provider/model" strings; no hardcoded SDK
export interface EmbeddingProvider {
  embed(texts: string[]): Promise<{ vector: number[]; model: string }[]>;
}
export function embeddingProvider(): EmbeddingProvider;
```

- Default: OpenAI `text-embedding-3-small` (1536-dim, matches schema) when
  `OPENAI_API_KEY` is set.
- Fallback: a deterministic local hash embedder (unit-testable, seed/CI-safe) when
  the key is absent — `EMBEDDING_PROVIDER=local`. The schema's `embeddingModel` +
  `dimensions` columns make a model change a re-embedding job, not a redesign.
- Env additions in `src/lib/env.ts` + `.env.example`: `OPENAI_API_KEY?`,
  `EMBEDDING_PROVIDER` (`openai` | `local`, default `local`), `EMBEDDING_MODEL`
  (default `text-embedding-3-small`).

Rejected: building the full M8 gateway (prompts, tools, cost tracking) — out of
scope; M7 only needs embeddings.

### AD-3 — DB-polled ingestion worker (`src/workflows/`)

`ARCHITECTURE_RULES.md` §11 mandates `src/workflows/` for multi-step, retryable work,
with no Redis until M24. A DB-backed worker:

- `src/workflows/knowledge-ingestion.worker.ts` — the loop: `claimNextJob()` (atomic
  `UPDATE … SET status='running' WHERE id = (SELECT … WHERE status='queued' FOR UPDATE
  SKIP LOCKED)`), then parse → chunk → embed → persist chunks + set version status,
  mark `succeeded`/`failed` with error.
- Run via `npm run knowledge:work` (a `tsx` script) and a docker-compose service
  (`worker`) that runs it against the same Postgres.
- Ingestion steps are exported as plain async functions so the integration test
  drives them directly (claim → process → mark) without faking timers.
- The upload route enqueues a `queued` job and returns `202` + the job id; the UI
  polls `GET /api/knowledge/jobs/[id]` for status.

Rejected: BullMQ (needs Redis — violates M24), in-request sync (fragile/serverless
timeouts), HTTP-triggered advance (needs a cron).

### AD-4 — Version lifecycle + approval

The M4 schema already designed this (`KnowledgeVersionStatus`, `approvedById/At`,
`KnowledgeDocument.currentVersionId` "Null until a version is approved").
M7 implements the transitions in one transaction:

- Upload/ingest → creates a new `KnowledgeDocumentVersion` (status `draft`), chunks
  hang off the version.
- `POST /api/knowledge/documents/[id]/versions/[versionId]/submit` → `pending_approval`.
- `POST /api/knowledge/documents/[id]/versions/[versionId]/approve` (requires
  `knowledge:approve`, admin/owner) → `approved`, sets `approvedBy/At`, and points
  `document.currentVersionId` at this version.
- `POST …/archive` → `archived` (a current version stays current; archiving is
  explicit).

Retrieval joins chunks → version where `version.id = document.currentVersionId` AND
`version.status = 'approved'` — the structural gate that stops an unapproved
document from being cited.

### AD-5 — Parsers, chunking, OCR

`src/features/knowledge/services/parsers.ts` — pure functions mapping `(buffer,
mimeType, fileName) → extractedText`:
- PDF: `pdf-parse` (text layer); if empty → OCR path.
- DOCX: `mammoth` (text extraction).
- CSV: `csv-parse` → formatted text rows.
- Website: `fetch` + `node-html-parser` → readable text (strip nav/scripts).
- FAQ: manual structured entry → text.

`src/features/knowledge/services/chunker.ts` — pure chunker: split extracted text
into ~800-token overlapping chunks with paragraph awareness. Unit-tested.

`src/features/knowledge/services/ocr.ts` — `tesseract.js` for image PDFs; runs
inside the worker, not the request.

Rejected: `pdfjs-dist` (heavier; `pdf-parse` suffices), pulling OCR into the request.

### AD-6 — Retrieval: similarity + keyword, self-scoped

`src/features/knowledge/lib/retrieval.ts`:
- Similarity: `$queryRaw` HNSW cosine search over `knowledge_chunks.embedding`,
  self-scoped (`WHERE organization_id = … AND branch_id = …`), joined to approved
  current versions, returning `content` + `similarity`.
- Keyword: `pg_trgm` ILIKE over `knowledge_chunks.content` (already installed
  project-wide) for hybrid fallback.
- `GET /api/knowledge/search?q=&limit=` returns hits. M8 wires `AiRunCitation`
  (the FK + similarity columns already exist).

### AD-7 — New `knowledge:*` permissions

`src/features/auth/permissions.ts` gains, following the house pattern:

| Permission | owner | admin | member | viewer |
|---|---|---|---|---|
| `knowledge:read` | ✓ | ✓ | ✓ | ✓ |
| `knowledge:write` (upload/ingest/FAQ) | ✓ | ✓ | ✓ | — |
| `knowledge:approve` | ✓ | ✓ | — | — |

Enforced via `requirePermission('knowledge:…')`; unit tests added to
`permissions.test.ts`.

### AD-8 — API routes (all `withApiHandler` + `requireOrg`/`requirePermission`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/knowledge/sources` | `knowledge:read` | List sources |
| `POST /api/knowledge/sources` | `knowledge:write` | Create source (upload/faq/website) |
| `GET /api/knowledge/sources/[id]` | `knowledge:read` | Source + documents |
| `POST /api/knowledge/sources/[id]/documents` | `knowledge:write` | Enqueue an upload document |
| `POST /api/knowledge/faqs` | `knowledge:write` | Create an FAQ source + document |
| `GET /api/knowledge/documents/[id]` | `knowledge:read` | Document + versions |
| `POST /api/knowledge/documents/[id]/versions/[versionId]/submit` | `knowledge:write` | draft → pending_approval |
| `POST /api/knowledge/documents/[id]/versions/[versionId]/approve` | `knowledge:approve` | approve + set current |
| `POST /api/knowledge/documents/[id]/versions/[versionId]/archive` | `knowledge:approve` | archive a version |
| `GET /api/knowledge/jobs/[id]` | `knowledge:read` | Job status (poll) |
| `GET /api/knowledge/search?q=` | `knowledge:read` | Retrieval (similarity + keyword) |

---

## Dependencies

**New packages** (justified): `openai` (embedding client), `pdf-parse`, `mammoth`,
`csv-parse`, `node-html-parser`, `tesseract.js` (OCR), `tsx` already present for
scripts. All parsing/OCR libs are pure Node — no Edge constraints.

**Upstream**: 1, 2, 3, 4 (schema + pgvector), 5 (patterns), 6 (storage + repository
patterns, `src/lib/storage.ts` reuse, `pg_trgm` installed).

**External services**: OpenAI API key (optional — live embedding only; the local
fallback covers tests/seed/CI). Notion + Google Docs OAuth (deferred).

---

## Database Impact

**The M4 schema already designed the knowledge base** — M7's migration is minimal:

| Change | Why |
|---|---|
| `ALTER TYPE knowledge_source_kind ADD VALUE 'pdf'`, `'docx'`, `'csv'` | PRD lists PDF/DOCX/CSV as distinct source kinds |
| `KnowledgeDocument.fileName`, `.mimeType`, `.storageKey`, `.sizeBytes` | Blob reference for uploads (house pattern from `MessageAttachment`); blob never in Postgres |
| `KnowledgeDocumentVersion.chunkCount Int?`, `.checksum String?` | Derived count + content hash for re-ingestion dedupe/change detection |
| `IngestionJob.progress Int?`, `.documentId?`, `.versionId?` | Progress reporting + job → produced document link |

**Hand-written SQL**: the HNSW index is recreated (Prisma diff proposes DROPping it —
the documented maintenance hazard); `pg_trgm` on `knowledge_chunks.content` for
keyword search. Both appended to the migration with maintenance notes; the drift
guard stays green. No new tables — the five M4 tables cover everything.

**Rollback**: no production data; `prisma migrate reset` + `db:deploy` for local/CI.
The ALTER TYPE additions are non-transactional on older PG (17 is fine, per M6).

---

## API Impact

See AD-8. New `/api/knowledge/*` routes only. No breaking changes. The upload route
reuses `src/lib/storage.ts` (returns a signed URL for preview). Retrieval returns
`{ data: { hits: [{ chunkId, content, similarity, sourceName, documentTitle }] } }`.

---

## UI Impact

- `src/app/(app)/knowledge/page.tsx` — sources + documents list, upload/FAQ/website
  forms, job status polling.
- `src/app/(app)/knowledge/documents/[id]/page.tsx` — document detail: versions,
  approval actions, chunk search.
- `src/features/knowledge/components/` — `source-list.tsx`, `upload-form.tsx`,
  `faq-form.tsx`, `document-list.tsx`, `version-timeline.tsx`, `approve-actions.tsx`,
  `knowledge-search.tsx`, `search-results.tsx`, `job-status.tsx`, `knowledge-error.tsx`.

Reuse: `EmptyState`/`ErrorState`/`LoadingState`/`Skeleton`, `DataTable`, `Badge`,
`Button`, `Dialog`/`Sheet`, `Markdown`, `Tabs`, sonner `Toaster`, `PageHeader`,
`src/lib/storage.ts`.

**States**: per-view loading skeleton (`role="status"`), per-view `ErrorState` with
retry, `EmptyState` ("No sources yet — upload a document or add an FAQ"), populated.

**Responsive & accessibility**: logical utilities only (RTL); tokens only; lucide
icons; keyboard-reachable rows; upload form labelled; job status `aria-live`;
approval actions keyboard-reachable; axe-clean.

---

## AI Impact

The first real AI module: `src/lib/ai-gateway.ts` (embedding provider interface) +
OpenAI client + local fallback. **No LLM calls, no prompts, no cost tracking** — M8
builds the full engine. Embeddings are the only AI surface. `AI_ENGINE_RULES.md` is
honored: provider/model strings, no hardcoded SDK, `embeddingModel` recorded per
chunk, key optional (local fallback).

---

## Security Considerations

| Area | Consideration |
|---|---|
| Tenant isolation | Every Prisma query through `forScope`; the raw-SQL similarity search self-scopes (`organization_id` + `branch_id` + approved join) with a mandated isolation test. |
| Authorization | `knowledge:read/write/approve` enforced server-side; approval is admin/owner-only. |
| Uploads | Stored via `src/lib/storage.ts` (path-traversal-safe, signed URLs); blob never in Postgres; mime + size validated. |
| Website ingestion | SSRF guard: fetch only http(s), resolve + block private/loopback ranges; never follow to internal hosts. |
| PII | `extractedText`/`content` are customer data — redaction-aware selection; never log raw doc content. |
| OCR | Runs in the worker (Node), never in the browser request. |

---

## Testing Strategy

- **Integration** (real Postgres + pgvector, `src/features/knowledge/tests/`): source
  CRUD, upload → job claim → parse → chunk → embed → version draft, approval
  transition sets currentVersionId, retrieval returns only approved versions, **org
  A never retrieves org B** (the mandated raw-SQL scoping test), job success/failure
  + progress, version archive.
- **Unit**: chunker (size/overlap/paragraph), parsers (pdf/docx/csv/website/faq
  fixtures), local hash embedder determinism, permission matrix additions, retrieval
  SQL builder.
- **Component** (`*.test.tsx`): each view's loading/error/empty/populated; axe-clean
  (E2E covers tabs/jsdom quirks).
- **E2E** (`tests/e2e/knowledge.spec.ts`, both projects): seeded knowledge renders;
  upload → job → version appears; FAQ create; approval flow; search returns results;
  axe audits in both themes. Reuse `openDashboard`-style helpers.
- **Seed**: knowledge rows added to `prisma/seed/` so search demos against real data
  (local hash embeddings — no key needed).

**Exit gate** (per `MILESTONE_RULES.md` §6 + PRD DoD): typecheck (0), lint (0),
`npm run test`, `npm run test:e2e`, `npm run build`, drift check green, axe-clean
knowledge pages, docs + `CHANGELOG.md` updated, `MILESTONE_07_COMPLETED.md` written,
each claim backed by an actually-run command.

---

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Tenant leak in the raw-SQL retrieval | Medium | Critical | Self-scoped query + mandated isolation integration test (org A never retrieves org B) |
| R-2 | Worker never runs in dev (docker-compose service not started) | Medium | Medium | `npm run knowledge:work` script + compose `worker` service + docs; jobs visibly pend in the UI with status |
| R-3 | OpenAI key absent → no real embeddings in demo | Medium | Medium | Local hash embedder is the default; real key only for live ingestion; `embeddingModel` recorded so re-embedding is a job |
| R-4 | Large PDFs/timeouts in the worker | Medium | Medium | Worker is a separate process (no request timeout); chunking bounds memory; OCR optional per file |
| R-5 | Website fetch SSRF | Medium | High | Private/loopback range blocking + http(s)-only + fetch size cap |
| R-6 | Scope creep into M8 (LLM answers, citations) | Medium | Medium | Retrieval endpoint only; `AiRunCitation` write deferred to M8; reviewed against `MILESTONE_RULES.md:19` |

---

## Deliverables Checklist

- [ ] `docs/milestones/MILESTONE_07_PLAN.md` — this plan, committed
- [ ] Migration: source-kind enum values, document file fields, version chunkCount/
      checksum, job progress/documentId/versionId, trgm on chunks
- [ ] `src/lib/ai-gateway.ts` + env additions
- [ ] `src/features/knowledge/` — repository, service, chunker, parsers, ocr, hooks,
      validators, retrieval, components
- [ ] `src/workflows/knowledge-ingestion.worker.ts` + `npm run knowledge:work` +
      docker-compose worker service
- [ ] `knowledge:*` permissions
- [ ] API routes per AD-8
- [ ] `/knowledge` pages rebuilt
- [ ] Integration, unit, component, E2E tests
- [ ] Seed knowledge rows
- [ ] Docs: `CHANGELOG.md`, `docs/api/knowledge.md`, schema-change entry,
      `MILESTONE_07_PROGRESS.md`
- [ ] `MILESTONE_07_COMPLETED.md` — only after all exit criteria pass

---

## 2026-08-23 Sequential Review Amendment

- [x] Revalidate every website redirect target before following it; automatic redirect
      following can otherwise bypass the SSRF guard.
- [x] Make version approval + `currentVersionId` promotion one database transaction,
      as AD-4 promised, and test rollback behavior.
- [x] Split the 357-line knowledge service below the 300-line hard limit.
- [x] Re-run knowledge tests, E2E, drift, static gates, and build.
