import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { WorkflowsService } from '@/features/workflow-builder/services/workflows.service';
import { saveVersionSchema } from '@/features/workflow-builder/validators/workflows.validators';

/**
 * POST /api/workflows/[id]/versions — save a new immutable version of the
 * workflow graph (`workflow:write`). The definition is validated server-side;
 * an invalid graph is a 409.
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/workflows/[id]/versions',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('workflow:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = saveVersionSchema.parse(body);

    const service = WorkflowsService.forOrganization(organizationId);
    const version = await service.saveVersion({
      workflowId: id,
      definition: input.definition,
      triggerKind: input.triggerKind,
    });

    return jsonSuccess({ version }, { status: 201, correlationId });
  },
);
