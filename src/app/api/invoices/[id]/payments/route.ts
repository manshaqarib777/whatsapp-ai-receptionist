import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { InvoicesService } from '@/features/invoices/services/invoices.service';
import { createPaymentSchema } from '@/features/invoices/validators/invoices.validators';

/**
 * POST /api/invoices/[id]/payments — record a payment against an invoice
 * (`invoice:write`). Creates a gateway checkout and a pending Payment row.
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/invoices/[id]/payments',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('invoice:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = createPaymentSchema.parse(body);

    const service = InvoicesService.forOrganization(organizationId);
    const payment = await service.createPayment({
      invoiceId: id,
      gateway: input.gateway,
      amount: input.amount,
      currency: input.currency,
    });

    return jsonSuccess({ payment }, { status: 201, correlationId });
  },
);
