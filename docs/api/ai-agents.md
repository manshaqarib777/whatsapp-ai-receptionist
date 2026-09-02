# AI Agents API

All routes require an authenticated session and derive organization plus active branch
from that verified session. Responses contain fixed safe DTOs; prompts and provider
credentials are never returned.

## `GET /api/ai/agents`

Requires `ai:read`. Returns the eight seeded specialist definitions for the active
branch, including kind, display configuration, enabled state, safe capability names,
prompt reference, and optimistic version.

## `GET /api/ai/agents/:id`

Requires `ai:read`. Returns one scoped agent. Missing, deleted, cross-tenant, and
cross-branch identifiers return 404.

## `PATCH /api/ai/agents/:id`

Requires `ai:manage`. Accepts one or more of `displayName`, `description`, `enabled`,
or nullable `promptTemplateId`, plus required `version`. Prompt references must belong
to the active branch. Stale versions return 409. Writes are audited without prompt or
message content.

## `POST /api/ai/agents/:id/test`

Requires `ai:manage` and authenticated API rate limiting. Body:
`{ "message": "I need a copy of my invoice" }`. Runs deterministic routing only; it
does not send a message or call an external model. Returns selected kind, routed kind,
whether the selected agent would handle it, and labelled local-demo copy.
