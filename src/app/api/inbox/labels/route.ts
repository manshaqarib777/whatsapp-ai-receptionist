import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { InboxService } from '@/features/inbox/services/inbox.service';
import { createLabelSchema } from '@/features/inbox/validators/inbox.validators';

/**
 * GET  /api/inbox/labels — all org labels
 * POST /api/inbox/labels — create one (conversation:write)
 */

export const GET = withApiHandler(
  'GET /api/inbox/labels',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();

    const service = InboxService.forOrganization(organizationId);
    const labels = await service.listLabels();

    return jsonSuccess({ labels }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/inbox/labels',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('conversation:write');

    const body: unknown = await request.json();
    const input = createLabelSchema.parse(body);

    const service = InboxService.forOrganization(organizationId);
    const label = await service.createLabel(input.name, input.color);

    return jsonSuccess(label, { status: 201, correlationId });
  },
);
