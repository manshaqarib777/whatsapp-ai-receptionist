import { randomUUID } from 'node:crypto';

import type {
  InvoiceRow,
  InvoicesRepository,
} from '@/features/invoices/repositories/invoices.repository';
import { ConflictError, UnprocessableError } from '@/lib/errors';
import { reconcileInvoice } from '@/features/invoices/services/webhook.processor';

export type InvoiceAction = 'issue' | 'void' | 'mark_paid';

export async function transitionInvoice(
  repo: InvoicesRepository,
  id: string,
  action: InvoiceAction,
): Promise<InvoiceRow> {
  const invoice = await repo.getInvoice(id);
  const now = new Date();

  if (action === 'issue') {
    if (invoice.status !== 'draft') {
      throw new ConflictError('Only a draft invoice can be issued.');
    }
    return repo.setInvoiceStatus(id, 'issued', { issuedAt: now });
  }
  if (action === 'void') {
    if (invoice.status === 'paid' || invoice.status === 'void') {
      throw new ConflictError('A paid or void invoice cannot be voided.');
    }
    return repo.setInvoiceStatus(id, 'void');
  }
  if (action === 'mark_paid') {
    if (invoice.status === 'void') {
      throw new ConflictError('A void invoice cannot be marked paid.');
    }
    const remaining = Math.max(0, invoice.totalAmount - invoice.amountPaid);
    if (remaining > 0) {
      await repo.createPayment({
        invoiceId: id,
        gateway: 'manual',
        gatewayPaymentId: `manual-${randomUUID()}`,
        amount: remaining,
        currency: invoice.currency,
        status: 'succeeded',
        capturedAt: now,
      });
    }
    await reconcileInvoice(repo, id);
    return repo.getInvoice(id);
  }
  throw new UnprocessableError('Unknown transition.');
}
