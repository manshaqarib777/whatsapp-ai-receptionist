# Milestone 18 — Multi Branch

## Objective

Make a branch a selectable, trusted tenancy boundary inside an organization. Owners and
admins can create and manage branches, every authenticated session has an active branch,
and appointments, knowledge retrieval, and AI configuration operate only within that
branch. A single-branch organization continues to work through its default branch.

## Requirements

Multi Branch

Organizations

Branches

Separate Calendars

Separate Knowledge

Separate AI

STOP

## Architecture Decisions

- Create the already-authorized `src/features/organizations/` vertical slice. Branch
  controllers call a branch service, which calls a branch repository; only the
  repository imports Prisma.
- Keep organization membership organization-wide. The PRD does not define
  branch-specific membership or roles, so adding them would exceed this milestone.
- Store `activeBranchId` on the database-backed session beside
  `activeOrganizationId`. Derive it server-side and validate that it belongs to the
  active organization on every request. Never accept a branch id as an untrusted
  tenant scope without that membership check.
- Extend the authenticated context with the validated active branch. Switching
  organizations selects that organization's default branch atomically; switching a
  branch updates only the current session.
- Preserve the current organization-wide scope for aggregate screens that explicitly
  need it. Appointment, knowledge, and AI services receive the active branch scope
  from their controllers instead of resolving the default branch internally.
- Follow the bundled Next.js 16.2 guides: pages remain Server Components by default;
  interactive branch management and switching are narrow Client Components; route
  handler dynamic params are awaited promises.

## Dependencies

- Upstream: Milestones 2, 4, 7, 8, and 9.
- New packages: none.
- External services or credentials: none.

## Database Impact

- Add nullable `sessions.active_branch_id` referencing `branches.id` with
  `ON DELETE SET NULL`, plus an index. Existing sessions are backfilled to the default
  branch of their active organization before the constraint is used by application
  code.
- Reuse the existing `branches` table, unique live `(organization_id, slug)` index,
  and one-live-default-per-organization partial unique index.
- Migration is additive and backward-compatible. Rollback removes the session column
  and any new branch uniqueness index; it does not delete branch-owned business data.
- Detailed migration notes are recorded in `docs/database/schema-change.md` before the
  schema is changed.

## API Impact

- `GET /api/branches` — list live branches in the active organization.
- `POST /api/branches` — create a branch; requires `organization:update`.
- `PATCH /api/branches/:id` — update name/timezone; requires
  `organization:update`; cross-organization ids return 404.
- `PATCH /api/branches/active` — select a branch for the current session after proving
  it belongs to the active organization.
- `PATCH /api/branches/:id/default` — make a branch the organization default in one
  transaction; requires `organization:update`.
- Existing appointment, knowledge, and AI routes keep their public shapes. Their
  trusted scope changes from the implicit default branch to the session's active
  branch.

All writes use strict Zod schemas, `withApiHandler`, explicit authentication and
authorization, structured errors, and audit events.

## UI Impact

- Add a branch selector beside the organization selector in the authenticated shell.
- Add `/settings/branches` for branch list, creation, editing, timezone selection, and
  default-branch management.
- Provide loading, error, empty, and success states. Switching branches announces the
  result and refreshes branch-scoped data.
- Controls remain keyboard accessible, use visible labels and logical CSS properties,
  reflow at 320px, and render correctly in RTL. User-generated branch names use bidi
  isolation.

## AI Impact

- Prompt template lookup, active template selection, AI runs, and knowledge retrieval
  use the active branch id.
- No prompt text, model, tool, or token-budget changes.
- A missing or invalid active branch fails closed; AI must not fall back to another
  branch's template or knowledge.

## Security Considerations

- `activeBranchId` is read only from the database-backed session. A route body or query
  value never becomes scope without verifying the branch belongs to the active
  organization.
- Cross-organization branch ids return 404 and do not reveal existence.
- Branch creation/default changes require `organization:update`; branch selection
  requires organization membership.
- Default-branch changes and branch switches are audit logged with ids only.
- Every repository query carries both organization and branch scope where the model is
  branch-owned. Missing branch context fails closed.
- No new PII or secrets are introduced.

## Testing Strategy

- Unit: validators, slug generation, default-branch rules, active-branch resolution,
  and fail-closed behavior.
- Integration: create/list/update/default/switch, session persistence, organization
  isolation, invalid branch rejection, and concurrent default changes.
- Integration by domain: branch A cannot see branch B appointment resources or
  bookings, knowledge sources/chunks, prompt templates, or AI runs.
- Component: selector and branch settings loading/error/empty/success states,
  keyboard operation, RTL rendering, and axe.
- E2E: create a second branch, switch to it, verify separate calendar/knowledge/AI
  surfaces, switch back, and verify the first branch's data is unchanged.
- Gate: typecheck, lint, Vitest, Playwright, build, schema drift, and dependency audit.

## Risks

1. **High impact, medium likelihood — implicit default-branch lookups remain.** Mitigate
   with repository searches, branch-isolation integration tests, and removal of
   default resolution from request-driven services.
2. **High impact, low likelihood — active branch and organization become mismatched.**
   Validate both on every auth-context read and update them atomically on organization
   switches.
3. **Medium impact, medium likelihood — React Query caches survive a branch switch.**
   Refresh the route after the persisted switch and ensure branch-sensitive query keys
   include branch identity where client caching spans the shell.
4. **Medium impact, low likelihood — two branches become default concurrently.** Use a
   transaction plus the existing partial unique database constraint.
5. **Medium impact, medium likelihood — existing sessions have no active branch.**
   Resolve and persist the organization's default branch as a controlled compatibility
   path during rollout.
