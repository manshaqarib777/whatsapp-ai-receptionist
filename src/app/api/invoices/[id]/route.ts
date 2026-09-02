import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { InvoicesService } from '@/features/invoices/services/invoices.service';
import {
  invoiceTransitionSchema,
  updateInvoiceSchema,
} from '@/features/invoices/validators/invoices.validators';

/**
 * GET   /api/invoices/[id] — invoice detail + payments + refunds (`invoice:read`).
 * PATCH /api/invoices/[id] — transition status, or edit a draft (`invoice:write`).
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/invoices/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const service = InvoicesService.forOrganization(organizationId);
    const [invoice, payments] = await Promise.all([
      service.getInvoice(id),
      service.listPayments(id),
    ]);
    const refunds = (
      await Promise.all(payments.map((payment) => service.listRefunds(payment.id)))
    ).flat();

    return jsonSuccess({ invoice, payments, refunds }, { correlationId });
  },
);

export const PATCH = withApiHandler(
  'PATCH /api/invoices/[id]',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('invoice:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();

    const service = InvoicesService.forOrganization(organizationId);

    if (typeof body === 'object' && body !== null && 'action' in body) {
      const input = invoiceTransitionSchema.parse(body);
      const invoice = await service.transition(id, input.action);
      return jsonSuccess({ invoice }, { correlationId });
    }

    const input = updateInvoiceSchema.parse(body);
    const invoice = await service.updateInvoice(id, input);
    return jsonSuccess({ invoice }, { correlationId });
  },
);
