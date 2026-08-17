import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { BroadcastService } from '@/features/broadcast/services/broadcast.service';

/**
 * POST /api/broadcast/campaigns/[id]/send — materialise the recipients from
 * the segment evaluation and start the send (`broadcast:write`). A campaign
 * with zero eligible recipients is refused (422).
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/broadcast/campaigns/[id]/send',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('broadcast:write');
    const { id } = await routeParams.params;

    const service = BroadcastService.forOrganization(organizationId);
    const campaign = await service.materialiseAndSend(id);

    return jsonSuccess({ campaign }, { correlationId });
  },
);
