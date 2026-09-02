import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { WorkflowsService } from '@/features/workflow-builder/services/workflows.service';
import { updateWorkflowSchema } from '@/features/workflow-builder/validators/workflows.validators';

/**
 * GET   /api/workflows/[id] — workflow + versions + runs (`workflow:read`).
 * PATCH /api/workflows/[id] — rename or enable/disable (`workflow:write`).
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/workflows/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const service = WorkflowsService.forOrganization(organizationId);
    const [workflow, versions, runs] = await Promise.all([
      service.getWorkflow(id),
      service.listVersions(id),
      service.listRuns(id),
    ]);

    return jsonSuccess({ workflow, versions, runs }, { correlationId });
  },
);

export const PATCH = withApiHandler(
  'PATCH /api/workflows/[id]',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('workflow:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = updateWorkflowSchema.parse(body);

    const service = WorkflowsService.forOrganization(organizationId);
    const workflow = await service.updateWorkflow(id, input);

    return jsonSuccess({ workflow }, { correlationId });
  },
);
