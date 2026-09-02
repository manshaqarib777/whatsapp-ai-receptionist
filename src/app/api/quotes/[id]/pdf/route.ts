import { NextResponse } from 'next/server';
import { requireOrg } from '@/server/auth-context';
import { withApiHandler, type RouteParams } from '@/server/api-handler';
import { QuotationsService } from '@/features/quotations/services/quotations.service';
import { renderQuotePdf } from '@/features/quotations/services/pdf';

/**
 * GET /api/quotes/[id]/pdf — render the quote as a PDF (`quote:read`).
 *
 * Content-Disposition is inline so the browser previews it; a download link can
 * add `?download=1`. Cross-tenant or missing ids return 404.
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/quotes/[id]/pdf',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const service = QuotationsService.forOrganization(organizationId);
    const quote = await service.getQuote(id);
    const templates = await service.listTemplates();
    const template = templates.find((t) => t.id === quote.templateId);
    const buffer = renderQuotePdf(quote, template?.branding ?? null);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="quote-${quote.number}.pdf"`,
        'x-correlation-id': correlationId,
      },
    });
  },
);
