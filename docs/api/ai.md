# AI Engine API

Milestone 8. Every route uses `withApiHandler`, derives organization scope from the
database-backed session, validates inputs with strict Zod schemas, and returns the
standard response envelope.

## Safety Contract

- Customer messages are treated as data. Detected instruction-override attempts are
  never sent to the provider and escalate the conversation.
- A human-owned or already-escalated conversation produces no AI reply.
- Tools execute only through a server-side allow-list. The model cannot select tenant
  scope or grant itself a tool.
- Provider calls have a timeout and a maximum of three attempts. Exhaustion records a
  failed run, returns a holding response, and escalates to a human.
- Replies remove internal UUIDs, prompt-leak phrases, and unapproved URLs and are capped
  for WhatsApp.
- Run records contain model, intent, confidence, token estimate, cost estimate,
  latency, outcome, and real branch-scoped citations where retrieval supports a reply.
- Queue payloads store only a persisted inbound message id. Enqueue is idempotent and
  crash recovery reuses a deterministic run id.

## `GET /api/ai/runs`

Lists recent runs in the active organization.

**Auth**: session + active organization
**Permission**: `ai:read`

| Query | Type | Required | Notes |
|---|---|---|---|
| `conversationId` | UUID | no | Restricts results to one tenant-scoped conversation. |
| `limit` | integer | no | 1–100; defaults to 20. |

**Response 200**

```json
{
  "data": {
    "runs": [
      {
        "id": "uuid",
        "conversationId": "uuid",
        "model": "local/rule",
        "intent": "booking",
        "confidence": 0.8,
        "inputTokens": 120,
        "outputTokens": 30,
        "costAmount": 0.00081,
        "costCurrency": "USD",
        "latencyMs": 42,
        "outcome": "answered",
        "createdAt": "2026-08-22T12:00:00.000Z"
      }
    ]
  }
}
```

## `POST /api/ai/runs`

Queues a guarded AI turn from an existing inbound customer message.

**Auth**: session + active organization
**Permission**: `ai:run`

**Request**

| Field | Type | Required | Notes |
|---|---|---|---|
| `inputMessageId` | UUID | yes | Must identify a text-bearing inbound customer message in the active organization. |

Unknown fields are rejected. A client-supplied organization or branch id never becomes
scope.

**Response 202**: `{ "data": { "job": { "id": "uuid", "status": "queued", "runId": null } } }`.
Repeating the request for the same message returns the same job.

## `GET /api/ai/jobs/:id`

Returns the tenant-scoped job status, attempt counters, last error, and linked run id.

**Auth**: session + active organization
**Permission**: `ai:read`

Cross-organization ids return 404. Status is one of `queued`, `running`, `succeeded`,
or `failed`.

Linked run outcomes:

- `answered` — supported response passed guardrails.
- `refused` — insufficient knowledge support; reply offers human help.
- `escalated` — human request, low confidence, injection signal, or budget ceiling.
- `failed` — provider attempts exhausted; conversation is escalated.

## `GET /api/ai/templates`

Lists prompt templates and active-version state.

**Auth**: session + active organization
**Permission**: `ai:read`

## `POST /api/ai/templates`

Creates a branch-scoped template with its first draft version.

**Auth**: session + active organization
**Permission**: `ai:manage`

**Request**: `{ "key": "receptionist.faq", "name": "FAQ", "body": "..." }`

## `GET /api/ai/templates/:id`

Returns one tenant-scoped template and its versions.

**Auth**: session + active organization
**Permission**: `ai:read`

Cross-organization ids return 404.

## `POST /api/ai/templates/:id/versions`

Adds a draft version.

**Auth**: session + active organization
**Permission**: `ai:manage`

**Request**: `{ "body": "..." }`

## `POST /api/ai/templates/:id/versions/:versionId/activate`

Activates a version and archives the previously active version transactionally.

**Auth**: session + active organization
**Permission**: `ai:manage`

Cross-template and cross-organization version ids return 404.
