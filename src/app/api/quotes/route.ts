import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { QuotationsService } from '@/features/quotations/services/quotations.service';
import {
  createQuoteSchema,
  quotesQuerySchema,
} from '@/features/quotations/validators/quotations.validators';

/**
 * GET  /api/quotes?status= — quotes (`quote:read`).
 * POST /api/quotes — create a draft quote (`quote:write`).
 */

export const GET = withApiHandler(
  'GET /api/quotes',
  async (request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const url = new URL(request.url);
    const input = quotesQuerySchema.parse(Object.fromEntries(url.searchParams));

    const service = QuotationsService.forOrganization(organizationId);
    const quotes = await service.listQuotes(input);

    return jsonSuccess({ quotes }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/quotes',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('quote:write');
    const body: unknown = await request.json();
    const input = createQuoteSchema.parse(body);

    const service = QuotationsService.forOrganization(organizationId);
    const quote = await service.createQuote(input);

    return jsonSuccess({ quote }, { status: 201, correlationId });
  },
);
