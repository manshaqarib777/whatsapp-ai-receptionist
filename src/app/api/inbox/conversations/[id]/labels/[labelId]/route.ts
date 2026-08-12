import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { InboxService } from '@/features/inbox/services/inbox.service';

/**
 * DELETE /api/inbox/conversations/[id]/labels/[labelId] — detach a label
 */

type Params = { id: string; labelId: string };

export const DELETE = withApiHandler(
  'DELETE /api/inbox/conversations/[id]/labels/[labelId]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('conversation:write');
    const { id, labelId } = await routeParams.params;

    const service = InboxService.forOrganization(organizationId);
    await service.removeLabel(id, labelId);

    return jsonSuccess({ ok: true }, { correlationId });
  },
);
