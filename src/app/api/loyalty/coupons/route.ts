import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { LoyaltyService } from '@/features/loyalty/services/loyalty.service';
import { createCouponSchema } from '@/features/loyalty/validators/loyalty.validators';

/**
 * GET  /api/loyalty/coupons — coupons (`loyalty:read`).
 * POST /api/loyalty/coupons — create a coupon (`loyalty:write`).
 */

export const GET = withApiHandler(
  'GET /api/loyalty/coupons',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();

    const service = LoyaltyService.forOrganization(organizationId);
    const coupons = await service.listCoupons();

    return jsonSuccess({ coupons }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/loyalty/coupons',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('loyalty:write');
    const body: unknown = await request.json();
    const input = createCouponSchema.parse(body);

    const service = LoyaltyService.forOrganization(organizationId);
    const coupon = await service.createCoupon(input);

    return jsonSuccess({ coupon }, { status: 201, correlationId });
  },
);
