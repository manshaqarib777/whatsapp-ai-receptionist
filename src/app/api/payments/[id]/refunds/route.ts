import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { InvoicesService } from '@/features/invoices/services/invoices.service';
import { createRefundSchema } from '@/features/invoices/validators/invoices.validators';

/**
 * POST /api/payments/[id]/refunds — refund a succeeded payment
 * (`invoice:write`).
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/payments/[id]/refunds',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('invoice:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = createRefundSchema.parse(body);

    const service = InvoicesService.forOrganization(organizationId);
    const refund = await service.refundPayment({
      paymentId: id,
      amount: input.amount,
      reason: input.reason,
    });

    return jsonSuccess({ refund }, { status: 201, correlationId });
  },
);
