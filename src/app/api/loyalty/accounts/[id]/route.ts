import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { LoyaltyService } from '@/features/loyalty/services/loyalty.service';
import { redeemSchema } from '@/features/loyalty/validators/loyalty.validators';

/**
 * GET  /api/loyalty/accounts/[id] — account + transaction history
 *      (`loyalty:read`).
 * POST /api/loyalty/accounts/[id]/redeem — redeem points (`loyalty:write`).
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/loyalty/accounts/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const service = LoyaltyService.forOrganization(organizationId);
    const [account, transactions] = await Promise.all([
      service.getAccount(id),
      service.listTransactions(id),
    ]);

    return jsonSuccess({ account, transactions }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/loyalty/accounts/[id]/redeem',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('loyalty:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = redeemSchema.parse(body);

    const service = LoyaltyService.forOrganization(organizationId);
    const result = await service.redeem({ accountId: id, ...input });

    return jsonSuccess(result, { correlationId });
  },
);
