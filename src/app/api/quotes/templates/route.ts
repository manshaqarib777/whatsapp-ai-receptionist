import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { QuotationsService } from '@/features/quotations/services/quotations.service';
import { createTemplateSchema } from '@/features/quotations/validators/quotations.validators';

/**
 * GET  /api/quotes/templates — templates (`quote:read`).
 * POST /api/quotes/templates — create a template (`quote:write`).
 */

export const GET = withApiHandler(
  'GET /api/quotes/templates',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const service = QuotationsService.forOrganization(organizationId);
    const templates = await service.listTemplates();
    return jsonSuccess({ templates }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/quotes/templates',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('quote:write');
    const body: unknown = await request.json();
    const input = createTemplateSchema.parse(body);

    const service = QuotationsService.forOrganization(organizationId);
    const template = await service.createTemplate(input);

    return jsonSuccess({ template }, { status: 201, correlationId });
  },
);
