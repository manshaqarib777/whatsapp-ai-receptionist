# Inbox API

Milestone 6. All routes are wrapped in `withApiHandler` (correlation id, structured
logging, consistent envelope), require an authenticated session with an active
organization (`requireOrg`), and validate request bodies with Zod. Errors return the
standard `{ error: { code, message, details? } }` envelope.

Tenant scope always comes from the session — never from a request parameter.

## Conversations

### `GET /api/inbox/conversations`

The conversation list for the active org, cursor-paginated and filterable.

Query params (all optional):

| Param | Values | Purpose |
|---|---|---|
| `status` | `open` \| `pending` \| `resolved` \| `archived` | Filter by status |
| `assignee` | `me` \| `unassigned` | Filter by assignment |
| `labelId` | uuid | Filter by label |
| `pinned` | `true` \| `false` | Filter by pinned state |
| `q` | string | Search message bodies + contact names |
| `cursor` | opaque | Pagination cursor from `nextCursor` |
| `limit` | 1–50 (default 25) | Page size |

Response: `{ data: { rows: ConversationRow[], nextCursor: string | null } }`.

Ordering: pinned first, then unread count, then `lastMessageAt` desc.

### `GET /api/inbox/conversations/[id]`

The full thread: conversation header, all messages (oldest first), internal notes,
heuristic summary, suggestions, and live typing rows.

Response: `{ data: { conversation, messages, notes, summary, suggestions, typing } }`.

404 when the conversation does not exist in the caller's org (cross-tenant access
returns 404, never 403).

### `GET /api/inbox/conversations/[id]/messages`

Cursor-paged message history. Query params: `before` (ISO timestamp cursor),
`limit` (1–100, default 30).

Response: `{ data: { rows: MessageRow[], nextCursor: string | null } }` — newest
first.

### `POST /api/inbox/conversations/[id]/messages`

Sends an agent reply. Requires `conversation:write`.

Body: `{ body: string, contentType?: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'sticker' }`.

Persists the message, bumps `lastMessageAt`, clears `unreadCount`. Returns the
created message (201).

### `POST /api/inbox/conversations/[id]/read`

Marks the conversation read for the current user (idempotent), upserts the
per-user read receipt, and zeroes the org-level unread counter.

### `POST /api/inbox/conversations/[id]/typing`

Writes/refreshes a TTL-expiring typing row (10s) for the current user. Expired
rows self-clean on the next write.

### `POST /api/inbox/conversations/[id]/archive`

Body: `{ archive: boolean }`. Toggles the conversation between its current status
and `archived`. Requires `conversation:write`.

### `PATCH /api/inbox/conversations/[id]`

Body: `{ assigneeId?: uuid | null, isPinned?: boolean }`. Assigning to another
user additionally requires `conversation:assign`.

### `GET /api/inbox/conversations/[id]/notes` · `POST /api/inbox/conversations/[id]/notes`

Internal notes — never sent to the contact. POST requires `conversation:write`,
body `{ body: string }`.

### `POST /api/inbox/conversations/[id]/labels` · `DELETE /api/inbox/conversations/[id]/labels/[labelId]`

Attach/detach a label. Both require `conversation:write`. A label from another
org 404s.

### `POST /api/inbox/conversations/[id]/attachments`

Uploads a file (multipart `file` part), stores it locally, creates a media
message, and attaches the file row. Returns `{ message, attachment: { storageKey,
signedUrl } }` where `signedUrl` is a short-lived signed download token.

## Labels

### `GET /api/inbox/labels` · `POST /api/inbox/labels`

List org labels / create one (`{ name, color }`, colors:
`neutral` \| `info` \| `success` \| `warning` \| `destructive`). POST requires
`conversation:write`.

## Search

### `GET /api/inbox/search?q=`

Searches message bodies (trigram index) + contact display names, org-scoped.
Response: `{ data: { hits: SearchHit[] } }`.

## Storage

### `GET /api/storage/[token]`

Serves a stored attachment through a signed, short-lived URL. The token is the
HMAC-signed value from `signStorageKey`; unsigned or expired tokens 404.
Responses are `private, no-store` (never cached).

## Auth

Every route uses `requireOrg` (401 unauthenticated, 403 no active org); mutation
routes additionally check `requirePermission('conversation:write')` / `('conversation:assign')`.
