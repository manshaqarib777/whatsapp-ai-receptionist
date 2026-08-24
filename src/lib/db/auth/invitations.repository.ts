import { prisma } from '@/lib/prisma';

export const invitationsRepository = {
  findScope(id: string) {
    return prisma.invitation.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });
  },
};
