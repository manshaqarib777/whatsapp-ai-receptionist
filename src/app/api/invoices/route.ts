import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { InvoicesService } from '@/features/invoices/services/invoices.service';
import {
  createInvoiceSchema,
  invoicesQuerySchema,
} from '@/features/invoices/validators/invoices.validators';

/**
 * GET  /api/invoices?status= — invoices (`invoice:read`).
 * POST /api/invoices — create a draft invoice (`invoice:write`).
 */

export const GET = withApiHandler(
  'GET /api/invoices',
  async (request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const url = new URL(request.url);
    const input = invoicesQuerySchema.parse(Object.fromEntries(url.searchParams));

    const service = InvoicesService.forOrganization(organizationId);
    const invoices = await service.listInvoices(input);

    return jsonSuccess({ invoices }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/invoices',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('invoice:write');
    const body: unknown = await request.json();
    const input = createInvoiceSchema.parse(body);

    const service = InvoicesService.forOrganization(organizationId);
    const invoice = await service.createInvoice(input);

    return jsonSuccess({ invoice }, { status: 201, correlationId });
  },
);
