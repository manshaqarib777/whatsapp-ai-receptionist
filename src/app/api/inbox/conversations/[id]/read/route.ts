import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { InboxService } from '@/features/inbox/services/inbox.service';

/**
 * POST /api/inbox/conversations/[id]/read
 *
 * Marks the conversation read for the current user (idempotent) and zeroes the
 * org-level unread counter. Called on thread open and after each poll sees new
 * inbound messages (AD-10).
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/inbox/conversations/[id]/read',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { user, organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const service = InboxService.forOrganization(organizationId);
    await service.markRead(id, user.id);

    return jsonSuccess({ ok: true }, { correlationId });
  },
);
