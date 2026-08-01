# API Rules

## Every API Must Have

1. **Request validation** — Zod schema, parsed before any logic runs.
2. **Authentication check** — who is calling.
3. **Authorization check** — may they do this, to this tenant's data.
4. **Error handling** — typed errors mapped to status codes, nothing leaked.
5. **Logging** — structured, with correlation id, no PII.
6. **Documentation** — in `/docs/api/`.
7. **Tests** — happy path, validation failure, auth failure, authz failure, upstream failure.

All seven. No exceptions, including internal and webhook routes.

---

## Controller Shape

Controllers orchestrate. They contain no business logic.

```
Controller
 ↓  validate → authenticate → authorize → call service → map result
Service
 ↓
Repository
 ↓
Database
```

A controller over ~40 lines is doing work that belongs in a service.

---

## Contracts

```
GET    /api/conversations             list, paginated
GET    /api/conversations/:id         single
POST   /api/conversations/:id/messages  send
POST   /api/conversations/:id/escalate  hand off to human
PATCH  /api/settings                  partial update
POST   /api/webhooks/whatsapp         Meta inbound
GET    /api/webhooks/whatsapp         Meta verification challenge
```

- Plural nouns, lowercase, hyphenated. Verbs only for non-CRUD actions.
- `PATCH` for partial, `PUT` for full replacement.
- Versioned when a breaking change is unavoidable: `/api/v2/...`.

---

## Responses

Success:
```json
{ "data": { ... }, "meta": { "cursor": "...", "hasMore": true } }
```

Error:
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human readable, safe to display.",
    "details": [{ "path": "phoneNumber", "message": "Invalid E.164 format" }]
  }
}
```

Never return a raw exception, stack trace, SQL error, or upstream provider payload.

---

## Status Codes

| Code | When |
|---|---|
| 200 | Success |
| 201 | Created |
| 202 | Accepted — queued for async processing |
| 204 | Deleted |
| 400 | Validation failed |
| 401 | Not authenticated |
| 403 | Authenticated but not permitted |
| 404 | Not found, or exists in another tenant (do not distinguish) |
| 409 | Conflict — e.g. double booking |
| 422 | Semantically invalid but well-formed |
| 429 | Rate limited — include `Retry-After` |
| 500 | Unexpected — logged with correlation id |
| 502/504 | Upstream (Meta, model provider) failed or timed out |

A 404 for a cross-tenant id is deliberate: never confirm existence across tenants.

---

## Validation

- Parse, don't validate: `schema.parse(body)` yields the typed value used downstream.
- Validate params, query, body, and headers.
- Reject unknown keys (`.strict()`) on write endpoints.
- Share the schema with the client form. One source of truth.
- Never trust `tenantId`, `role`, `userId`, or price fields from the request body.

---

## Authentication & Authorization

- Session verified server-side on every request. No trusting client state.
- Authorization is a separate, explicit check after authentication: does this user's
  role permit this action on this tenant's resource?
- Deny by default. A new route is unauthorised until it opts in.
- Machine callers use scoped tokens, not user sessions.

---

## Webhooks (WhatsApp / Meta)

Highest-risk surface. Rules:

- **Verify the signature** (`X-Hub-Signature-256`, HMAC-SHA256 over the raw body) before
  parsing. Use the raw body — not the re-serialised JSON. Reject with 401 on mismatch.
- **`GET` verification**: compare `hub.verify_token` in constant time, echo
  `hub.challenge`.
- **Acknowledge fast** — return 200 within ~1s and process asynchronously. Meta retries
  on slow or non-2xx responses.
- **Idempotent** — dedupe on `whatsapp_message_id` via a unique constraint. Retries and
  duplicate deliveries are normal, not exceptional.
- **Always 200 on a well-formed but unprocessable payload**, then log and alert.
  Returning 5xx triggers redelivery storms.
- Never log message bodies or phone numbers in full.

---

## Rate Limiting

- Per tenant and per IP, backed by Redis.
- Stricter limits on send, AI-invoking, and auth endpoints.
- Return 429 with `Retry-After`.
- Respect Meta's own send limits — queue and back off rather than hammering.

---

## Logging & Observability

Log on every request: correlation id, tenant id, route, method, status, duration.

Never log: message bodies, full phone numbers, tokens, API keys, model prompts
containing customer data.

Every AI-invoking route also logs model, token counts, latency, and cost.

---

## Outbound Calls

- Explicit timeout on every call. No unbounded `fetch`.
- Retry with exponential backoff and jitter on 5xx and 429 only — never on 4xx.
- Circuit-break repeated upstream failures; degrade to queueing rather than failing the
  user's action.
- All outbound sends are idempotent, keyed by an internal message id.

---

## Documentation

Every route documented in `/docs/api/` with method, path, auth, request schema,
response schema, error codes, rate limit, and an example. Written **before** the
implementation.
