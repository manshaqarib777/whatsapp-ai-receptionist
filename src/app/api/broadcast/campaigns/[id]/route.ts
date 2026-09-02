import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { BroadcastService } from '@/features/broadcast/services/broadcast.service';
import { campaignTransitionSchema } from '@/features/broadcast/validators/broadcast.validators';

/**
 * GET   /api/broadcast/campaigns/[id] — campaign + analytics (`broadcast:read`).
 * PATCH /api/broadcast/campaigns/[id] — lifecycle transition: schedule, send,
 *       or cancel (`broadcast:write`).
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/broadcast/campaigns/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const service = BroadcastService.forOrganization(organizationId);
    const [campaign, analytics, recipients] = await Promise.all([
      service.getCampaign(id),
      service.getAnalytics(id),
      service.listRecipients(id),
    ]);

    return jsonSuccess({ campaign, analytics, recipients }, { correlationId });
  },
);

export const PATCH = withApiHandler(
  'PATCH /api/broadcast/campaigns/[id]',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('broadcast:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = campaignTransitionSchema.parse(body);

    const service = BroadcastService.forOrganization(organizationId);
    const campaign = await service.transition(id, input.action, input.scheduledFor);

    return jsonSuccess({ campaign }, { correlationId });
  },
);
