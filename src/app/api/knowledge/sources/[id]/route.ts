import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { KnowledgeService } from '@/features/knowledge/services/knowledge.service';

/**
 * GET /api/knowledge/sources/[id]
 *
 * A source with its documents. `knowledge:read`.
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/knowledge/sources/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;
    const service = KnowledgeService.forOrganization(organizationId);
    const source = await service.getSource(id);
    return jsonSuccess({ source }, { correlationId });
  },
);
