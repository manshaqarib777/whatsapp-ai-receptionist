import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/** Append-only audit persistence: deliberately exposes no update or delete method. */
export const auditLogsRepository = {
  async create(data: Prisma.AuditLogUncheckedCreateInput): Promise<void> {
    await prisma.auditLog.create({ data });
  },

  list(organizationId: string, options: { limit: number; cursor?: string }) {
    return prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        actorId: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        metadata: true,
      },
    });
  },
};
