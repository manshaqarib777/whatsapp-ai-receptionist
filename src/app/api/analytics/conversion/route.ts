import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AnalyticsService } from '@/features/analytics/services/analytics.service';

/**
 * GET /api/analytics/conversion — conversion rates (`analytics:read`).
 */

export const GET = withApiHandler(
  'GET /api/analytics/conversion',
  async (_request, { correlationId }) => {
    const { organizationId } = await requirePermission('analytics:read');

    const service = AnalyticsService.forOrganization(organizationId);
    const conversion = await service.getConversion();

    return jsonSuccess({ conversion }, { correlationId });
  },
);
