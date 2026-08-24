import { requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { AiService } from '@/features/ai/services/ai.service';
import { addVersionSchema } from '@/features/ai/validators/ai.validators';

/**
 * POST /api/ai/templates/[id]/versions — add a draft version. `ai:manage`.
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/ai/templates/[id]/versions',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId, branchId } = await requireBranchPermission('ai:manage');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = addVersionSchema.parse(body);

    const service = AiService.forScope({ organizationId, branchId });
    const result = await service.addVersion(id, input.body);

    return jsonSuccess(result, { status: 201, correlationId });
  },
);
