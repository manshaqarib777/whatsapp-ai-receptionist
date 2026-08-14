import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { CrmService } from '@/features/crm/services/crm.service';
import { updateTaskSchema } from '@/features/crm/validators/crm.validators';

/**
 * PATCH /api/crm/tasks/[id] — update/complete a task (`crm:write`).
 */

type Params = { id: string };

export const PATCH = withApiHandler(
  'PATCH /api/crm/tasks/[id]',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('crm:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = updateTaskSchema.parse(body);

    const service = CrmService.forOrganization(organizationId);
    const task = await service.updateTaskStatus(id, input.status);

    return jsonSuccess({ task }, { correlationId });
  },
);
