# Milestone 6 — Inbox

Created: 2026-08-12
Requirement source: `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 6`
Status: **Complete — structurally re-certified 2026-08-23**

---

## Objective

Replace the Milestone-5 `notFound()`-style stubs at `/inbox` and `/inbox/[id]` with a
real, working WhatsApp inbox: a conversation list, a message thread with a composer,
labels, archive, internal notes, assignments, filters, search, attachments, voice,
emoji, pinned, and AI suggestions + conversation summary. Real-time behaviour is
achieved with React Query polling (the already-wired provider + `refetchInterval`),
which survives a standard `next start` deployment with zero new infrastructure.

True after this milestone, and not true now:

- A two-pane inbox at `/inbox`: conversation list + message thread, rendered from real
  seeded data, tenant-scoped.
- An agent can reply, archive, pin, assign, label, add internal notes, and filter
  conversations — every action persisted and reflected in the list without a full
  reload.
- Messages, typing indicators, and read status update on a short poll interval, and
  the conversation list re-sorts live.
- Search across message bodies and contacts, labels, archive, notes, assignments,
  filters, attachments, voice (audio playback), and emoji all work.
- AI Suggestions and Conversation Summary render from heuristic, rule-based logic —
  no LLM calls — with a clean seam for the real AI Engine (Milestone 8).
- Typecheck, lint, unit/integration/E2E tests, and build all pass; axe audits the
  inbox clean in both themes, both directions, desktop + mobile.

Measurable: `npm run typecheck`, `npm run lint` → 0 errors; `npm run test` +
`npm run test:e2e` pass; `npm run build` succeeds; axe clean on `/inbox` and
`/inbox/[id]` in both themes, both directions, desktop + mobile.

---

## Requirements

Verbatim from `/docs/PRODUCT_REQUIREMENTS.md` → `# MILESTONE 6`:

```
Inbox

Real-time messaging

Typing

Read status

Search

Labels

Archive

Internal Notes

Assignments

Filters

Attachments

Voice

Emoji

Pinned

AI Suggestions

Conversation Summary

STOP
```

---

## Scope Decisions (from user answers)

- **AI Suggestions + Conversation Summary**: heuristic, rule-based UI only. No LLM
  calls, no model config, zero AI cost. M8 builds the real AI Engine behind the same
  UI seam.
- **Real-time**: React Query `refetchInterval` polling (5s conversations, 4s thread),
  not SSE/WebSockets. Zero infra, survives `next start` on Vercel.
- **Scope**: all 15 PRD features delivered.

---

## Architecture Decisions

### AD-1 — Two-pane inbox: server-rendered shell + client data via React Query

`/inbox` is a server component that resolves the session, reads the conversation list
through the repository (server-rendered initial state), and hydrates a client
`ConversationList` with it. `/inbox/[id]` renders the thread: header (contact, labels,
assignee, actions), message list, and composer. Both client views use the established
React Query hooks pattern (`src/features/health/hooks/use-health.ts` — centralized
`*Keys`, typed `fetch*` unwrapping `{ data }`, `useQuery` with `refetchInterval`).

Rejected: SSE / WebSockets (Vercel + `next start` constraints, no Redis, bespoke
wrapper). The notifications bell's one-shot `useEffect` fetch is the acknowledged
"before" pattern; the inbox uses real React Query.

### AD-2 — New `inbox` feature domain: repository + service + API routes

Mirror `src/features/dashboard/` exactly:

```
src/features/inbox/
  repositories/inbox.repository.ts    # only DB access; forScope(scope) everywhere
  services/inbox.service.ts           # pure orchestration, view-model shaping
  hooks/use-inbox.ts                  # query keys + typed fetch + useQuery/useMutation
  lib/                                # search parsing, heuristic AI, formatting
  validators/inbox.validators.ts      # zod schemas for every mutation
  components/                         # client components (list, thread, composer, …)
  tests/inbox.integration.test.ts     # real Postgres
  components/*.test.tsx               # component tests, axe-clean
```

Repository bound to one tenant scope at construction (`static forOrganization`),
every query through `forScope(scope)` (`src/lib/db/scoped-prisma.ts`), scope from the
session only (`src/server/scope.ts` → `resolveScope(organizationId)`). Never
`findUnique` on scoped models — use `findFirst` + the `expectOne()` convention.

### AD-3 — Real-time = React Query polling + cheap write endpoints

- `GET /api/inbox/conversations?cursor=&limit=` — list, cursor-paginated, with
  `useInfiniteQuery` and `meta.nextCursor`.
- `GET /api/inbox/conversations/[id]` — thread (messages + conversation + notes +
  suggestions).
- `GET /api/inbox/conversations/[id]/messages?before=` — cursor-paged messages.
- `POST /api/inbox/conversations/[id]/messages` — send reply / internal note (zod
  validated). Persists `Message` (or `ConversationNote`), bumps `lastMessageAt` +
  `updatedAt`, and **decrements `unreadCount` to 0** on read.
- `POST /api/inbox/conversations/[id]/read` — marks read, zeroes `unreadCount`
  (idempotent).
- `POST /api/inbox/conversations/[id]/typing` — writes a `conversation_typing` row.
- `POST /api/inbox/conversations/[id]/archive` / `unarchive` — toggles status
  `archived` ↔ previous.
- `PATCH /api/inbox/conversations/[id]` — assignee, status, isPinned (zod).
- `POST /api/inbox/conversations/[id]/labels` / `DELETE .../labels/[labelId]` —
  label add/remove.
- `GET /api/inbox/labels` / `POST /api/inbox/labels` — label list/create.
- `GET /api/inbox/search?q=` — message-body + contact search.
- `POST /api/inbox/conversations/[id]/attachments` — attachment upload (see AD-6).

All wrapped in `withApiHandler`, `requireOrg()` (+ `requirePermission` where
destructive: `conversation:write`, `conversation:assign`), zod validation, `jsonSuccess`
envelope, `{ error }` envelope on failure. Mutations use React Query
`useMutation` with query invalidation.

### AD-4 — Migration: what the schema lacks

The M4 schema already covers most of M6 (labels, archive enum, notes, assignments,
pinned, attachments, voice-as-audio, emoji-as-text). New migration adds:

| Model / field | Change | Why |
|---|---|---|
| `ConversationRead` (new) | orgId, userId, conversationId, lastReadAt — per-user read receipt | Read status is per-user; `unreadCount` is per-conversation |
| `conversation_typing` (new) | orgId, userId, conversationId, startedAt, expiresAt — TTL 10s | Typing indicators; DB row so it works across `next start` instances without Redis |
| `Message.readAt` (new) | `DateTime?` on `Message` | Per-message read timestamp for the thread UI |
| `pg_trgm` GIN index | raw SQL on `messages.body` (hand-written migration, following the `constraints` migration pattern) | Search — no ILIKE-optimizing index exists |
| `ConversationSummary` (new) | conversationId, summary, model, version, status, generatedAt | Conversation Summary persistence (M8-compatible) |
| `ActivityKind` enum | add `assigned`, `unassigned`, `label_changed`, `archived` (ALTER TYPE) | Inbox events on the existing activity feed |

Follow `docs/database/schema-change.md` conventions: `organization_id NOT NULL` on
every business table, `branch_id NOT NULL`, `deleted_at` soft delete, `version`
optimistic lock, snake_case `@map`, indexes on every FK and WHERE/ORDER BY column,
hand-written SQL (trgm, ALTER TYPE) in a dated migration folder with a
maintenance-hazard note.

### AD-5 — Search: `pg_trgm` trigram index on message bodies

Enable `pg_trgm` extension, add a GIN trigram index on `messages.body`. Query via the
repository's `findMany({ where: { body: { contains, mode: 'insensitive' } } })` (or
raw if needed). Return conversation + matched message snippets. Scope by org + branch,
never tenant-leak.

### AD-6 — Attachments: object-storage key + short-lived URL (no blob in Postgres)

Follow the schema's intent: `MessageAttachment.storageKey` + `sourceUrlExpiresAt`
("copy-to-storage step visible in the schema"). Local dev: files stored under
`./storage/` (gitignored), served by a route handler with the short-lived URL
pattern. The seed already references `seed/attachments/x-ray-placeholder.png` —
I'll add a small fixture asset under `public/` (or serve via the storage route) and
update the seed's storage key to match. Media messages render a download/play card.

### AD-7 — Voice = `audio` content type; Emoji = text

No schema change: voice messages are `MessageContentType.audio` with an attachment
(render an `<audio controls>` player). Emoji-only messages are `contentType: 'text'`
with an emoji body (seed already includes `EMOJI_ONLY_MESSAGE`); the composer gets an
emoji picker.

### AD-8 — Heuristic AI Suggestions + Conversation Summary

`src/features/inbox/lib/heuristics.ts` (pure functions, unit-tested):

- **Suggestions** from rules: conversation escalated (`isEscalated`), long-running
  open (unread + age), contact history, keyword triggers (FAQ hits, complaint words),
  label-based. Each suggestion is `{ kind, title, action }` rendered as quick-action
  chips; a rejected suggestion routes to M8's `AiRun` seam (the table + FKs already
  exist).
- **Summary**: last N messages truncated + contact/company context, rendered with the
  existing `Markdown` component. No LLM, no API key.

Rejected: pulling the AI Engine (M8) forward — explicitly out of scope.

### AD-9 — Filters: URL-driven, status/pinned/assignee/label/date

`/inbox?status=open&assignee=me&label=urgent&q=…`. The list query accepts these as
optional zod-parsed params. The client updates the URL via `router.replace`, and the
server component reads them for the initial render. Tabs (`Tabs`) for All / Unread /
Assigned / Archived, plus a label filter dropdown.

### AD-10 — Read status: poll + optimistic mark-read

The thread marks the conversation read on mount and after each poll sees inbound
messages. `unreadCount` zeroed server-side; the list's unread badge updates via query
invalidation. Typing indicator shows the current user's own typing state in the
header (and, via the shared conversation row, other agents' typing if present).

### AD-11 — Data flow & mutation convention

No server actions (none exist in the codebase). Mutations are API routes +
`useMutation`, then `queryClient.invalidateQueries` on the relevant keys — the
established "route handler + router.refresh" pattern, extended with React Query
invalidation. The sonner `Toaster` already mounted in the shell surfaces errors.

---

## Dependencies

**New packages**: none. `@tanstack/react-query` (already wired in the root layout),
`recharts`/`motion`/`lucide-react`/`date-fns` all present. `pg_trgm` is a Postgres
extension enabled by migration, no package.

**Upstream milestones**: 1 (foundation), 2 (auth/tenancy), 3 (design system), 4
(schema, seed, scoped client), 5 (dashboard + repository pattern).

**External services**: none. No API keys. No Redis. No websocket broker.

---

## Database Impact

See AD-4. One new migration with the six changes above, following the
`schema-change.md` conventions. Rollback: `prisma migrate reset` + `db:deploy` for
local/CI; documented restore-from-backup path for any live env (M25 exercises it).
The `ActivityKind` ALTER TYPE and the trgm index are appended as hand-written SQL in
the same migration folder with maintenance notes.

---

## API Impact

New routes (all `withApiHandler`, `requireOrg`, zod-validated, `{ data }` envelope):

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/inbox/conversations` | `requireOrg` | List, cursor-paginated, filterable |
| `GET /api/inbox/conversations/[id]` | `requireOrg` | Thread: conversation + messages + notes + suggestions |
| `GET /api/inbox/conversations/[id]/messages` | `requireOrg` | Cursor-paged message history |
| `POST /api/inbox/conversations/[id]/messages` | `conversation:write` | Send reply (or internal note) |
| `POST /api/inbox/conversations/[id]/read` | `requireOrg` | Mark read, zero unreadCount |
| `POST /api/inbox/conversations/[id]/typing` | `requireOrg` | Write typing indicator |
| `POST /api/inbox/conversations/[id]/archive` | `conversation:write` | Archive / unarchive |
| `PATCH /api/inbox/conversations/[id]` | `conversation:write` | Assignee, status, pinned |
| `POST /api/inbox/conversations/[id]/labels` | `conversation:write` | Add label |
| `DELETE /api/inbox/conversations/[id]/labels/[labelId]` | `conversation:write` | Remove label |
| `GET /api/inbox/labels` | `requireOrg` | List org labels |
| `POST /api/inbox/labels` | `conversation:write` | Create label |
| `GET /api/inbox/search?q=` | `requireOrg` | Search message bodies + contacts |
| `POST /api/inbox/conversations/[id]/attachments` | `conversation:write` | Upload attachment → storageKey |

---

## UI Impact

### Screens and components

- `src/app/(app)/inbox/page.tsx` — rebuild: server-rendered list shell + client
  `ConversationList` with filters (URL-driven), hydrated from the repository.
- `src/app/(app)/inbox/[id]/page.tsx` — rebuild: thread shell + client `ThreadView`
  (header, messages, composer, notes, suggestions).
- `src/features/inbox/components/` — `conversation-list.tsx`, `conversation-row.tsx`,
  `thread-view.tsx`, `message-bubble.tsx`, `composer.tsx`, `typing-indicator.tsx`,
  `labels.tsx`, `label-picker.tsx`, `assignment-select.tsx`, `filter-bar.tsx`,
  `search-input.tsx`, `attachment-card.tsx`, `voice-player.tsx`, `emoji-picker.tsx`,
  `pinned-toggle.tsx`, `archive-toggle.tsx`, `ai-suggestions.tsx`,
  `conversation-summary.tsx`, `note-composer.tsx`, `inbox-error.tsx`.

Reuse: `DataTable`, `Badge` (status variant map from `recent-conversations.tsx`),
`Avatar`, `Textarea` (auto-growing composer), `ScrollArea`, `Dialog`/`Sheet`/
`DropdownMenu`/`Tabs`/`Select`, `EmptyState`/`ErrorState`/`LoadingState`/`Skeleton`,
`Markdown`, `Toaster`, `PageHeader`.

### States (every view)

- **Loading**: per-widget skeleton (`role="status"` + `aria-busy`) — no full-page spinner.
- **Error**: per-widget `ErrorState` with retry.
- **Empty**: `EmptyState` with guidance — "No conversations match this filter" etc.
- **Thread**: loading skeleton, empty thread, error.

### Responsive & accessibility

- Two-pane: side-by-side on desktop, stacked (list above, thread below) on mobile via
  `Sheet`/tabs — a thread link navigates to `/inbox/[id]` on mobile.
- Logical (`ms-`/`ps-`/`start-`/`end-`) utilities only (RTL); tokens only; lucide
  icons; keyboard-reachable interactive rows (`group-hover:` + `focus-within:`).
- Composer labelled, `Enter` to send / `Shift+Enter` newline; typing indicator
  `aria-live`; emoji picker labelled; attachment button labelled; read/unread
  announced (`aria-live`).
- Polling stops on `document.hidden` (avoid background churn) — accessible + battery-friendly.

---

## AI Impact

**None** — heuristic suggestions + summary (AD-8), no LLM calls, no prompts, no model
config, no API keys. The seam for M8's AI Engine (the `AiRun` table + FKs already
exist) is documented, not built.

---

## Security Considerations

| Area | Consideration |
|---|---|
| Tenant isolation | Every inbox query through `forScope(scope)`; `organizationId` from the session only, never a request param. Integration test proves org A never sees org B. |
| Authorization | Mutations gated by `requirePermission('conversation:write'/'conversation:assign')`; `assertSameOrg` for by-id lookups. |
| PII | `Message.body` is PII — redaction-aware selection; never log raw bodies. Attachments served via short-lived URLs, never public static paths. |
| Search | Trigram index on message bodies is org-scoped; search never leaks across tenants. |
| Typing rows | TTL-expiring (`expiresAt < now()` filtered); a stale typing row self-cleans. |
| Polling | `refetchInterval` respects `document.hidden`; no background churn. |

### 2026-08-23 Sequential Review Amendment

- [x] Replace the assignment toast with a real member picker wired to PATCH.
- [x] Replace the attachment toast with an accessible file input and multipart upload,
      with server-side size/type validation and cache invalidation.
- [x] Add the missing internal-note composer wired to the existing notes endpoint.
- [x] Harden signed local-storage tokens with HMAC + constant-time comparison and
      preserve MIME metadata when serving audio/documents.
- [x] Bring `use-inbox.ts` below the 300-line limit and add regression coverage.
- [x] Re-run inbox tests, integration, E2E, drift, static gates, and build.

---

## Testing Strategy

- **Integration** (real Postgres, `forScope`, alongside `src/features/dashboard/tests/`):
  a new `inbox.integration.test.ts` — list ordering (lastMessageAt desc, unread first,
  pinned), filters (status/assignee/label), cursor pagination, thread + message
  history, send-message bumps lastMessageAt + zeroes unread, read-receipt rows,
  archive/unarchive, label add/remove, assignment change, typing TTL, search
  (trigram) returns only org rows, attachments round-trip, tenant isolation (org A
  never sees org B).
- **Component** (`src/features/inbox/components/*.test.tsx`, vitest + `vitest-axe`):
  each component renders loading/empty/error/populated; axe clean in both themes,
  both directions; `renderWithQuery` harness (from `system-status.test.tsx`) + an
  `EventSource`/fetch mock added to `vitest.setup.ts` if any component touches SSE
  (none planned — React Query only).
- **E2E** (`tests/e2e/inbox.spec.ts`, both projects): authenticated user sees seeded
  conversations; opens a thread; replies (message appears in thread + list re-sorts);
  archives, pins, labels, assigns; filters; search finds a message; typing indicator
  appears; axe audit of `/inbox` + `/inbox/[id]` in both themes, both directions,
  desktop + mobile. Reuse `openDashboard`/`seedDemoOrg`/`cleanupOrg` from
  `dashboard.spec.ts` (extract shared helpers if needed). Update the stale
  dashboard.spec.ts assertions that the inbox is "being built".
- **Unit**: heuristic suggestions (escalation, keywords, long-open), summary
  truncation, search-query parsing, date formatting.

**Exit gate** (per `MILESTONE_RULES.md` §6 + PRD DoD): typecheck (0), lint (0
warnings/errors), `npm run test`, `npm run test:e2e`, `npm run build`, axe-clean
inbox in both themes/directions/sizes, docs + `CHANGELOG.md` updated,
`MILESTONE_06_COMPLETED.md` written, each verification claim backed by an
actually-run command.

---

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Tenant leak in a new query | Medium | Critical | All reads through `forScope`; integration test proves org A cannot read org B. |
| R-2 | Polling cost / battery on Vercel | Medium | Medium | `refetchInterval` only while visible; bounded intervals (5s list, 4s thread); stop on `document.hidden`. |
| R-3 | Trigram search slow at real volume | Low | Medium | GIN index; `EXPLAIN ANALYZE` on the search query before merge (per `DATABASE_RULES.md:170`). |
| R-4 | Typing rows grow unbounded | Low | Low | TTL filter on read + cleanup on write; expiresAt checked in query. |
| R-5 | Rewiring `/inbox` breaks dashboard doorway links | Medium | Medium | Update `dashboard.spec.ts` doorway assertions; full E2E pass guards the change. |
| R-6 | Attachment storage not portable | Low | Low | Storage-key abstraction behind the repository; local `./storage/` + route handler; S3 pluggable later. |
| R-7 | Large M6 scope (15 features) leaks into M7/M8 | Medium | Medium | Scope guard: heuristic AI only, no LLM; detail pages are stubs; review against `MILESTONE_RULES.md:19`. |

---

## Deliverables Checklist

- [ ] `docs/milestones/MILESTONE_06_PLAN.md` — this plan, committed
- [ ] Migration: `ConversationRead`, `conversation_typing`, `Message.readAt`, trgm
      index, `ConversationSummary`, `ActivityKind` extension
- [ ] `src/features/inbox/` — repository, service, hooks, validators, components
- [ ] `src/app/(app)/inbox/page.tsx` + `[id]/page.tsx` — real inbox
- [ ] API routes per API Impact
- [ ] Integration, component, E2E, unit tests per Testing Strategy
- [ ] Docs: `CHANGELOG.md`, `docs/api/inbox.md`, schema-change entry,
      `MILESTONE_06_PROGRESS.md` maintained throughout
- [ ] `MILESTONE_06_COMPLETED.md` — written only after all exit criteria pass
