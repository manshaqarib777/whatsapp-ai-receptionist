import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { InboxService } from '@/features/inbox/services/inbox.service';
import { inboxListQuerySchema } from '@/features/inbox/validators/inbox.validators';

/**
 * GET /api/inbox/conversations?status=&assignee=&labelId=&pinned=&q=&cursor=&limit=
 *
 * The conversation list for the active org, cursor-paginated and filterable.
 * Read by the inbox list (AD-3, AD-9).
 */

export const GET = withApiHandler(
  'GET /api/inbox/conversations',
  async (request, { correlationId }) => {
    const { organizationId } = await requireOrg();

    const url = new URL(request.url);
    const input = inboxListQuerySchema.parse(Object.fromEntries(url.searchParams));

    const service = InboxService.forOrganization(organizationId);
    const result = await service.listConversations(input);

    return jsonSuccess(result, { correlationId });
  },
);
