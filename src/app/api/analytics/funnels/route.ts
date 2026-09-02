import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AnalyticsService } from '@/features/analytics/services/analytics.service';

/**
 * GET /api/analytics/funnels — pipeline + quote→invoice→paid funnels
 * (`analytics:read`).
 */

export const GET = withApiHandler(
  'GET /api/analytics/funnels',
  async (_request, { correlationId }) => {
    const { organizationId } = await requirePermission('analytics:read');

    const service = AnalyticsService.forOrganization(organizationId);
    const funnels = await service.getFunnels();

    return jsonSuccess({ funnels }, { correlationId });
  },
);
