import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { LoyaltyService } from '@/features/loyalty/services/loyalty.service';
import { redeemCouponSchema } from '@/features/loyalty/validators/loyalty.validators';

/**
 * POST /api/loyalty/coupons/[id]/redeem — redeem a coupon for a contact
 * (`loyalty:write`).
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/loyalty/coupons/[id]/redeem',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('loyalty:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = redeemCouponSchema.parse(body);

    const service = LoyaltyService.forOrganization(organizationId);
    const redemption = await service.redeemCoupon({ couponId: id, ...input });

    return jsonSuccess({ redemption }, { status: 201, correlationId });
  },
);
