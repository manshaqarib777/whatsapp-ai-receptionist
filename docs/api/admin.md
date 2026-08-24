# Platform Admin API

Every route requires a verified user whose fresh database `platform_role` is
`operator`. Organization owner/admin membership does not grant access. Requests share
the authenticated API rate limit and route-handler error/correlation contract. Reads
return fixed PII-minimized DTOs and are uncached by default.

## Read surfaces

| Method | Route | Response |
|---|---|---|
| GET | `/api/admin/overview` | Tenant, user, active-subscription, AI-run, failed-job, and audit-event counts. |
| GET | `/api/admin/tenants?page=1&limit=25` | Bounded tenant name/slug, member/branch counts, and subscription state. |
| GET | `/api/admin/plans` | Safe plan catalog, limits/features, state, version, and subscription count. |
| GET | `/api/admin/billing?page=1&limit=25` | Subscription contract snapshots and tenant/plan names. |
| GET | `/api/admin/logs?page=1&limit=25` | Audit action, ids, entity type, and timestamp only; no metadata or network fields. |
| GET | `/api/admin/ai-usage` | 30-day tenant totals for runs, tokens, USD cost, and average latency. |
| GET | `/api/admin/analytics` | Global operational counts and currency-separated invoice totals. |
| GET | `/api/admin/monitoring` | Database latency and bounded failure counters. |

Page and limit are strict integers; limit is capped at 100.

## `PATCH /api/admin/plans/:id`

Accepts bounded `name`, `description`, and/or `active` plus required optimistic
`version`. Missing plans return 404 and stale writes 409. Writes are platform-audited.

## `PATCH /api/admin/billing/:id`

Accepts `status`, `cancelAtPeriodEnd`, and/or an active `planId` plus required
optimistic `version`. It never charges a gateway or mutates tenant invoice/payment
history. Missing resources return 404, stale writes 409, and changes are audited under
the affected organization.

## Data exclusions

The contract never returns customer messages, contacts, email addresses, phone
numbers, prompts, retrieved knowledge, transcripts, access tokens, webhook secrets,
raw log metadata, IP addresses, user agents, or exception text.
