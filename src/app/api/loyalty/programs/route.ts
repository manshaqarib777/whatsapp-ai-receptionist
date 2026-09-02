import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { LoyaltyService } from '@/features/loyalty/services/loyalty.service';
import { createProgramSchema } from '@/features/loyalty/validators/loyalty.validators';

/**
 * GET  /api/loyalty/programs — loyalty programs (`loyalty:read`).
 * POST /api/loyalty/programs — create a program (`loyalty:write`).
 */

export const GET = withApiHandler(
  'GET /api/loyalty/programs',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();

    const service = LoyaltyService.forOrganization(organizationId);
    const programs = await service.listPrograms();

    return jsonSuccess({ programs }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/loyalty/programs',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('loyalty:write');
    const body: unknown = await request.json();
    const input = createProgramSchema.parse(body);

    const service = LoyaltyService.forOrganization(organizationId);
    const program = await service.createProgram(input);

    return jsonSuccess({ program }, { status: 201, correlationId });
  },
);
