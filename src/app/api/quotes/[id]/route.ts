import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { QuotationsService } from '@/features/quotations/services/quotations.service';
import {
  transitionSchema,
  updateQuoteSchema,
} from '@/features/quotations/validators/quotations.validators';

/**
 * GET   /api/quotes/[id] — quote detail + versions (`quote:read`).
 * PATCH /api/quotes/[id] — edit a draft, or transition status (`quote:write`).
 *
 * PATCH body shapes:
 * - `{ action: "send" | "accept" | "reject" | "expire" | "mark_draft" }`
 * - `{ lineItems?, contactId?, validUntil?, ... }` to edit a draft.
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/quotes/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const service = QuotationsService.forOrganization(organizationId);
    const [quote, versions] = await Promise.all([
      service.getQuote(id),
      service.listVersions(id),
    ]);

    return jsonSuccess({ quote, versions }, { correlationId });
  },
);

export const PATCH = withApiHandler(
  'PATCH /api/quotes/[id]',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('quote:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();

    const service = QuotationsService.forOrganization(organizationId);

    if (typeof body === 'object' && body !== null && 'action' in body) {
      const input = transitionSchema.parse(body);
      const quote = await service.transition(id, input.action);
      return jsonSuccess({ quote }, { correlationId });
    }

    const input = updateQuoteSchema.parse(body);
    const quote = await service.updateQuote(id, input);
    return jsonSuccess({ quote }, { correlationId });
  },
);
