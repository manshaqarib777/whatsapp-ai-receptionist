import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { BroadcastService } from '@/features/broadcast/services/broadcast.service';
import {
  campaignsQuerySchema,
  createCampaignSchema,
} from '@/features/broadcast/validators/broadcast.validators';

/**
 * GET  /api/broadcast/campaigns — campaigns (`broadcast:read`), optionally
 *      filtered by `?status=`.
 * POST /api/broadcast/campaigns — create a campaign (`broadcast:write`).
 */

export const GET = withApiHandler(
  'GET /api/broadcast/campaigns',
  async (request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(request.url);
    const query = campaignsQuerySchema.parse({
      status: searchParams.get('status') ?? undefined,
    });

    const service = BroadcastService.forOrganization(organizationId);
    const campaigns = await service.listCampaigns(query);

    return jsonSuccess({ campaigns }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/broadcast/campaigns',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('broadcast:write');
    const body: unknown = await request.json();
    const input = createCampaignSchema.parse(body);

    const service = BroadcastService.forOrganization(organizationId);
    const campaign = await service.createCampaign(input);

    return jsonSuccess({ campaign }, { status: 201, correlationId });
  },
);
