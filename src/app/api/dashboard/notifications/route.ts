import { DashboardRepository } from '@/features/dashboard/repositories/dashboard.repository';
import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

/**
 * GET /api/dashboard/notifications — the current user's notifications.
 *
 * Read-only, org-scoped via the session, filtered to the current user. Feeds the
 * shell's notifications bell; unread first.
 */
export const GET = withApiHandler(
  'GET /api/dashboard/notifications',
  async (_request, { correlationId }) => {
    const { user, organizationId } = await requireOrg();

    const repo = DashboardRepository.forOrganization(organizationId);
    const notifications = await repo.listNotifications(user.id);

    return jsonSuccess({ notifications }, { correlationId });
  },
);
