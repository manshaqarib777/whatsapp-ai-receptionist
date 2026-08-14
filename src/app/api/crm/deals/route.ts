import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { CrmService } from '@/features/crm/services/crm.service';
import {
  createDealSchema,
  dealsQuerySchema,
} from '@/features/crm/validators/crm.validators';

/**
 * GET  /api/crm/deals?stageId=&status= — deals (`crm:read`).
 * POST /api/crm/deals — create a deal/lead (`crm:write`).
 */

export const GET = withApiHandler(
  'GET /api/crm/deals',
  async (request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const url = new URL(request.url);
    const input = dealsQuerySchema.parse(Object.fromEntries(url.searchParams));

    const service = CrmService.forOrganization(organizationId);
    const deals = await service.listDeals(input);

    return jsonSuccess({ deals }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/crm/deals',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('crm:write');
    const body: unknown = await request.json();
    const input = createDealSchema.parse(body);

    const service = CrmService.forOrganization(organizationId);
    const deal = await service.createDeal(input);

    return jsonSuccess({ deal }, { status: 201, correlationId });
  },
);
