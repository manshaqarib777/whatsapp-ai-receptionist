# Architecture Overview

Current implementation reaches Milestone 24. The sequential verification/repair pass has
closed Milestones 1–24 locally and stops at the Milestone 25 production boundary.
Deployment and external-environment completion claims remain under review.

---

## Layering

```
Browser
  │
  ▼
Page (src/app/**/page.tsx)              Server Component by default
  │
  ▼
Feature Component (src/features/*/components)
  │
  ▼
Hook (src/features/*/hooks)             React Query — all server state
  │
  ▼
Route Handler (src/app/api/**/route.ts) Controller: validate → authn → authz
  │                                     Wrapped by src/server/api-handler.ts
  ▼
Service (src/features/*/services)       Business logic. No SQL, no framework.
  │
  ▼
Repository (src/features/*/repositories) The only code that touches the database
  │
  ▼
PostgreSQL
```

Components never call the database. Enforced by an ESLint rule that forbids importing
`@prisma/client` outside `src/lib/prisma.ts`.

**Read-only, server-rendered surfaces bypass the Hook row.** The dashboard (Milestone
5) is a set of server components that call the service directly behind per-widget
`Suspense` boundaries — there is no client fetch and no React Query provider for it.
The plan (AD-3) rejected a client fetch for a surface with no mutation or polling. The
React Query stack stays the convention for interactive surfaces such as the Milestone-6
inbox.

---

## Cross-Cutting Foundations

Established in Milestone 1 and consumed by every later milestone rather than
reinvented.

### `src/lib/env.ts` — configuration

The single module permitted to read `process.env`, enforced by a lint rule. Validates
with Zod at module load, so a misconfigured deployment fails at boot with a message
naming every offending variable — not at 3am on the first request that needed it.

### `src/lib/logger.ts` — structured logging

Pino. **Redaction is configured at the logger, not the call site**: if someone logs a
whole request object, sensitive paths are stripped automatically. Customer message
bodies and phone numbers are PII and are redacted by default.

`requestLogger({ correlationId, route, method })` yields a child logger so every line
from one request is traceable.

### `src/lib/errors.ts` — typed domain errors

Services throw `NotFoundError`, `ValidationError`, `ConflictError`, and so on. They
never construct HTTP responses. `isOperational` separates expected conditions (logged
at `warn`) from genuine bugs (logged at `error`).

### `src/server/api-handler.ts` — the API boundary

`withApiHandler(routeName, handler)` wraps every route and guarantees:

- a correlation id, generated or echoed from `x-correlation-id`
- structured request logging with duration
- domain errors mapped to their documented status codes
- Zod errors mapped to 400 with per-field details
- unexpected errors mapped to a generic 500 — **stack traces never reach a client**
- `Retry-After` on rate-limit errors

No route re-implements any of this.

---

## Request Flow — `GET /api/health`

```
Request
  → withApiHandler: correlation id, child logger, timer
    → route handler
      → health.service.getHealthReport()
        → prisma.$queryRaw`SELECT 1`   (2s timeout)
      ← { status, checks, uptime }
    ← 200 { data }  or  throw UnhealthyError
  → on throw: normalise → log → { error } envelope
Response + x-correlation-id
```

---

## Data Flow — client state

All server state flows through React Query. There is no `useEffect` + `fetch`, and no
server data mirrored into another store. Query keys are centralised per feature
(`healthKeys`) so invalidation cannot silently miss an entry.

The `QueryClient` is created inside a component's state, never at module scope — a
module-scope client on the server is shared across requests and leaks one user's
cached data into another's response.

---

## Security Posture (Milestone 1)

| Control | Status |
|---|---|
| Security headers (CSP, HSTS, nosniff, frame-options, referrer, permissions) | In place, `next.config.ts` |
| `X-Powered-By` suppressed | Yes |
| Secrets validated at boot, never logged | Yes |
| PII redaction at the logger | Yes |
| Error detail withheld from clients | Yes |
| Postgres bound to loopback only | Yes |
| Dependency audit in CI (fails on high/critical) | Yes |
| Authentication / authorization | **Milestone 2** |
| Tenant isolation | **Milestone 2 / 4** |
| Rate limiting | **Milestone 23 / 24 — durable PostgreSQL + Redis acceleration** |
| CSP nonces (removing `unsafe-inline` for scripts) | **Milestone 23** |

The gaps are milestone-scheduled, not oversights. They are listed in
`docs/milestones/MILESTONE_01_COMPLETED.md` under Known Limitations.

---

## Trusted branch scope (Milestone 18)

Authenticated business requests derive both organization and branch from the current
database session. `requireBranch()` validates that the selected branch belongs to the
active organization, persists a default fallback for upgraded sessions, and fails
closed when none exists. Appointment, knowledge, and AI controllers convert that
context to a `BranchScope`; client values never construct tenant scope.

Organization and default-branch selection change atomically. Better Auth session cookie
caching is disabled so branch switches, role changes, and revocation take effect on the
next request rather than after a cache TTL.

## Specialist AI routing (Milestone 21)

One guarded engine serves eight branch-scoped specialist profiles. Deterministic routing
selects an enabled specialist from message semantics, then intersects its requested work
with an immutable server-owned tool ceiling. Agent records configure display state and
prompt references but cannot grant tools, construct tenant scope, or bypass confirmation.
Runs carry optional agent attribution for later usage reporting. Local tests are labelled,
make no model call, and never deliver a message.

## Deferred by Design

| Concern | Milestone |
|---|---|
| Auth, RBAC, sessions, organizations | 2 |
| Design system | 3 |
| Full schema, ER diagram, audit/history/versioning | 4 |
| WhatsApp transport | 6 |
| AI engine | 8 |
| Redis, caching, virtualization | 24 |
| Deployment, monitoring, tracing, rollback | 25 |

## Production boundary (Milestone 25)

The web artifact is a Next.js standalone, non-root OCI image. Infrastructure probes
process liveness separately from PostgreSQL/configured-Redis readiness. API responses
carry validated W3C trace context alongside correlation IDs, while structured logs keep
the existing PII redaction boundary. CI builds and smoke-tests the immutable artifact;
release automation exports it without publishing or deploying. External environment
promotion and verification remain operator-controlled and were not performed locally.
