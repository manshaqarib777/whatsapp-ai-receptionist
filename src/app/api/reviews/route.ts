import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { ReviewsService } from '@/features/reviews/services/reviews.service';
import {
  createReviewSchema,
  reviewStatusSchema,
} from '@/features/reviews/validators/reviews.validators';

/**
 * GET  /api/reviews — reviews (`review:read`), optionally `?status=needs-attention`.
 * POST /api/reviews — record a review (`review:write`).
 */

export const GET = withApiHandler(
  'GET /api/reviews',
  async (request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(request.url);
    const query = reviewStatusSchema.parse(searchParams.get('status') ?? undefined);

    const service = ReviewsService.forOrganization(organizationId);
    const reviews = await service.listReviews(query === 'all' ? {} : { status: query });

    return jsonSuccess({ reviews }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/reviews',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('review:write');
    const body: unknown = await request.json();
    const input = createReviewSchema.parse(body);

    const service = ReviewsService.forOrganization(organizationId);
    const review = await service.createReview(input);

    return jsonSuccess({ review }, { status: 201, correlationId });
  },
);
