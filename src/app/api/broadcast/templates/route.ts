import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { BroadcastService } from '@/features/broadcast/services/broadcast.service';
import { createTemplateSchema } from '@/features/broadcast/validators/broadcast.validators';

/**
 * GET  /api/broadcast/templates — WhatsApp message templates (`broadcast:read`).
 * POST /api/broadcast/templates — create a template (`broadcast:write`).
 */

export const GET = withApiHandler(
  'GET /api/broadcast/templates',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();

    const service = BroadcastService.forOrganization(organizationId);
    const templates = await service.listTemplates();

    return jsonSuccess({ templates }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/broadcast/templates',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('broadcast:write');
    const body: unknown = await request.json();
    const input = createTemplateSchema.parse(body);

    const service = BroadcastService.forOrganization(organizationId);
    const template = await service.createTemplate(input);

    return jsonSuccess({ template }, { status: 201, correlationId });
  },
);
