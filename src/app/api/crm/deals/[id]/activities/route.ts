import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { CrmService } from '@/features/crm/services/crm.service';
import { createActivitySchema } from '@/features/crm/validators/crm.validators';

/**
 * POST /api/crm/deals/[id]/activities — add a note/call/email/meeting
 * (`crm:write`). The timeline is read through the deal detail route.
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/crm/deals/[id]/activities',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('crm:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = createActivitySchema.parse(body);

    const service = CrmService.forOrganization(organizationId);
    const activity = await service.addActivity('deal', id, input);

    return jsonSuccess({ activity }, { status: 201, correlationId });
  },
);
