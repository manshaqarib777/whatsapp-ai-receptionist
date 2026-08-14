import { requireOrg } from '@/server/auth-context';
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
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;
    const service = KnowledgeService.forOrganization(organizationId);
    const job = await service.getJob(id);
    return jsonSuccess({ job }, { correlationId });
  },
);
