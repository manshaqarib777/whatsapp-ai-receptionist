# CRM API

Milestone 10. All routes are wrapped in `withApiHandler` (correlation id,
structured logging, consistent envelope), require an authenticated session with
an active organization, and validate request bodies with Zod. Errors return the
standard `{ error: { code, message, details? } }` envelope.

Tenant scope always comes from the session — never from a request parameter.
Every query runs through `forScope`, and the polymorphic `taggables`/`activities`
tables carry an org stamp, so a cross-tenant read or write returns 404 (house
rule).

Permissions (`crm:read` / `crm:write`):

| Role | read | write |
|---|---|---|
| owner | ✓ | ✓ |
| admin | ✓ | ✓ |
| member | ✓ | ✓ |
| viewer | ✓ | — |

## Pipelines

### `GET /api/crm/pipelines`

Pipelines with ordered stages and open-deal counts.

Response: `{ data: { pipelines: PipelineRow[] } }` — each `{ id, name, isDefault,
stages: [{ id, pipelineId, name, position, winProbability, dealCount }] }`.

### `POST /api/crm/pipelines`

Creates a pipeline with stages. Requires `crm:write`. Body:

```json
{
  "name": "Treatment plans",
  "stages": [{ "name": "New enquiry", "winProbability": 0.1 }, { "name": "Won" }]
}
```

At least two stages required. Response (201): `{ data: { pipeline } }`.

## Deals

A lead and a deal are one table: a deal in an early stage is a lead; moving
stages and closing is the core lifecycle.

### `GET /api/crm/deals?stageId=&status=`

Deals, optionally filtered by stage or status (`open`/`won`/`lost`).

Response: `{ data: { deals: DealRow[] } }` — `{ id, contactId, companyId,
stageId, stageName, title, valueAmount, valueCurrency, status, closedAt,
createdAt, updatedAt, version, contactName, companyName, tags }`.

### `POST /api/crm/deals`

Creates a deal/lead. Requires `crm:write`. Body:

```json
{
  "title": "Root canal case",
  "stageId": "…",
  "valueAmount": 1450,
  "valueCurrency": "SAR",
  "contactId": "…",
  "companyId": "…"
}
```

Response (201): `{ data: { deal } }`. A `note` activity is recorded on the deal's
timeline.

### `GET /api/crm/deals/[id]`

Deal detail plus its timeline.

Response: `{ data: { deal, activities } }` — activities are `{ id, subjectType,
subjectId, kind, body, actorName, createdAt }`, newest first. Cross-tenant or
missing ids return 404.

### `PATCH /api/crm/deals/[id]`

Move stage, close, or update. Requires `crm:write`. Body shapes:

```json
{ "stageId": "…" }
```

moves the deal (records a `stage_change` activity; a closed deal cannot move),
or

```json
{ "status": "won" }
```

closes it (records a `status_change` activity and sets `closedAt`; requires the
deal to be open — 409 otherwise), or

```json
{ "title": "…", "valueAmount": 1000, "contactId": null }
```

updates fields (optimistic-locked on `version`, 409 on a stale write).

## Companies

### `GET /api/crm/companies`

Companies with contact/deal counts.

Response: `{ data: { companies: CompanyRow[] } }`.

### `POST /api/crm/companies`

Creates a company. Requires `crm:write`. Body:

```json
{ "name": "Alrajhi Logistics", "vatNumber": "3001234567000" }
```

Response (201): `{ data: { company } }`.

### `PATCH /api/crm/companies/[id]`

Updates a company (`crm:write`). Body: `{ name?, vatNumber? }`.

## Tags

Tags are polymorphic: the same `taggables` table joins tags to deals, contacts,
and conversations.

### `GET /api/crm/tags`

Lists the org's tags.

Response: `{ data: { tags: TagRow[] } }`.

### `POST /api/crm/tags`

Creates a tag. Requires `crm:write`. Body:

```json
{ "name": "Insurance", "color": "info" }
```

`color` is one of `neutral | info | success | warning | danger`.

### `POST /api/crm/tags/[id]/assign`

Tags a subject. Requires `crm:write`. Body:

```json
{ "tagId": "…", "taggableType": "deal" | "contact" | "conversation", "taggableId": "…" }
```

Idempotent: re-tagging the same subject is a no-op (the unique
`(tagId, taggableType, taggableId)` constraint). The subject must exist in this
org — otherwise 404.

### `DELETE /api/crm/tags/[id]/assign`

Untags a subject. Same body as assign.

## Tasks

### `GET /api/crm/tasks?status=`

Tasks, optionally filtered by status (`open | in_progress | done | cancelled`).

Response: `{ data: { tasks: TaskRow[] } }`.

### `POST /api/crm/tasks`

Creates a task. Requires `crm:write`. Body:

```json
{
  "title": "Call back about the crown fitting",
  "description": "Discuss the quote",
  "dueAt": "2026-08-16T17:00:00.000Z",
  "assigneeId": "…"
}
```

### `PATCH /api/crm/tasks/[id]`

Updates a task's status. Requires `crm:write`. Body:

```json
{ "status": "done" }
```

## Deal activities

### `POST /api/crm/deals/[id]/activities`

Adds a timeline entry. Requires `crm:write`. Body:

```json
{ "kind": "note" | "call" | "email" | "meeting", "body": "Called and discussed the quote." }
```

Response (201): `{ data: { activity } }`.

## Automation

Rule-based triggers (new deal → auto-assign, deal value ≥ threshold → tag,
company created → default tag) run in a DB-polled worker (`npm run crm:work`,
`src/workflows/crm-automation.worker.ts`). Rules are org-scoped config
(`DEFAULT_RULES` in M10); evaluation is idempotent, guarded by activity/tag
markers so a re-run cannot double-apply. There are no automation API routes in
M10 — the worker runs the configured ruleset directly.
