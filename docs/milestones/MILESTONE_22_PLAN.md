# Milestone 22 — Admin Portal

## Objective

Provide a platform-operator portal for safely observing tenants, commercial plans and
subscriptions, billing state, sanitized logs, AI usage, aggregate analytics, and system
health without granting tenant owners cross-tenant authority.

## Requirements

Admin Portal

Tenants

Plans

Billing

Logs

AI Usage

Analytics

Monitoring

STOP

## Architecture Decisions

- Platform authorization is independent from organization RBAC. Add a closed global
  `platformRole` on users and a fail-closed `requirePlatformAdmin()` boundary.
- Put cross-tenant reads in a dedicated `admin` vertical slice and database-owned
  repository. Never weaken or bypass scoped tenant repositories for normal features.
- Add plans and organization subscriptions as global catalog/org-contract records.
  Billing amounts remain snapshots; no payment collection or impersonation is added.
- Admin logs are fixed sanitized DTOs from the append-only audit trail. No message,
  transcript, prompt, token, credential, or raw exception content is exposed.

## Dependencies

- Upstream: Milestones 1–21.
- Existing PostgreSQL, Prisma, auth session, audit log, AI runs, analytics, health,
  invoice, and integration data. No new package or external service.

## Database Impact

- Add nullable/default platform role to users, global plan catalog records, and
  organization-scoped subscriptions with status, billing cadence, period, currency,
  amount snapshot, trial/cancel state, timestamps, and soft deletion.
- Seed one explicit platform operator, three plans, two synthetic subscriptions.
- Additive migration with indexes for status, period, and organization lookup.

## API Impact

- Read APIs under `/api/admin` for overview, tenants, plans, billing, logs, AI usage,
  analytics, and monitoring; plan/subscription mutations are strict and audited.
- Every route requires platform-admin authorization and applies bounded pagination,
  fixed DTOs, structured errors, rate limits, and no-store semantics.

## UI Impact

- Add a separate `/admin` shell and dashboard with accessible navigation and responsive
  tables/cards for all required surfaces. It is visible only to platform operators and
  remains unreachable to organization owners, including direct URL/API access.

## AI Impact

- Read aggregate AI run counts, tokens, cost, latency, outcomes, and specialist usage.
  Never expose prompts, customer messages, retrieved chunks, or transcript content.

## Security Considerations

- Cross-tenant visibility is the primary threat. Authorization must come from the
  verified global user record, not membership role or client input. Reads are minimal,
  paginated, PII-reduced, audited where mutating, and protected from CSV/formula or log
  injection by returning typed JSON/text only.

## Testing Strategy

- Unit: platform-role guard, metrics math, validators, DTO redaction.
- Integration: admin repository aggregates, subscription concurrency, tenant-owner
  denial, operator access, and sensitive-field absence.
- Component: every state, RBAC visibility, tables/cards, keyboard, RTL, and axe.
- E2E: operator login across all portal tabs plus owner direct-access denial on desktop
  and mobile. Then all project gates.

## Risks

1. **Cross-tenant data leak** — critical; separate global guard/repository and fixed DTOs.
2. **Tenant owner confused with platform admin** — critical; distinct database role.
3. **Misleading billing totals** — high; currency-aware snapshots, no mixed-currency sum.
4. **Expensive global aggregates** — medium; bounded date windows/indexes and measured queries.
