import { NextResponse } from 'next/server';
import { requireOrg } from '@/server/auth-context';
import { withApiHandler, type RouteParams } from '@/server/api-handler';
import { InvoicesService } from '@/features/invoices/services/invoices.service';
import { renderInvoicePdf } from '@/features/invoices/services/pdf';

/**
 * GET /api/invoices/[id]/pdf — render the invoice as a PDF (`invoice:read`).
 *
 * Content-Disposition is inline so the browser previews it. Cross-tenant or
 * missing ids return 404.
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/invoices/[id]/pdf',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const service = InvoicesService.forOrganization(organizationId);
    const invoice = await service.getInvoice(id);
    const buffer = renderInvoicePdf(invoice);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="invoice-${invoice.number}.pdf"`,
        'x-correlation-id': correlationId,
      },
    });
  },
);
