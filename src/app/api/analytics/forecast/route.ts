import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AnalyticsService } from '@/features/analytics/services/analytics.service';

/**
 * GET /api/analytics/forecast — weighted pipeline forecast + projection
 * (`analytics:read`).
 */

export const GET = withApiHandler(
  'GET /api/analytics/forecast',
  async (_request, { correlationId }) => {
    const { organizationId } = await requirePermission('analytics:read');

    const service = AnalyticsService.forOrganization(organizationId);
    const forecast = await service.getForecast();

    return jsonSuccess({ forecast }, { correlationId });
  },
);
