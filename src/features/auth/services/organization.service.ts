import { canAssignRole, hasPermission, type Role } from '@/features/auth/permissions';
import { slugify } from '@/features/auth/validators/auth.validators';
import * as auditLog from '@/features/auth/services/audit-log.service';
import { organizationsRepository } from '@/lib/db/auth/organizations.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';

/**
 * Organization and membership business logic.
 *
 * Every function takes `organizationId` explicitly — there is no ambient tenant. A
 * service function that could be called without a tenant scope eventually will be
 * (SECURITY_RULES.md → Tenant Isolation).
 */

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: string;
  memberCount: number;
};

/** Organizations the user belongs to, with their role in each. */
export async function listForUser(userId: string): Promise<OrganizationSummary[]> {
  const memberships = await organizationsRepository.listForUser(userId);

  return memberships.map((membership) => ({
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
    logo: membership.organization.logo,
    role: membership.role,
    memberCount: membership.organization._count.members,
  }));
}

/** Resolves a slug collision by appending an incrementing suffix. */
async function uniqueSlug(base: string): Promise<string> {
  const candidate = base || 'organization';

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const slug = attempt === 0 ? candidate : `${candidate}-${attempt + 1}`;
    if (!(await organizationsRepository.slugExists(slug))) return slug;
  }

  throw new ConflictError('Could not generate a unique organization address.');
}

/**
 * Creates an organization and makes the creator its owner, in one transaction.
 *
 * The two writes must not be separable: an organization with no owner is
 * unadministrable and cannot be deleted through the product.
 */
export async function create(input: {
  userId: string;
  name: string;
  slug?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<OrganizationSummary> {
  const slug = await uniqueSlug(input.slug ?? slugify(input.name));

  const organization = await organizationsRepository.createWithOwner({
    userId: input.userId,
    name: input.name,
    slug,
  });

  await auditLog.record({
    action: 'organization.created',
    actorId: input.userId,
    organizationId: organization.id,
    entityType: 'organization',
    entityId: organization.id,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });

  return { ...organization, role: 'owner', memberCount: 1 };
}

/**
 * Verifies membership and returns the role.
 *
 * Returns `null` rather than throwing so callers can decide between 403 and 404.
 */
export async function membershipRole(
  organizationId: string,
  userId: string,
): Promise<string | null> {
  return organizationsRepository.membershipRole(organizationId, userId);
}

export type MemberSummary = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  createdAt: Date;
};

/** Members of one organization. Scoped by `organizationId`, always. */
export async function listMembers(organizationId: string): Promise<MemberSummary[]> {
  const members = await organizationsRepository.listMembers(organizationId);

  return members.map((member) => ({
    id: member.id,
    userId: member.user.id,
    name: member.user.name,
    email: member.user.email,
    image: member.user.image,
    role: member.role,
    createdAt: member.createdAt,
  }));
}

/**
 * Changes a member's role.
 *
 * Guards, in order:
 *  1. The target must belong to THIS organization — otherwise 404, never 403.
 *  2. The actor must be permitted to assign that role (no self-promotion to owner).
 *  3. The last owner cannot be demoted, or the organization becomes unadministrable.
 */
export async function updateMemberRole(input: {
  organizationId: string;
  memberId: string;
  role: Role;
  actorId: string;
  actorRole: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<MemberSummary> {
  const member = await organizationsRepository.findMember(input.memberId);

  // Cross-tenant: 404, never 403 — a 403 confirms the member exists elsewhere.
  if (!member || member.organizationId !== input.organizationId) {
    throw new NotFoundError('Member not found.');
  }

  if (!canAssignRole(input.actorRole, input.role)) {
    throw new ForbiddenError('You cannot assign that role.');
  }

  // Demoting the final owner would leave nobody able to manage billing or delete
  // the organization.
  if (member.role === 'owner' && input.role !== 'owner') {
    const owners = await organizationsRepository.countOwners(input.organizationId);

    if (owners <= 1) {
      throw new ConflictError(
        'This is the only owner. Make someone else an owner first.',
      );
    }
  }

  const updated = await organizationsRepository.updateMemberRole(
    input.memberId,
    input.role,
  );

  await auditLog.record({
    action: 'member.role_changed',
    actorId: input.actorId,
    organizationId: input.organizationId,
    entityType: 'member',
    entityId: input.memberId,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    // Ids and enum values only — never the member's name or email.
    metadata: { previousRole: member.role, newRole: input.role },
  });

  return {
    id: updated.id,
    userId: updated.user.id,
    name: updated.user.name,
    email: updated.user.email,
    image: updated.user.image,
    role: updated.role,
    createdAt: updated.createdAt,
  };
}

/** Removes a member. The last owner cannot be removed. */
export async function removeMember(input: {
  organizationId: string;
  memberId: string;
  actorId: string;
  actorRole: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  if (!hasPermission(input.actorRole, 'member:remove')) {
    throw new ForbiddenError('You do not have permission to do that.');
  }

  const member = await organizationsRepository.findMember(input.memberId);

  if (!member || member.organizationId !== input.organizationId) {
    throw new NotFoundError('Member not found.');
  }

  if (member.role === 'owner') {
    const owners = await organizationsRepository.countOwners(input.organizationId);

    if (owners <= 1) {
      throw new ConflictError('You cannot remove the only owner.');
    }
  }

  await organizationsRepository.removeMember(input.memberId);

  await auditLog.record({
    action: 'member.removed',
    actorId: input.actorId,
    organizationId: input.organizationId,
    entityType: 'member',
    entityId: input.memberId,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    metadata: { removedRole: member.role, selfRemoval: member.userId === input.actorId },
  });
}
