import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { WorkflowsService } from '@/features/workflow-builder/services/workflows.service';
import { createWorkflowSchema } from '@/features/workflow-builder/validators/workflows.validators';

/**
 * GET  /api/workflows — workflows (`workflow:read`).
 * POST /api/workflows — create a workflow (`workflow:write`).
 */

export const GET = withApiHandler(
  'GET /api/workflows',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();

    const service = WorkflowsService.forOrganization(organizationId);
    const workflows = await service.listWorkflows();

    return jsonSuccess({ workflows }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/workflows',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('workflow:write');
    const body: unknown = await request.json();
    const input = createWorkflowSchema.parse(body);

    const service = WorkflowsService.forOrganization(organizationId);
    const workflow = await service.createWorkflow(input);

    return jsonSuccess({ workflow }, { status: 201, correlationId });
  },
);
