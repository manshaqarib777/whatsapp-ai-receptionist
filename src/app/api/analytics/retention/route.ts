import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AnalyticsService } from '@/features/analytics/services/analytics.service';
import { rangeToDates } from '@/features/analytics/lib/range';
import { analyticsQuerySchema } from '@/features/analytics/validators/analytics.validators';

/**
 * GET /api/analytics/retention — lifecycle + cohort retention (`analytics:read`).
 */

export const GET = withApiHandler(
  'GET /api/analytics/retention',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('analytics:read');
    const { searchParams } = new URL(request.url);
    const query = analyticsQuerySchema.parse({
      range: searchParams.get('range') ?? undefined,
    });

    const service = AnalyticsService.forOrganization(organizationId);
    const retention = await service.getRetention(rangeToDates(query.range));

    return jsonSuccess({ retention }, { correlationId });
  },
);
