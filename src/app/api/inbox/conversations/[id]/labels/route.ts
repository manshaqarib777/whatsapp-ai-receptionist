import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { InboxService } from '@/features/inbox/services/inbox.service';
import { addLabelSchema } from '@/features/inbox/validators/inbox.validators';

/**
 * POST /api/inbox/conversations/[id]/labels — attach a label
 * (DELETE lives in labels/[labelId]/route.ts)
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/inbox/conversations/[id]/labels',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('conversation:write');
    const { id } = await routeParams.params;

    const body: unknown = await request.json();
    const input = addLabelSchema.parse(body);

    const service = InboxService.forOrganization(organizationId);
    await service.addLabel(id, input.labelId);

    return jsonSuccess({ ok: true }, { correlationId });
  },
);
