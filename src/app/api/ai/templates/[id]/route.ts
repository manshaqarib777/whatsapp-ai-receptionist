import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { AiService } from '@/features/ai/services/ai.service';

/**
 * GET /api/ai/templates/[id] — a template with its versions. `ai:read`.
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/ai/templates/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;
    const service = AiService.forOrganization(organizationId);
    const template = await service.getTemplate(id);
    return jsonSuccess({ template }, { correlationId });
  },
);
