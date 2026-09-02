import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { LoyaltyService } from '@/features/loyalty/services/loyalty.service';
import { createReferralSchema } from '@/features/loyalty/validators/loyalty.validators';

/**
 * GET  /api/loyalty/referrals — referrals (`loyalty:read`).
 * POST /api/loyalty/referrals — create a referral (`loyalty:write`).
 */

export const GET = withApiHandler(
  'GET /api/loyalty/referrals',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();

    const service = LoyaltyService.forOrganization(organizationId);
    const referrals = await service.listReferrals();

    return jsonSuccess({ referrals }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/loyalty/referrals',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('loyalty:write');
    const body: unknown = await request.json();
    const input = createReferralSchema.parse(body);

    const service = LoyaltyService.forOrganization(organizationId);
    const referral = await service.createReferral(input);

    return jsonSuccess({ referral }, { status: 201, correlationId });
  },
);
