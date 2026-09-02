import { prisma } from '@/lib/prisma';

const ORGANIZATION_SELECT = {
  id: true,
  name: true,
  slug: true,
  logo: true,
} as const;

const MEMBER_SELECT = {
  id: true,
  role: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, image: true } },
} as const;

/** Auth tenancy persistence. Business decisions remain in the service layer. */
export const organizationsRepository = {
  listForUser(userId: string) {
    return prisma.member.findMany({
      where: { userId, organization: { deletedAt: null } },
      select: {
        role: true,
        organization: {
          select: { ...ORGANIZATION_SELECT, _count: { select: { members: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async slugExists(slug: string): Promise<boolean> {
    return (
      (await prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      })) !== null
    );
  },

  /** Organization, owner, and current-schema default branch are one invariant. */
  createWithOwner(input: { userId: string; name: string; slug: string }) {
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: input.name, slug: input.slug },
        select: ORGANIZATION_SELECT,
      });
      await tx.member.create({
        data: { organizationId: organization.id, userId: input.userId, role: 'owner' },
      });
      await tx.branch.create({
        data: {
          organizationId: organization.id,
          name: 'Main',
          slug: 'main',
          timezone: 'Asia/Riyadh',
          isDefault: true,
        },
      });
      return organization;
    });
  },

  async membershipRole(organizationId: string, userId: string): Promise<string | null> {
    const membership = await prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    return membership?.role ?? null;
  },

  listMembers(organizationId: string) {
    return prisma.member.findMany({
      where: { organizationId },
      select: MEMBER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  },

  findMember(memberId: string) {
    return prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        role: true,
        organizationId: true,
        userId: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
  },

  countOwners(organizationId: string) {
    return prisma.member.count({ where: { organizationId, role: 'owner' } });
  },

  updateMemberRole(memberId: string, role: string) {
    return prisma.member.update({
      where: { id: memberId },
      data: { role },
      select: MEMBER_SELECT,
    });
  },

  async removeMember(memberId: string): Promise<void> {
    await prisma.member.delete({ where: { id: memberId } });
  },
};
