import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { ReviewsService } from '@/features/reviews/services/reviews.service';
import { requestTransitionSchema } from '@/features/reviews/validators/reviews.validators';

/**
 * PATCH /api/reviews/requests/[id] — lifecycle transition: send or cancel
 * (`review:write`).
 */

type Params = { id: string };

export const PATCH = withApiHandler(
  'PATCH /api/reviews/requests/[id]',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('review:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = requestTransitionSchema.parse(body);

    const service = ReviewsService.forOrganization(organizationId);
    const reviewRequest = await service.transition(id, input.action);

    return jsonSuccess({ request: reviewRequest }, { correlationId });
  },
);
