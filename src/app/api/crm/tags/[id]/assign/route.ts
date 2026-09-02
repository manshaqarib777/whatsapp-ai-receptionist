import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { CrmService } from '@/features/crm/services/crm.service';
import { assignTagSchema } from '@/features/crm/validators/crm.validators';

/**
 * POST   /api/crm/tags/[id]/assign — tag a subject (`crm:write`).
 * DELETE /api/crm/tags/[id]/assign — untag a subject (`crm:write`).
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/crm/tags/[id]/assign',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('crm:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = assignTagSchema.parse(body);

    const service = CrmService.forOrganization(organizationId);
    await service.assignTag(id, input.taggableType, input.taggableId);

    return jsonSuccess({ ok: true }, { correlationId });
  },
);

export const DELETE = withApiHandler(
  'DELETE /api/crm/tags/[id]/assign',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('crm:write');
    const { id } = await routeParams.params;
    const input = assignTagSchema.parse(await request.json());

    const service = CrmService.forOrganization(organizationId);
    await service.removeTag(id, input.taggableType, input.taggableId);

    return jsonSuccess({ ok: true }, { correlationId });
  },
);
