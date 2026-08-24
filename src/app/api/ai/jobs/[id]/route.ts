import { requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { AiTurnJobsRepository } from '@/features/ai/repositories/turn-jobs.repository';
import { resolveBranchScope } from '@/server/scope';

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/ai/jobs/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId, branchId } = await requireBranchPermission('ai:read');
    const { id } = await routeParams.params;
    const job = await new AiTurnJobsRepository(
      resolveBranchScope(organizationId, branchId),
    ).get(id);
    return jsonSuccess({ job }, { correlationId });
  },
);
