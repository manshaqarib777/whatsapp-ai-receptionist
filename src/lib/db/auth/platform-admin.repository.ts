import { prisma } from '@/lib/prisma';

/** Identity-level authority read. Tenant membership is deliberately irrelevant. */
export const platformAdminRepository = {
  async isOperator(userId: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: { id: userId, platformRole: 'operator', deletedAt: null },
      select: { id: true },
    });
    return Boolean(user);
  },
};
