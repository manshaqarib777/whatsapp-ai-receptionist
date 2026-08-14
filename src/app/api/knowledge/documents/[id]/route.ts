import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { KnowledgeService } from '@/features/knowledge/services/knowledge.service';

/**
 * GET /api/knowledge/documents/[id]
 *
 * A document with its version timeline. `knowledge:read`.
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/knowledge/documents/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;
    const service = KnowledgeService.forOrganization(organizationId);
    const document = await service.getDocument(id);
    return jsonSuccess({ document }, { correlationId });
  },
);
