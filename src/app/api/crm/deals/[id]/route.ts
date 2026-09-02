import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { CrmService } from '@/features/crm/services/crm.service';
import {
  closeDealSchema,
  moveDealSchema,
  updateDealSchema,
} from '@/features/crm/validators/crm.validators';
import { UnprocessableError } from '@/lib/errors';

/**
 * GET   /api/crm/deals/[id] — deal detail + timeline (`crm:read`).
 * PATCH /api/crm/deals/[id] — move stage / update / close (`crm:write`).
 *
 * PATCH body shapes:
 * - `{ stageId }` to move between stages.
 * - `{ status: "won" | "lost" }` to close.
 * - `{ title?, valueAmount?, valueCurrency?, contactId?, companyId? }` to update.
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/crm/deals/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const service = CrmService.forOrganization(organizationId);
    const [deal, activities] = await Promise.all([
      service.getDeal(id),
      service.listActivities('deal', id),
    ]);

    return jsonSuccess({ deal, activities }, { correlationId });
  },
);

export const PATCH = withApiHandler(
  'PATCH /api/crm/deals/[id]',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('crm:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();

    const service = CrmService.forOrganization(organizationId);

    if (typeof body === 'object' && body !== null && 'stageId' in body) {
      const input = moveDealSchema.parse(body);
      const deal = await service.moveDealToStage(id, input.stageId);
      return jsonSuccess({ deal }, { correlationId });
    }

    if (typeof body === 'object' && body !== null && 'status' in body) {
      const input = closeDealSchema.parse(body);
      const deal = await service.closeDeal(id, input.status);
      return jsonSuccess({ deal }, { correlationId });
    }

    if (typeof body === 'object' && body !== null) {
      const input = updateDealSchema.parse(body);
      const deal = await service.updateDeal(id, input);
      return jsonSuccess({ deal }, { correlationId });
    }

    throw new UnprocessableError('Provide stageId, status, or deal fields to update.');
  },
);
