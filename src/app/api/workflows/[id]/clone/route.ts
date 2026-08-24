import { WorkflowsService } from '@/features/workflow-builder/services/workflows.service';
import { cloneWorkflowSchema } from '@/features/workflow-builder/validators/workflows.validators';
import { jsonSuccess, type RouteParams, withApiHandler } from '@/server/api-handler';
import { requirePermission } from '@/server/auth-context';

type Params = { id: string };

/** POST /api/workflows/[id]/clone — create a disabled workflow from a saved definition. */
export const POST = withApiHandler(
  'POST /api/workflows/[id]/clone',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('workflow:write');
    const { id } = await routeParams.params;
    const input = cloneWorkflowSchema.parse(await request.json());
    const workflow = await WorkflowsService.forOrganization(organizationId).cloneWorkflow(
      id,
      input,
    );

    return jsonSuccess({ workflow }, { status: 201, correlationId });
  },
);
