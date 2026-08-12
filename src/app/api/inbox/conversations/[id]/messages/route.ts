import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { InboxService } from '@/features/inbox/services/inbox.service';
import { messagesQuerySchema, sendMessageSchema } from '@/features/inbox/validators/inbox.validators';

/**
 * GET  /api/inbox/conversations/[id]/messages?before=&limit= — cursor-paged history
 * POST /api/inbox/conversations/[id]/messages — send an agent reply
 *
 * Sending requires `conversation:write`; reading requires an active org.
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/inbox/conversations/[id]/messages',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const url = new URL(request.url);
    const input = messagesQuerySchema.parse(Object.fromEntries(url.searchParams));

    const service = InboxService.forOrganization(organizationId);
    const result = await service.listMessages(id, input.before);

    return jsonSuccess(result, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/inbox/conversations/[id]/messages',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { user, organizationId } = await requirePermission('conversation:write');
    const { id } = await routeParams.params;

    const body: unknown = await request.json();
    const input = sendMessageSchema.parse(body);

    const service = InboxService.forOrganization(organizationId);
    const message = await service.sendMessage({
      conversationId: id,
      authorId: user.id,
      body: input.body,
    });

    return jsonSuccess(message, { status: 201, correlationId });
  },
);
