/**
 * Role-based access control.
 *
 * Roles are per-ORGANIZATION MEMBERSHIP, never global on the user: a person may be
 * an owner of one organization and a viewer of another. The role therefore always
 * arrives from the `members` row for the active organization.
 *
 * This module is deliberately pure — no database, no request context, no imports
 * beyond types. That makes the entire permission model unit-testable without a
 * running server, which is the only way to be confident it is correct.
 *
 * Checks are SERVER-SIDE ONLY. Hiding a button is not authorization
 * (SECURITY_RULES.md → Authentication & Authorization).
 */

export const ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // Organization
  'organization:read',
  'organization:update',
  'organization:delete',
  'organization:billing',

  // Members
  'member:read',
  'member:invite',
  'member:update',
  'member:remove',

  // Audit
  'audit:read',

  // Conversations — Milestone 6. Declared now so the role matrix is complete and
  // later milestones extend the matrix rather than inventing a parallel one.
  'conversation:read',
  'conversation:write',
  'conversation:assign',
  'conversation:delete',

  // Contacts — Milestone 10
  'contact:read',
  'contact:write',
  'contact:delete',

  // Settings
  'settings:read',
  'settings:update',

  // Knowledge base — Milestone 7.
  'knowledge:read',
  'knowledge:write',
  'knowledge:approve',

  // AI Engine — Milestone 8.
  'ai:read',
  'ai:manage',
  'ai:run',

  // Appointments — Milestone 9.
  'appointment:read',
  'appointment:write',

  // CRM — Milestone 10.
  'crm:read',
  'crm:write',

  // Quotes — Milestone 11.
  'quote:read',
  'quote:write',

  // Invoices — Milestone 12.
  'invoice:read',
  'invoice:write',

  // Workflows — Milestone 13.
  'workflow:read',
  'workflow:write',

  // Broadcast — Milestone 14.
  'broadcast:read',
  'broadcast:write',

  // Analytics — Milestone 15.
  'analytics:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * The authoritative role → permission matrix.
 *
 * Written out in full rather than derived by role hierarchy. A hierarchy is shorter
 * but hides exactly the thing a reviewer needs to see: what each role can actually
 * do. Explicit lists make an accidental privilege escalation visible in the diff.
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    'organization:read',
    'organization:update',
    'organization:delete',
    'organization:billing',
    'member:read',
    'member:invite',
    'member:update',
    'member:remove',
    'audit:read',
    'conversation:read',
    'conversation:write',
    'conversation:assign',
    'conversation:delete',
    'contact:read',
    'contact:write',
    'contact:delete',
    'settings:read',
    'settings:update',
    'knowledge:read',
    'knowledge:write',
    'knowledge:approve',
    'ai:read',
    'ai:manage',
    'ai:run',
    'appointment:read',
    'appointment:write',
    'crm:read',
    'crm:write',
    'quote:read',
    'quote:write',
    'invoice:read',
    'invoice:write',
    'workflow:read',
    'workflow:write',
    'broadcast:read',
    'broadcast:write',
    'analytics:read',
  ],

  admin: [
    'organization:read',
    'organization:update',
    // NOT organization:delete — deleting the tenant is the owner's alone.
    // NOT organization:billing — payment details are the owner's alone.
    'member:read',
    'member:invite',
    'member:update',
    'member:remove',
    'audit:read',
    'conversation:read',
    'conversation:write',
    'conversation:assign',
    'conversation:delete',
    'contact:read',
    'contact:write',
    'contact:delete',
    'settings:read',
    'settings:update',
    'knowledge:read',
    'knowledge:write',
    'knowledge:approve',
    'ai:read',
    'ai:manage',
    'ai:run',
    'appointment:read',
    'appointment:write',
    'crm:read',
    'crm:write',
    'quote:read',
    'quote:write',
    'invoice:read',
    'invoice:write',
    'workflow:read',
    'workflow:write',
    'broadcast:read',
    'broadcast:write',
    'analytics:read',
  ],

  member: [
    'organization:read',
    'member:read',
    'conversation:read',
    'conversation:write',
    'conversation:assign',
    // NOT conversation:delete — destructive, and a member has no reason to.
    'contact:read',
    'contact:write',
    'settings:read',
    'knowledge:read',
    'knowledge:write',
    // NOT knowledge:approve — approval is admin/owner-only.
    'ai:read',
    // NOT ai:manage — template activation is admin/owner-only.
    'ai:run',
    'appointment:read',
    'appointment:write',
    'crm:read',
    'crm:write',
    'quote:read',
    'quote:write',
    'invoice:read',
    'invoice:write',
    'workflow:read',
    'workflow:write',
    'broadcast:read',
    'broadcast:write',
    'analytics:read',
  ],

  viewer: [
    'organization:read',
    'member:read',
    'conversation:read',
    'contact:read',
    'settings:read',
    'knowledge:read',
    'ai:read',
    'appointment:read',
    'crm:read',
    'quote:read',
    'invoice:read',
    'workflow:read',
    'broadcast:read',
    'analytics:read',
  ],
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Does this role hold this permission?
 *
 * Unknown roles resolve to `false` — fail closed. A corrupted or future role value
 * in the database must deny access, never grant it (SECURITY_RULES.md → Fail closed).
 */
export function hasPermission(role: string, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAllPermissions(
  role: string,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

export function hasAnyPermission(
  role: string,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function permissionsForRole(role: string): readonly Permission[] {
  return isRole(role) ? ROLE_PERMISSIONS[role] : [];
}

/**
 * Can `actorRole` assign `targetRole` to someone?
 *
 * Prevents privilege escalation: an admin must not be able to make themselves or
 * anyone else an owner. Ownership transfers through a dedicated flow, not through
 * the ordinary role-change endpoint.
 */
export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (!isRole(actorRole) || !isRole(targetRole)) return false;
  if (!hasPermission(actorRole, 'member:update')) return false;

  // Only an owner may create another owner.
  if (targetRole === 'owner') return actorRole === 'owner';

  return true;
}

/** Ordered most- to least-privileged, for consistent UI presentation. */
export const ROLE_ORDER: readonly Role[] = ['owner', 'admin', 'member', 'viewer'];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Full control, including billing and deleting the organization.',
  admin: 'Manage members, settings, and all conversations.',
  member: 'Handle conversations and contacts.',
  viewer: 'Read-only access.',
};
