import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { WorkflowsService } from '@/features/workflow-builder/services/workflows.service';

/**
 * POST /api/workflows/[id]/runs — start a manual (test) run against the
 * current version (`workflow:write`). Writes the run + step rows; delay nodes
 * land `pending` with a `scheduledFor`.
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/workflows/[id]/runs',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('workflow:write');
    const { id } = await routeParams.params;

    const service = WorkflowsService.forOrganization(organizationId);
    const result = await service.createRun({ workflowId: id });

    return jsonSuccess(result, { status: 201, correlationId });
  },
);
