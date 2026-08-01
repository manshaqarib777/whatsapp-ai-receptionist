# Enterprise Architecture Rules

---

## 1. Backend Layering

```
Controller
   ↓
Service
   ↓
Repository
   ↓
Database
```

One file per layer, per aggregate:

```
conversation.controller.ts     # validate, auth, authz, map result. No logic.
conversation.service.ts        # business logic. No SQL, no framework imports.
conversation.repository.ts     # the only place that touches the DB.
```

A layer may only call the layer directly below it. Never skip a layer, never reach
upward.

---

## 2. Frontend Layering

```
Page
   ↓
Feature Component
   ↓
Hook
   ↓
Service
   ↓
API
```

See `UI_RULES.md` for what each layer may and may not do.

---

## 3. No Direct Database Access

```
Forbidden:  Component → Database

Allowed:    Component → API → Service → Repository → Database
```

Only repositories import the DB client or write queries. No ORM calls in controllers,
hooks, or components.

---

## 4. Directory Layout

Per the PRD's Folder Structure section. Never create giant files —
**300 lines maximum. Split aggressively.**

```
whatsapp-ai-receptionist/
├── .claude/                  # Rule files (this directory)
├── docs/
│   ├── PRODUCT_REQUIREMENTS.md   # Requirement source — read first
│   ├── milestones/               # MILESTONE_XX_{PLAN,PROGRESS,COMPLETED}.md
│   ├── architecture/
│   ├── api/
│   └── database/
├── prisma/                   # schema.prisma, migrations, seed
├── src/
│   ├── app/                  # Next.js App Router — routing only
│   ├── features/             # Business domains (vertical slices)
│   ├── components/           # Shared, domain-agnostic components
│   ├── ui/                   # Design system primitives (shadcn/ui)
│   ├── shared/               # Cross-cutting shared code
│   ├── server/               # Server-only: controllers, auth, context
│   ├── services/             # Shared application services
│   ├── lib/                  # Clients, config, infra adapters
│   ├── hooks/                # Shared hooks
│   ├── providers/            # React context providers
│   ├── validators/           # Shared Zod schemas
│   ├── workflows/            # Durable / multi-step orchestration
│   ├── agents/               # AI agents (see §9)
│   ├── database/             # Prisma client, repositories base, seed helpers
│   ├── types/                # Shared types
│   └── utils/                # Pure functions, no I/O
├── docker/                   # Local Postgres and services
└── tests/                    # E2E and cross-feature suites
```

`agents/`, `prompts/`, `memory/`, `tools/`, `retrieval/`, and `evaluations/` sit
together under the AI layer — see §9.

---

## 5. Feature-First Rule

Each business domain owns its full vertical slice, with the layering of §1 applied
*inside* the slice:

```
features/
 └── inbox/
      ├── components/     # Presentational, domain-aware
      ├── hooks/          # Domain state + data access
      ├── services/       # conversation.service.ts — business logic
      ├── repositories/   # conversation.repository.ts — only DB access
      ├── validators/     # Zod schemas
      ├── types/          # Domain types
      ├── api/            # conversation.controller.ts — route handlers
      └── tests/          # Unit + integration
```

**Domains, mapped to PRD milestones.** A feature directory is created when its
milestone starts — not before.

| Feature | Milestone | Owns |
|---|---|---|
| `auth` | 02 | Login, 2FA, OAuth, RBAC, sessions, audit logs |
| `organizations` | 02, 18 | Orgs, branches, membership, tenancy |
| `dashboard` | 05 | Stats, activity feed, notifications |
| `inbox` | 06 | Threads, realtime, assignment, notes, labels |
| `messaging` | 06 | WhatsApp send/receive, delivery status, attachments |
| `knowledge-base` | 07 | Ingest, chunking, embedding, search, versioning |
| `ai-engine` | 08 | Intent, memory, prompts, tools, confidence, citation |
| `appointments` | 09 | Calendars, availability, booking, reminders |
| `crm` | 10 | Pipeline, leads, companies, activities, timeline |
| `quotations` | 11 | Quotes, templates, approval, PDF, VAT |
| `invoices` | 12 | Invoices, payments, receipts, refunds |
| `workflow-builder` | 13 | Visual builder, triggers, conditions, actions |
| `broadcast` | 14 | Campaigns, scheduling, segmentation |
| `analytics` | 15 | Funnels, conversion, retention, forecasting |
| `reviews` | 16 | Google/Facebook reviews, feedback |
| `loyalty` | 17 | Points, membership, coupons, referrals |
| `integrations` | 19 | Meta, Google, Slack, HubSpot, Stripe, Zapier… |
| `voice` | 20 | STT, TTS, voice notes, commands |
| `agents` | 21 | Reception, sales, support, marketing agents |
| `admin` | 22 | Tenants, plans, billing, logs, monitoring |

Do not create a new top-level feature without an ADR. Do not create a feature
directory for a future milestone.

---

## 6. Layer Rules

Dependencies flow **one direction only**:

```
app/ (routes)
   →  features/*/api          (controller)
   →  features/*/services     (business logic)
   →  features/*/repositories (data access)
   →  src/database, src/lib

      features/*/validators   features/*/types   (referenced by any layer above)
```

**Allowed**
- `src/app/` imports from `src/features/*` and shared `src/*`.
- `src/features/*` imports from shared `src/*`.
- Any layer imports `src/types`, `src/utils`.

**Forbidden**
- Shared `src/*` importing from `src/features/*` — shared code must not know about
  domains.
- `features/a` importing `features/b`'s internals. Cross-feature access goes through
  the other feature's exported service, and only via its public barrel.
- Components importing `src/database`, Prisma, or calling the WhatsApp API directly.
- Circular imports of any kind.

---

## 7. Business Logic Placement

**Never put business logic inside components.**

| Logic | Lives in |
|---|---|
| Decide whether to escalate | `features/escalation/services` |
| Format a timestamp for display | `src/utils` |
| Fetch and cache a thread | `features/inbox/hooks` |
| Validate a webhook payload | `features/messaging/validators` |
| Call the model | `features/ai-engine/services` |
| Render a message bubble | `features/inbox/components` |

A component decides **what to show**, never **what is true**.

---

## 8. Service Rules

- Services are plain async functions or small classes. No framework imports.
- Services take explicit inputs and return typed results. No reading globals or
  request context.
- Services must be unit-testable without a running server.
- Side effects (DB writes, HTTP calls) go through injected or module-level clients in
  `src/lib`, never inline `fetch` with hardcoded URLs.
- A service that both fetches and mutates should be split.

---

## 9. AI Architecture

Separate concerns into distinct directories. Never mix them.

```
agents/
  reception-agent.ts
  sales-agent.ts

prompts/
  booking.prompt.ts

memory/
  conversation-memory.service.ts

tools/
retrieval/
evaluations/
```

- **agents/** compose prompts, tools, and memory. No inline prompt text.
- **prompts/** versioned modules exporting builders. No literals scattered in services.
- **memory/** owns what the model sees from history — windowing, summarisation.
- **tools/** the only way the AI changes state. Authorized in code, not by prompt.
- **retrieval/** knowledge-base lookup.
- **evaluations/** runnable evals, gating prompt and model changes in CI.

Rules and guardrails: `AI_ENGINE_RULES.md`.

---

## 10. Multi-Tenancy

This is a SaaS platform. Every persisted row and every query is tenant-scoped.

- Every table has `tenant_id NOT NULL`.
- Tenant id is derived from the authenticated session or the WhatsApp phone number id
  — **never** from a client-supplied body field.
- Service functions accept `tenantId` as an explicit first-class argument.
- Cross-tenant reads are a security incident, not a bug. See `SECURITY_RULES.md`.

---

## 11. Durability & Async Work

Anything multi-step, retryable, or longer than a request lives in `src/workflows/` —
AI turns with tool calls, outbound message retries, follow-up nudges, bulk operations,
campaign sends.

- Webhook handlers **acknowledge fast** (target < 1s) and enqueue. Meta retries on
  slow or failing responses, which causes duplicate processing.
- Every async step must be **idempotent**, keyed on the WhatsApp message id.
- Distinguish `src/workflows/` (internal durable execution) from the `workflow-builder`
  feature (Milestone 13, the user-facing visual builder). Different concerns, different
  layers.

---

## 12. Runtime Constraints

- Node.js runtime. **Do not** set `runtime = 'edge'`. Streaming works on Node.js.
- No in-memory state assumed to survive between requests.
- Long-lived state to Postgres; short-lived to Redis with an explicit TTL
  (Redis lands in Milestone 24 — until then, no cache-dependent design).

---

## 13. SOLID

Required by the PRD's coding standards. In practice, here:

- **Single responsibility** — the reason a file exceeds 300 lines is usually two
  responsibilities. Split by responsibility, not by line count.
- **Open/closed** — new message channels, payment providers, and integrations are added
  by implementing an interface, never by extending a `switch` in a service.
- **Liskov** — every implementation of a port honours the port's contract, including
  its error behaviour.
- **Interface segregation** — narrow ports. A repository interface with 20 methods
  serves no one.
- **Dependency inversion** — services depend on interfaces defined in the domain, not
  on Prisma or on an SDK. This is what keeps services unit-testable.

---

## 14. Adding a Module — Checklist

- [ ] Is this in the **current milestone's** approved scope? If not, stop.
- [ ] Does an existing feature already own this? If yes, extend it.
- [ ] Is the logic reusable? If yes, it belongs in shared `src/`, not a feature.
- [ ] Is this the correct layer? Trace the dependency direction.
- [ ] Does it need a new table? → `/docs/database/schema-change.md` first.
- [ ] Does it change a contract? → update `/docs/api/` first.
- [ ] Is the decision non-obvious or contested? → write an ADR.
- [ ] Will the file exceed 300 lines? → plan the split now, not later.
