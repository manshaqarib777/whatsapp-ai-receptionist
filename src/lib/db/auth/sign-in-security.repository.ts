import { prisma } from '@/lib/prisma';

export const signInSecurityRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, failedLoginAttempts: true, lockedUntil: true },
    });
  },

  async recordFailure(
    userId: string,
    failedLoginAttempts: number,
    lockedUntil: Date | null,
  ) {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts, lockedUntil },
    });
  },

  async clearFailures(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  },
};
