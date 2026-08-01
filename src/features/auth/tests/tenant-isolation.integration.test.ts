import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as organizationService from '@/features/auth/services/organization.service';
import { prisma } from '@/lib/prisma';
import { NotFoundError, ConflictError, ForbiddenError } from '@/lib/errors';

/**
 * Tenant isolation — the highest-value tests in this milestone.
 *
 * A cross-tenant leak is a security incident, not a defect (SECURITY_RULES.md). These
 * run against real Postgres and prove isolation rather than asserting it in a comment.
 *
 * Risk 5 in MILESTONE_02_PLAN.md: isolation bugs are silent. A route without one of
 * these tests does not ship.
 */

type Fixture = {
  orgA: string;
  orgB: string;
  ownerA: string;
  memberA: string;
  ownerB: string;
  memberRowA: string;
  memberRowB: string;
};

let fixture: Fixture;

async function createUser(suffix: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      name: `User ${suffix}`,
      email: `isolation-${suffix}-${Date.now()}-${Math.round(performance.now() * 1000)}@test.local`,
      emailVerified: true,
    },
    select: { id: true },
  });

  return user.id;
}

beforeEach(async () => {
  const ownerA = await createUser('owner-a');
  const memberA = await createUser('member-a');
  const ownerB = await createUser('owner-b');

  const a = await organizationService.create({ userId: ownerA, name: 'Org A' });
  const b = await organizationService.create({ userId: ownerB, name: 'Org B' });

  const memberRowA = await prisma.member.create({
    data: { organizationId: a.id, userId: memberA, role: 'member' },
    select: { id: true },
  });

  const memberRowB = await prisma.member.findFirstOrThrow({
    where: { organizationId: b.id, userId: ownerB },
    select: { id: true },
  });

  fixture = {
    orgA: a.id,
    orgB: b.id,
    ownerA,
    memberA,
    ownerB,
    memberRowA: memberRowA.id,
    memberRowB: memberRowB.id,
  };
});

afterEach(async () => {
  // Each test cleans up after itself — tests are independent and order-agnostic.
  await prisma.auditLog.deleteMany({
    where: { organizationId: { in: [fixture.orgA, fixture.orgB] } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: [fixture.orgA, fixture.orgB] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [fixture.ownerA, fixture.memberA, fixture.ownerB] } },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('listMembers', () => {
  it('returns only the requested organization members', async () => {
    const membersA = await organizationService.listMembers(fixture.orgA);
    const membersB = await organizationService.listMembers(fixture.orgB);

    expect(membersA).toHaveLength(2);
    expect(membersB).toHaveLength(1);

    const idsA = membersA.map((m) => m.userId);
    expect(idsA).toContain(fixture.ownerA);
    expect(idsA).toContain(fixture.memberA);
    // The critical assertion: org B's owner must not appear in org A's list.
    expect(idsA).not.toContain(fixture.ownerB);
  });
});

describe('listForUser', () => {
  it('returns only organizations the user actually belongs to', async () => {
    const organizations = await organizationService.listForUser(fixture.memberA);

    expect(organizations).toHaveLength(1);
    expect(organizations[0]?.id).toBe(fixture.orgA);
    expect(organizations.map((o) => o.id)).not.toContain(fixture.orgB);
  });

  it('reports the role held in each organization', async () => {
    const forOwner = await organizationService.listForUser(fixture.ownerA);
    const forMember = await organizationService.listForUser(fixture.memberA);

    expect(forOwner[0]?.role).toBe('owner');
    expect(forMember[0]?.role).toBe('member');
  });
});

describe('membershipRole', () => {
  it('returns null for an organization the user does not belong to', async () => {
    await expect(
      organizationService.membershipRole(fixture.orgB, fixture.memberA),
    ).resolves.toBeNull();
  });

  it('returns the role for a genuine membership', async () => {
    await expect(
      organizationService.membershipRole(fixture.orgA, fixture.memberA),
    ).resolves.toBe('member');
  });
});

describe('updateMemberRole — cross-tenant', () => {
  it('rejects updating a member of ANOTHER organization with 404, not 403', async () => {
    // Org A's owner attempts to modify a member row belonging to org B.
    const attempt = organizationService.updateMemberRole({
      organizationId: fixture.orgA,
      memberId: fixture.memberRowB,
      role: 'viewer',
      actorId: fixture.ownerA,
      actorRole: 'owner',
    });

    // 404 rather than 403: a 403 would confirm the member exists in another tenant.
    await expect(attempt).rejects.toBeInstanceOf(NotFoundError);
  });

  it('leaves the target member unchanged after a rejected cross-tenant attempt', async () => {
    await organizationService
      .updateMemberRole({
        organizationId: fixture.orgA,
        memberId: fixture.memberRowB,
        role: 'viewer',
        actorId: fixture.ownerA,
        actorRole: 'owner',
      })
      .catch(() => null);

    const target = await prisma.member.findUnique({
      where: { id: fixture.memberRowB },
      select: { role: true },
    });

    expect(target?.role).toBe('owner');
  });

  it("allows updating a member of the caller's own organization", async () => {
    const updated = await organizationService.updateMemberRole({
      organizationId: fixture.orgA,
      memberId: fixture.memberRowA,
      role: 'admin',
      actorId: fixture.ownerA,
      actorRole: 'owner',
    });

    expect(updated.role).toBe('admin');
  });
});

describe('updateMemberRole — privilege escalation', () => {
  it('prevents an admin from creating an owner', async () => {
    const attempt = organizationService.updateMemberRole({
      organizationId: fixture.orgA,
      memberId: fixture.memberRowA,
      role: 'owner',
      actorId: fixture.memberA,
      actorRole: 'admin',
    });

    await expect(attempt).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('prevents a member from changing any role', async () => {
    const attempt = organizationService.updateMemberRole({
      organizationId: fixture.orgA,
      memberId: fixture.memberRowA,
      role: 'admin',
      actorId: fixture.memberA,
      actorRole: 'member',
    });

    await expect(attempt).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('last owner protection', () => {
  it('refuses to demote the only owner', async () => {
    const ownerRow = await prisma.member.findFirstOrThrow({
      where: { organizationId: fixture.orgA, role: 'owner' },
      select: { id: true },
    });

    const attempt = organizationService.updateMemberRole({
      organizationId: fixture.orgA,
      memberId: ownerRow.id,
      role: 'admin',
      actorId: fixture.ownerA,
      actorRole: 'owner',
    });

    await expect(attempt).rejects.toBeInstanceOf(ConflictError);
  });

  it('allows demoting an owner once a second owner exists', async () => {
    await organizationService.updateMemberRole({
      organizationId: fixture.orgA,
      memberId: fixture.memberRowA,
      role: 'owner',
      actorId: fixture.ownerA,
      actorRole: 'owner',
    });

    const ownerRow = await prisma.member.findFirstOrThrow({
      where: { organizationId: fixture.orgA, userId: fixture.ownerA },
      select: { id: true },
    });

    const updated = await organizationService.updateMemberRole({
      organizationId: fixture.orgA,
      memberId: ownerRow.id,
      role: 'admin',
      actorId: fixture.ownerA,
      actorRole: 'owner',
    });

    expect(updated.role).toBe('admin');
  });

  it('refuses to remove the only owner', async () => {
    const ownerRow = await prisma.member.findFirstOrThrow({
      where: { organizationId: fixture.orgA, role: 'owner' },
      select: { id: true },
    });

    const attempt = organizationService.removeMember({
      organizationId: fixture.orgA,
      memberId: ownerRow.id,
      actorId: fixture.ownerA,
      actorRole: 'owner',
    });

    await expect(attempt).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('removeMember — cross-tenant', () => {
  it('rejects removing a member of another organization with 404', async () => {
    const attempt = organizationService.removeMember({
      organizationId: fixture.orgA,
      memberId: fixture.memberRowB,
      actorId: fixture.ownerA,
      actorRole: 'owner',
    });

    await expect(attempt).rejects.toBeInstanceOf(NotFoundError);

    // And the row survives.
    const survivor = await prisma.member.findUnique({
      where: { id: fixture.memberRowB },
      select: { id: true },
    });
    expect(survivor).not.toBeNull();
  });

  it('rejects removal by a role without member:remove', async () => {
    const attempt = organizationService.removeMember({
      organizationId: fixture.orgA,
      memberId: fixture.memberRowA,
      actorId: fixture.memberA,
      actorRole: 'member',
    });

    await expect(attempt).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('organization creation', () => {
  it('makes the creator an owner atomically', async () => {
    const userId = await createUser('atomic');

    const org = await organizationService.create({ userId, name: 'Atomic Ltd' });

    const membership = await prisma.member.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId } },
      select: { role: true },
    });

    expect(membership?.role).toBe('owner');

    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('generates a unique slug when names collide', async () => {
    const userId = await createUser('slug');

    const first = await organizationService.create({ userId, name: 'Duplicate Name' });
    const second = await organizationService.create({ userId, name: 'Duplicate Name' });

    expect(first.slug).not.toBe(second.slug);
    expect(second.slug).toMatch(/^duplicate-name-\d+$/);

    await prisma.organization.deleteMany({
      where: { id: { in: [first.id, second.id] } },
    });
    await prisma.user.delete({ where: { id: userId } });
  });
});
