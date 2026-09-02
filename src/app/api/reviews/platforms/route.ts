import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { ReviewsService } from '@/features/reviews/services/reviews.service';

/**
 * GET /api/reviews/platforms — review platforms with connection state
 * (`review:read`).
 */

export const GET = withApiHandler(
  'GET /api/reviews/platforms',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();

    const service = ReviewsService.forOrganization(organizationId);
    await service.ensurePlatforms();
    const platforms = await service.listPlatforms();

    return jsonSuccess({ platforms }, { correlationId });
  },
);
