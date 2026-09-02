import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { CrmService } from '@/features/crm/services/crm.service';
import { createPipelineSchema } from '@/features/crm/validators/crm.validators';

/**
 * GET /api/crm/pipelines — pipelines + stages (`crm:read`).
 * POST /api/crm/pipelines — create a pipeline (`crm:write`).
 */

export const GET = withApiHandler(
  'GET /api/crm/pipelines',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const service = CrmService.forOrganization(organizationId);
    const pipelines = await service.listPipelines();
    return jsonSuccess({ pipelines }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/crm/pipelines',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('crm:write');
    const body: unknown = await request.json();
    const input = createPipelineSchema.parse(body);

    const service = CrmService.forOrganization(organizationId);
    const pipeline = await service.createPipeline(input);

    return jsonSuccess({ pipeline }, { status: 201, correlationId });
  },
);
