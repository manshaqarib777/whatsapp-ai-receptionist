import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AnalyticsService } from '@/features/analytics/services/analytics.service';
import { rangeToDates } from '@/features/analytics/lib/range';
import { analyticsQuerySchema } from '@/features/analytics/validators/analytics.validators';

/**
 * GET /api/analytics/revenue — revenue overview for a range (`analytics:read`).
 */

export const GET = withApiHandler(
  'GET /api/analytics/revenue',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('analytics:read');
    const { searchParams } = new URL(request.url);
    const query = analyticsQuerySchema.parse({
      range: searchParams.get('range') ?? undefined,
    });

    const service = AnalyticsService.forOrganization(organizationId);
    const revenue = await service.getRevenue(rangeToDates(query.range));

    return jsonSuccess({ revenue }, { correlationId });
  },
);
