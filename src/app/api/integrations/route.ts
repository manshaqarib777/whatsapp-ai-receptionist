import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import * as integrations from '@/features/integrations/services/integrations.service';

export const GET = withApiHandler(
  'GET /api/integrations',
  async (_request, { correlationId }) => {
    const { organizationId } = await requirePermission('settings:read');
    return jsonSuccess(
      { integrations: await integrations.list(organizationId) },
      { correlationId },
    );
  },
);
