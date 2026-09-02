import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { CrmService } from '@/features/crm/services/crm.service';
import { createTagSchema } from '@/features/crm/validators/crm.validators';

/**
 * GET  /api/crm/tags — tags (`crm:read`).
 * POST /api/crm/tags — create a tag (`crm:write`).
 */

export const GET = withApiHandler(
  'GET /api/crm/tags',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const service = CrmService.forOrganization(organizationId);
    const tags = await service.listTags();
    return jsonSuccess({ tags }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/crm/tags',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('crm:write');
    const body: unknown = await request.json();
    const input = createTagSchema.parse(body);

    const service = CrmService.forOrganization(organizationId);
    const tag = await service.createTag(input);

    return jsonSuccess({ tag }, { status: 201, correlationId });
  },
);
