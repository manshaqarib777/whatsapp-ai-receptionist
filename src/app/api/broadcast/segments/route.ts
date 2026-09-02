import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { BroadcastService } from '@/features/broadcast/services/broadcast.service';
import { createSegmentSchema } from '@/features/broadcast/validators/broadcast.validators';

/**
 * GET  /api/broadcast/segments — segments (`broadcast:read`).
 * POST /api/broadcast/segments — create a segment (`broadcast:write`).
 */

export const GET = withApiHandler(
  'GET /api/broadcast/segments',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();

    const service = BroadcastService.forOrganization(organizationId);
    const segments = await service.listSegments();

    return jsonSuccess({ segments }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/broadcast/segments',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('broadcast:write');
    const body: unknown = await request.json();
    const input = createSegmentSchema.parse(body);

    const service = BroadcastService.forOrganization(organizationId);
    const segment = await service.createSegment(input);

    return jsonSuccess({ segment }, { status: 201, correlationId });
  },
);
