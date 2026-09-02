import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { LoyaltyService } from '@/features/loyalty/services/loyalty.service';
import { accountTierSchema } from '@/features/loyalty/validators/loyalty.validators';

/**
 * GET /api/loyalty/accounts — loyalty accounts (`loyalty:read`), optionally
 *     filtered by `?tier=`.
 */

export const GET = withApiHandler(
  'GET /api/loyalty/accounts',
  async (request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(request.url);
    const query = accountTierSchema.parse(searchParams.get('tier') ?? undefined);

    const service = LoyaltyService.forOrganization(organizationId);
    const accounts = await service.listAccounts(query === 'all' ? {} : { tier: query });

    return jsonSuccess({ accounts }, { correlationId });
  },
);
