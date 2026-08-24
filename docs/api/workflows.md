# Workflows API

Milestone 13. All routes are wrapped in `withApiHandler` (correlation id,
structured logging, consistent envelope), require an authenticated session with
an active organization, and validate request bodies with Zod. Errors return the
standard `{ error: { code, message, details? } }` envelope.

Tenant scope always comes from the session — never from a request parameter.
Every query runs through `forScope`, so a cross-tenant read or write returns 404
(house rule). `Workflow`, `WorkflowVersion`, `WorkflowRun`, and
`WorkflowRunStep` are branch-scoped; writes go through the org's default branch.

Permissions (`workflow:read` / `workflow:write`):

| Role | read | write |
|---|---|---|
| owner | ✓ | ✓ |
| admin | ✓ | ✓ |
| member | ✓ | ✓ |
| viewer | ✓ | — |

## The graph

A workflow version's `definition` is the whole graph as JSON:

```json
{
  "nodes": [
    { "id": "trigger-1", "type": "trigger", "config": {} },
    { "id": "cond-1", "type": "condition", "config": {} },
    { "id": "action-1", "type": "action", "actionKind": "send_message", "config": { "text": "Hi" } },
    { "id": "delay-1", "type": "delay", "config": { "delaySeconds": 3600 } }
  ],
  "edges": [
    { "id": "e1", "from": "trigger-1", "to": "cond-1" },
    { "id": "e2", "from": "cond-1", "to": "action-1", "label": "true" },
    { "id": "e3", "from": "cond-1", "to": "delay-1", "label": "false" }
  ],
  "variables": [{ "name": "clinic", "value": "Northwind" }]
}
```

Node types: `trigger | condition | action | delay`. Action kinds:
`send_message | tag | assign | create_task`.

The server validates the graph before saving (`validateGraph`): node ids must be
unique, every edge must reference known nodes, a condition node must have
exactly two outgoing edges labelled `true` and `false`, branch labels may only
appear on condition edges, exactly one trigger is required, non-condition nodes
have at most one outgoing edge, and variable names must be non-empty and unique. An
invalid graph is a **409**, never a saved half-graph.

## Workflows

### `GET /api/workflows`

Workflows (soft-deleted excluded).

Response: `{ data: { workflows: WorkflowRow[] } }` — `{ id, name, isEnabled,
currentVersionId, version, createdAt, updatedAt }`. Oldest first.

### `POST /api/workflows`

Creates a workflow. Requires `workflow:write`. Body:

```json
{ "name": "Welcome message" }
```

Response (201): `{ data: { workflow } }`. A new workflow has no version and is
disabled until a version is saved.

### `GET /api/workflows/[id]`

Workflow detail plus its version history and recent runs.

Response: `{ data: { workflow, versions, runs } }` — `versions` are `{ id,
versionNumber, definition, triggerKind, createdAt }` newest first; `runs` are
`{ id, workflowVersionId, triggerEntityType, triggerEntityId, status, error,
startedAt, finishedAt }` newest first. Cross-tenant or missing ids return 404.

### `PATCH /api/workflows/[id]`

Requires `workflow:write`. Body:

```json
{ "name": "Renamed", "isEnabled": true }
```

Enabling requires at least one saved version — a workflow with no version
cannot be enabled (409). Response: `{ data: { workflow } }`.

## Versions

### `POST /api/workflows/[id]/versions`

Saves a new immutable version of the workflow graph. Requires `workflow:write`.
Body:

```json
{
  "triggerKind": "new_contact",
  "definition": { "nodes": [], "edges": [], "variables": [] }
}
```

`triggerKind` is one of `message_received | new_contact | manual`. The graph is
validated server-side; an invalid graph is a 409 listing every problem found.
Versions are never mutated after creation — each save increments
`versionNumber` and points the workflow's `currentVersionId` at the new row.

Response (201): `{ data: { version } }`.

### `POST /api/workflows/[id]/clone`

Creates a disabled workflow with version 1 copied from the source workflow's
current immutable definition. Body: `{ "name": "Welcome template copy" }`.
The source must have a saved version. Response (201): `{ data: { workflow } }`.

## Runs

### `POST /api/workflows/[id]/runs`

Starts a manual (test) run against the current version. Requires
`workflow:write`. A workflow with no saved version cannot run (409).

Optional body: `{ "variables": { "leadScore": 75, "vip": true } }`.
Supplied variables override defaults stored in the definition. Conditions use
`equals`, `not_equals`, `contains`, `greater_than`, or `exists` and follow the
matching labelled branch. Action nodes succeed, and delay nodes land `pending`
with a `scheduledFor` set from `config.delaySeconds` (default 1 hour). One
`WorkflowRunStep` row is written per executed node.

Runs without a delay finish immediately. Runs with a delay remain `running`;
`npm run workflow:work` atomically claims due steps, reloads persisted run
context, resumes the selected graph path, and records success or failure.

Response (201): `{ data: { run, steps } }` — `steps` are `{ nodeId, status }`
in execution order.
