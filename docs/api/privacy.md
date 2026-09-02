# Privacy API

All routes require an authenticated active organization and `settings:update`
(owner/admin). Scope comes from the database-backed session, never request data.
Responses use the standard correlation envelope and authenticated durable rate limits
protect processing.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/privacy/requests` | List up to 100 request lifecycle records. |
| POST | `/api/privacy/requests` | Create `{ contactId, type: "access" | "erasure" }`. |
| POST | `/api/privacy/requests/:id/process` | Complete a pending request with optimistic `version`. |

An erasure process body must include the exact confirmation `ERASE CONTACT`. It invokes
the transactional redaction registry and returns row counts. An access process returns
a bounded JSON export directly to the authorized caller; the payload is not persisted
in the privacy request or audit log. Cross-tenant ids return 404, stale/already-complete
requests return 409, and equivalent pending requests are rejected.

Audit actions are `privacy.requested`, `privacy.exported`, and `privacy.erased`. Metadata
contains only request type and ids—never contact names, numbers, email, or content.
