import { requireBranch } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { KnowledgeService } from '@/features/knowledge/services/knowledge.service';

/**
 * GET /api/knowledge/jobs/[id]
 *
 * Job status, polled by the UI after an upload. `knowledge:read`.
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/knowledge/jobs/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId, branchId } = await requireBranch();
    const { id } = await routeParams.params;
    const service = KnowledgeService.forScope({ organizationId, branchId });
    const job = await service.getJob(id);
    return jsonSuccess({ job }, { correlationId });
  },
);
