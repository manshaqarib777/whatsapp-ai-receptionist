import { forScope } from '@/lib/db/scoped-prisma';
import { resolveScope } from '@/server/scope';

import type { NotificationRow } from './dashboard.types';

/** User-specific notification reads, separated from the dashboard aggregation repo. */
export class DashboardNotificationsRepository {
  private readonly db: ReturnType<typeof forScope>;

  private constructor(organizationId: string) {
    this.db = forScope(resolveScope(organizationId));
  }

  static forOrganization(organizationId: string) {
    return new DashboardNotificationsRepository(organizationId);
  }

  async list(userId: string, limit = 20): Promise<NotificationRow[]> {
    return this.db.notification.findMany({
      where: { userId },
      orderBy: [{ readAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    });
  }
}
