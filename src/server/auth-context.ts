import { headers } from 'next/headers';
import { cache } from 'react';

import { hasPermission, type Permission } from '@/features/auth/permissions';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError, UnauthenticatedError } from '@/lib/errors';

/**
 * The application's authentication boundary.
 *
 * Everything outside src/lib/auth.ts and src/features/auth/ depends on THESE helpers,
 * never on Better Auth directly. Replacing the auth library means rewriting this file
 * and nothing else (ADR-0001, ARCHITECTURE_RULES.md §13).
 *
 * The central guarantee: `organizationId` is read from the SESSION ROW in the
 * database. It is never taken from a request body, query parameter, or header, which
 * is what makes tenant scoping trustworthy (SECURITY_RULES.md → Tenant Isolation).
 */

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  twoFactorEnabled: boolean;
};

export type AuthContext = {
  user: AuthUser;
  sessionId: string;
  /** Null until the user has created or joined an organization. */
  organizationId: string | null;
  /** Null when `organizationId` is null. */
  role: string | null;
};

/**
 * Reads the current session, or null.
 *
 * Wrapped in React's `cache` so several Server Components in one render share a
 * single lookup rather than each hitting the database.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user || !session.session) {
    return null;
  }

  const organizationId = session.session.activeOrganizationId ?? null;
  let role: string | null = null;

  if (organizationId) {
    // The role is read fresh from the membership row rather than trusted from the
    // session payload: a role change must take effect on the next request, not when
    // the session eventually expires.
    const membership = await prisma.member.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: session.user.id },
      },
      select: { role: true },
    });

    // No membership means the user was removed from the organization while signed
    // in. Fail closed: no organization, no role.
    if (!membership) {
      return {
        user: toAuthUser(session.user),
        sessionId: session.session.id,
        organizationId: null,
        role: null,
      };
    }

    role = membership.role;
  }

  return {
    user: toAuthUser(session.user),
    sessionId: session.session.id,
    organizationId,
    role,
  };
});

function toAuthUser(user: {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  twoFactorEnabled?: boolean | null;
}): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image ?? null,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
  };
}

/** Throws `UnauthenticatedError` (401) when there is no session. */
export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();

  if (!context) {
    throw new UnauthenticatedError();
  }

  return context;
}

export type OrgAuthContext = AuthContext & {
  organizationId: string;
  role: string;
};

/**
 * Requires an authenticated user **with an active organization**.
 *
 * Every tenant-scoped route uses this. The returned `organizationId` is the only
 * value that may be used to scope a query.
 */
export async function requireOrg(): Promise<OrgAuthContext> {
  const context = await requireAuth();

  if (!context.organizationId || !context.role) {
    throw new ForbiddenError('Select an organization to continue.');
  }

  return context as OrgAuthContext;
}

/**
 * Requires a permission within the active organization.
 *
 * Authentication and authorization are separate checks: being signed in never implies
 * permission (SECURITY_RULES.md).
 */
export async function requirePermission(permission: Permission): Promise<OrgAuthContext> {
  const context = await requireOrg();

  if (!hasPermission(context.role, permission)) {
    // Deliberately does not name the missing permission — that tells an attacker
    // what the permission model looks like.
    throw new ForbiddenError('You do not have permission to do that.');
  }

  return context;
}

/**
 * Non-throwing permission check, for deciding what to render.
 *
 * This is a presentation aid ONLY. Every action it guards must also be enforced
 * server-side — hiding a button is not authorization.
 */
export async function can(permission: Permission): Promise<boolean> {
  const context = await getAuthContext();

  if (!context?.role) return false;

  return hasPermission(context.role, permission);
}

/**
 * Asserts that a resource belongs to the caller's organization.
 *
 * Prefer scoping the query by `organizationId` in the first place; this exists for
 * the cases where a resource is fetched by id and must then be verified.
 */
export function assertSameOrg(
  resourceOrganizationId: string,
  context: OrgAuthContext,
): void {
  if (resourceOrganizationId !== context.organizationId) {
    // Cross-tenant access is reported as 404, never 403 — a 403 would confirm the
    // resource exists in another tenant (SECURITY_RULES.md → Tenant Isolation).
    throw new NotFoundError();
  }
}
