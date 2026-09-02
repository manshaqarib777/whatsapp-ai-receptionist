import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { InboxService } from '@/features/inbox/services/inbox.service';

/**
 * POST /api/inbox/conversations/[id]/typing
 *
 * Writes a TTL-expiring typing row for the current user (AD-10). The thread poll
 * reads live typing rows; expired rows self-clean on the next write.
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/inbox/conversations/[id]/typing',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { user, organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const service = InboxService.forOrganization(organizationId);
    await service.setTyping(id, user.id);

    return jsonSuccess({ ok: true }, { correlationId });
  },
);
