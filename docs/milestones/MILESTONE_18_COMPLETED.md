# Milestone 18 — Completed

Completed: 2026-08-23

## What Was Built

- Database-backed active branch selection validated against the session's active
  organization on every authenticated request.
- Atomic organization/default-branch switching and membership-safe branch switching.
- Branch list, create, update, make-default, and active-switch APIs with strict input,
  permission checks, tenant-safe 404s, structured errors, and audit events.
- Branch-aware sidebar switching and `/settings/branches` management UI.
- Separate appointments, knowledge, and AI through branch-scoped services/repositories.
- Default-branch compatibility fallback for upgraded sessions; missing branches fail closed.

## Files Created

- `prisma/migrations/20260823190000_active_branch_sessions/migration.sql`
- `src/features/organizations/{components,services,validators,tests}/...`
- `src/lib/db/auth/branches.repository.ts`
- `src/app/api/branches/...`
- `src/app/(app)/settings/branches/page.tsx`
- `tests/e2e/branches.spec.ts`

## Files Modified

- Prisma session/branch models, auth context, trusted scope factory, organization
  switching, authenticated shell, appointment/knowledge/AI layers, and audit registry.
- Better Auth session caching was disabled because tenant selection and revocation must
  become authoritative on the next request.

## Tests Completed

- Milestone/domain focus: 56/56 passed.
- Full Vitest suite: 97 files, 979/979 passed in 103.51 seconds.
- Full Playwright production matrix: 238/238 passed in 7.3 minutes across desktop and mobile.
- TypeScript and ESLint passed; schema drift passed with only documented HNSW/trgm indexes.
- Next.js production build passed with 59 pages; final compilation took 29 seconds.

## Performance Results

- Branch lookup is indexed by session and branch id; branch-owned reads reuse the
  existing scoped-Prisma predicate injection rather than adding post-query filtering.
- No new external network dependency or client-side polling was introduced.

## Known Limitations

- Membership and RBAC remain organization-wide because branch-specific roles are not
  part of the Milestone 18 PRD.
- Branch deletion is intentionally absent pending an archival/dependency policy.
- E2E onboarding setup still emits an expected operational 403 before org selection;
  it is log noise only and all tests pass.
