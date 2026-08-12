import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { InboxService } from '@/features/inbox/services/inbox.service';
import { updateConversationSchema } from '@/features/inbox/validators/inbox.validators';

/**
 * PATCH /api/inbox/conversations/[id]
 *
 * Updates assignee and/or pinned state. Requires `conversation:write`; assigning
 * to another user additionally requires `conversation:assign`.
 */

type Params = { id: string };

export const PATCH = withApiHandler(
  'PATCH /api/inbox/conversations/[id]',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { user, organizationId } = await requirePermission('conversation:write');
    const { id } = await routeParams.params;

    const body: unknown = await request.json();
    const input = updateConversationSchema.parse(body);

    if (input.assigneeId !== undefined && input.assigneeId !== user.id) {
      await requirePermission('conversation:assign');
    }

    const service = InboxService.forOrganization(organizationId);
    await service.updateConversation({
      conversationId: id,
      assigneeId: input.assigneeId,
      isPinned: input.isPinned,
    });

    return jsonSuccess({ ok: true }, { correlationId });
  },
);
