import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AnalyticsService } from '@/features/analytics/services/analytics.service';
import { rangeToDates } from '@/features/analytics/lib/range';
import { analyticsQuerySchema } from '@/features/analytics/validators/analytics.validators';

/**
 * GET /api/analytics/performance — conversations, response time, escalation,
 * workload, and campaign delivery (`analytics:read`).
 */

export const GET = withApiHandler(
  'GET /api/analytics/performance',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('analytics:read');
    const { searchParams } = new URL(request.url);
    const query = analyticsQuerySchema.parse({
      range: searchParams.get('range') ?? undefined,
    });

    const service = AnalyticsService.forOrganization(organizationId);
    const performance = await service.getPerformance(rangeToDates(query.range));

    return jsonSuccess({ performance }, { correlationId });
  },
);
