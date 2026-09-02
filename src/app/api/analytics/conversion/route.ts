import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AnalyticsService } from '@/features/analytics/services/analytics.service';
import { rangeToDates } from '@/features/analytics/lib/range';
import { analyticsQuerySchema } from '@/features/analytics/validators/analytics.validators';

/**
 * GET /api/analytics/conversion — conversion rates (`analytics:read`).
 */

export const GET = withApiHandler(
  'GET /api/analytics/conversion',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('analytics:read');

    const service = AnalyticsService.forOrganization(organizationId);
    const query = analyticsQuerySchema.parse({
      range: new URL(request.url).searchParams.get('range') ?? undefined,
    });
    const conversion = await service.getConversion(rangeToDates(query.range));

    return jsonSuccess({ conversion }, { correlationId });
  },
);
