import { prisma } from '@/lib/prisma';

const BRANCH_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  slug: true,
  timezone: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Trusted auth persistence for branch administration and session selection. */
export const branchesRepository = {
  list(organizationId: string) {
    return prisma.branch.findMany({
      where: { organizationId, deletedAt: null },
      select: BRANCH_SELECT,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  },

  find(organizationId: string, id: string) {
    return prisma.branch.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: BRANCH_SELECT,
    });
  },

  slugExists(organizationId: string, slug: string, exceptId?: string) {
    return prisma.branch.findFirst({
      where: {
        organizationId,
        slug,
        deletedAt: null,
        id: exceptId ? { not: exceptId } : undefined,
      },
      select: { id: true },
    });
  },

  create(input: {
    organizationId: string;
    name: string;
    slug: string;
    timezone: string;
  }) {
    return prisma.branch.create({ data: input, select: BRANCH_SELECT });
  },

  async update(
    organizationId: string,
    id: string,
    data: { name?: string; slug?: string; timezone?: string },
  ) {
    const result = await prisma.branch.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count === 0) return null;
    return this.find(organizationId, id);
  },

  async setDefault(organizationId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!branch) return null;
      await tx.branch.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
      return tx.branch.update({
        where: { id },
        data: { isDefault: true },
        select: BRANCH_SELECT,
      });
    });
  },

  async resolveForSession(sessionId: string, organizationId: string) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.session.findFirst({
        where: { id: sessionId, activeOrganizationId: organizationId },
        select: { activeBranchId: true },
      });
      if (!session) return null;
      const selected = session.activeBranchId
        ? await tx.branch.findFirst({
            where: { id: session.activeBranchId, organizationId, deletedAt: null },
            select: BRANCH_SELECT,
          })
        : null;
      if (selected) return selected;
      const fallback = await tx.branch.findFirst({
        where: { organizationId, deletedAt: null },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: BRANCH_SELECT,
      });
      if (fallback) {
        await tx.session.updateMany({
          where: { id: sessionId },
          data: { activeBranchId: fallback.id },
        });
      }
      return fallback;
    });
  },

  async switchSession(sessionId: string, organizationId: string, branchId?: string) {
    return prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          ...(branchId ? { id: branchId } : { isDefault: true }),
        },
        orderBy: { createdAt: 'asc' },
        select: BRANCH_SELECT,
      });
      if (!branch) return null;
      const updated = await tx.session.updateMany({
        where: { id: sessionId, activeOrganizationId: organizationId },
        data: { activeBranchId: branch.id },
      });
      return updated.count === 1 ? branch : null;
    });
  },

  /** Atomically moves both trusted tenancy selectors to a target organization. */
  async switchOrganizationSession(sessionId: string, organizationId: string) {
    return prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { organizationId, deletedAt: null, isDefault: true },
        orderBy: { createdAt: 'asc' },
        select: BRANCH_SELECT,
      });
      if (!branch) return null;
      const updated = await tx.session.updateMany({
        where: { id: sessionId },
        data: { activeOrganizationId: organizationId, activeBranchId: branch.id },
      });
      return updated.count === 1 ? branch : null;
    });
  },
};
