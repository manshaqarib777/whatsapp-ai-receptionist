import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { BroadcastService } from '@/features/broadcast/services/broadcast.service';

/**
 * POST /api/broadcast/segments/[id]/preview — eligible contact count for a
 * segment, evaluated at call time (`broadcast:read`). The consent and
 * opted-out invariants are applied server-side, so the preview is exactly what
 * a send would materialise.
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/broadcast/segments/[id]/preview',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('broadcast:read');
    const { id } = await routeParams.params;

    const service = BroadcastService.forOrganization(organizationId);
    const count = await service.previewSegmentCount(id);

    return jsonSuccess({ count }, { correlationId });
  },
);
