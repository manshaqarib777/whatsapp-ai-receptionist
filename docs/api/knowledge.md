# Knowledge Base API

Milestone 7. All routes are wrapped in `withApiHandler` (correlation id, structured
logging, consistent envelope), require an authenticated session with an active
organization, and validate request bodies with Zod. Errors return the standard
`{ error: { code, message, details? } }` envelope.

Tenant scope always comes from the session — never from a request parameter. The
vector similarity search is hand-written SQL that self-scopes (`organization_id` +
`branch_id`) and joins only to **approved current versions**, so an unapproved
document can never be retrieved.

Permissions (`knowledge:read` / `knowledge:write` / `knowledge:approve`):

| Role | read | write | approve |
|---|---|---|---|
| owner | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ |
| member | ✓ | ✓ | — |
| viewer | ✓ | — | — |

## Sources

### `GET /api/knowledge/sources`

Lists the org's knowledge sources.

Response: `{ data: { sources: KnowledgeSourceRow[] } }` — `{ id, kind, name,
documentCount, createdAt }`.

### `POST /api/knowledge/sources`

Creates a source. Requires `knowledge:write`. Body:

```json
{ "kind": "pdf" | "docx" | "csv" | "website" | "faq", "name": "…" }
```

- `website` also takes `url` — the URL becomes the document title and the worker
  fetches it.
- `faq` also takes `entries: [{ question, answer }]` — ingested synchronously
  (small, embedded immediately, no job).
- `pdf`/`docx`/`csv` create the source shell only; the document + job follow via
  the upload route.

Response (201): `{ data: { source, documentId?, versionId?, jobId? } }`. FAQ and
website sources return a ready document; upload sources return the shell.

### `GET /api/knowledge/sources/[id]`

A source with its documents.

Response: `{ data: { source: { id, kind, name, createdAt, documents } } }`.

### `POST /api/knowledge/sources/[id]/documents`

Uploads a PDF/DOCX/CSV against a source. Requires `knowledge:write`.
`multipart/form-data` with a `file` part and a `title` field.

The blob is stored via `src/lib/storage.ts` (signed URL, path-traversal-safe);
the document + a `draft` version row are created; a `queued` ingestion job is
enqueued.

Response (202): `{ data: { documentId, versionId, jobId } }` — poll the job.

## Documents & versions

### `GET /api/knowledge/documents/[id]`

A document with its version timeline.

Response: `{ data: { document } }` — includes `versions` ordered newest first,
each with `status` (`draft` / `pending_approval` / `approved` / `archived`),
`chunkCount`, `checksum`, and approval metadata.

### `POST /api/knowledge/documents/[id]/versions/[versionId]/submit`

Moves a version `draft → pending_approval`. Requires `knowledge:write`.

Response: `{ data: { ok: true } }`.

### `POST /api/knowledge/documents/[id]/versions/[versionId]/approve`

Approves a `pending_approval` version: sets `approvedBy`/`approvedAt` and points
the document's `currentVersionId` at this version — the retrieval gate. Requires
`knowledge:approve` (admin/owner only).

Response: `{ data: { ok: true } }`.

### `POST /api/knowledge/documents/[id]/versions/[versionId]/archive`

Archives a `pending_approval` or `approved` version. A current version stays
current; archiving is explicit. Requires `knowledge:approve`.

Response: `{ data: { ok: true } }`.

## Jobs

### `GET /api/knowledge/jobs/[id]`

Ingestion job status, polled by the UI after an upload.

Response: `{ data: { job } }` — `{ id, sourceId, documentId, versionId, status,
error, progress, createdAt, updatedAt }`. `status` is `queued` / `running` /
`succeeded` / `failed`; a failed job carries its error message.

## Search

### `GET /api/knowledge/search?q=&limit=`

Hybrid retrieval over approved current-version chunks only: cosine similarity over
the HNSW index (via the configured embedding provider), then keyword ILIKE
fallback, merged and deduplicated.

Query params: `q` (required, ≤500 chars), `limit` (1–50, default 10).

Response: `{ data: { hits: [{ chunkId, content, similarity, sourceName,
documentTitle }] } }`. `similarity` is 0 for keyword-only matches.
