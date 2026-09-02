import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { ReviewsService } from '@/features/reviews/services/reviews.service';
import {
  createRequestSchema,
  requestStatusSchema,
} from '@/features/reviews/validators/reviews.validators';

/**
 * GET  /api/reviews/requests — review requests (`review:read`), optionally
 *      `?status=`.
 * POST /api/reviews/requests — create a review request (`review:write`).
 */

export const GET = withApiHandler(
  'GET /api/reviews/requests',
  async (request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(request.url);
    const query = requestStatusSchema.parse(searchParams.get('status') ?? undefined);

    const service = ReviewsService.forOrganization(organizationId);
    const requests = await service.listRequests(query === 'all' ? {} : { status: query });

    return jsonSuccess({ requests }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/reviews/requests',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('review:write');
    const body: unknown = await request.json();
    const input = createRequestSchema.parse(body);

    const service = ReviewsService.forOrganization(organizationId);
    const reviewRequest = await service.createRequest(input);

    return jsonSuccess({ request: reviewRequest }, { status: 201, correlationId });
  },
);
