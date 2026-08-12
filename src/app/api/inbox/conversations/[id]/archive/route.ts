import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { InboxService } from '@/features/inbox/services/inbox.service';
import { archiveSchema } from '@/features/inbox/validators/inbox.validators';

/**
 * POST /api/inbox/conversations/[id]/archive  body: { archive: true | false }
 *
 * Toggles the conversation between its current status and `archived`. Requires
 * `conversation:write`.
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/inbox/conversations/[id]/archive',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('conversation:write');
    const { id } = await routeParams.params;

    const body: unknown = await request.json();
    const input = archiveSchema.parse(body);

    const service = InboxService.forOrganization(organizationId);
    await service.archiveConversation(id, input.archive);

    return jsonSuccess({ ok: true }, { correlationId });
  },
);
