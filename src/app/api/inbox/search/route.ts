import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { InboxService } from '@/features/inbox/services/inbox.service';
import { searchQuerySchema } from '@/features/inbox/validators/inbox.validators';

/**
 * GET /api/inbox/search?q=
 *
 * Searches message bodies + contact display names, org-scoped (trigram index,
 * AD-5).
 */

export const GET = withApiHandler(
  'GET /api/inbox/search',
  async (request, { correlationId }) => {
    const { organizationId } = await requireOrg();

    const url = new URL(request.url);
    const input = searchQuerySchema.parse(Object.fromEntries(url.searchParams));

    const service = InboxService.forOrganization(organizationId);
    const hits = await service.search(input.q);

    return jsonSuccess({ hits }, { correlationId });
  },
);
