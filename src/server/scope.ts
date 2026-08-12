import type { Scope } from '@/lib/db/scope';

/**
 * Resolves a tenant scope from server-side state.
 *
 * This is the ONLY sanctioned source of a `Scope` (src/lib/db/scope.ts:12). A scope
 * may only be built from the session: `organizationId` arrives from the session row
 * via requireOrg/requirePermission (src/server/auth-context.ts), never from a request
 * body, query string, or header (SECURITY_RULES.md → Tenant Isolation).
 *
 * The org-level scope (branchId: null) spans all of an organization's branches — the
 * right view for reporting surfaces such as the dashboard. Milestone 18 (Multi
 * Branch) introduces user-visible branch selection; when it lands, branch-scoped
 * surfaces resolve their branch here too.
 */
export function resolveScope(organizationId: string): Scope {
  return { organizationId, branchId: null };
}
