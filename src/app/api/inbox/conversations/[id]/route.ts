import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { InboxService } from '@/features/inbox/services/inbox.service';
import { updateConversationSchema } from '@/features/inbox/validators/inbox.validators';
import * as organizationService from '@/features/auth/services/organization.service';
import { NotFoundError } from '@/lib/errors';

/**
 * GET  /api/inbox/conversations/[id] — the full thread (conversation, messages,
 * notes, summary, suggestions, typing), read by `useThread`.
 *
 * PATCH /api/inbox/conversations/[id]
 *
 * Updates assignee and/or pinned state. Requires `conversation:write`; assigning
 * to another user additionally requires `conversation:assign`.
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/inbox/conversations/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const service = InboxService.forOrganization(organizationId);
    const thread = await service.getThread(id);

    return jsonSuccess(thread, { correlationId });
  },
);

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

    if (input.assigneeId) {
      const members = await organizationService.listMembers(organizationId);
      if (!members.some((member) => member.userId === input.assigneeId)) {
        throw new NotFoundError('Organization member not found.');
      }
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
