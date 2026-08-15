import type {
  InvoicesRepository,
  PaymentGateway,
} from '@/features/invoices/repositories/invoices.repository';
import { UnprocessableError } from '@/lib/errors';

import { round4 } from './totals';
import type { PaymentGatewayAdapter } from './gateway';

/**
 * Gateway webhook processing — Milestone 12.
 *
 * Owns the webhook journal + reconciliation path: verify the signature, look
 * the payment up by the gateway id, append a `PaymentEvent` (idempotent via the
 * unique `gatewayEventId`), and advance the payment + invoice when it succeeds.
 * Kept out of InvoicesService so the orchestration class stays focused on the
 * request-driven surface.
 */

/**
 * Strip a webhook payload down to what the journal is allowed to hold. NEVER
 * card data — the schema forecloses a PAN to stay out of PCI scope, and this
 * function is the enforcement point.
 */
function sanitizeWebhookPayload(body: {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
}): Record<string, unknown> {
  const object = body.data?.object ?? {};
  // Whitelist non-card fields only: the gateway id, status, amount, currency,
  // and timestamps. Anything else (including any card/number fields a gateway
  // might echo) is dropped.
  const safe: Record<string, unknown> = {};
  for (const key of [
    'id',
    'status',
    'payment_status',
    'amount',
    'currency',
    'created',
    'paid_at',
  ]) {
    if (object[key] !== undefined) safe[key] = object[key];
  }
  return { type: body.type ?? 'unknown', object: safe };
}

/**
 * Gateway webhook entry. Verifies the signature, looks the payment up by the
 * gateway id, journals the event (idempotent), and advances the payment and
 * invoice when it succeeds. `payload` is the RAW body text — the adapter's
 * `verifyWebhook` needs it for signature verification.
 */
export async function processGatewayWebhook(
  repo: InvoicesRepository,
  adapters: ReadonlyMap<PaymentGateway, PaymentGatewayAdapter>,
  input: { gateway: PaymentGateway; signature: string | null; payload: string },
): Promise<{ received: boolean }> {
  const adapter = adapters.get(input.gateway);
  if (!adapter) throw new UnprocessableError('Unknown gateway.');
  if (!adapter.verifyWebhook(input.payload, input.signature)) {
    throw new UnprocessableError('Invalid webhook signature.');
  }

  // Stripe-shaped payload: { id, type, data: { object: { id, payment_status, amount } } }.
  const body = JSON.parse(input.payload) as {
    id?: string;
    type?: string;
    data?: { object?: { id?: string; payment_status?: string; amount?: number } };
  };
  const gatewayPaymentId = body.data?.object?.id;
  if (!gatewayPaymentId) return { received: true };

  const payment = await repo.getPaymentByGatewayId(gatewayPaymentId);
  if (!payment) return { received: true };

  const eventId = body.id ?? `${gatewayPaymentId}-${body.type ?? 'event'}`;
  const journaled = await repo.appendPaymentEvent({
    paymentId: payment.id,
    gatewayEventId: eventId,
    kind: body.type ?? 'unknown',
    payload: sanitizeWebhookPayload(body),
  });
  // A replayed event is a no-op.
  if (!journaled) return { received: true };

  if (
    body.type === 'checkout.session.completed' ||
    body.data?.object?.payment_status === 'paid'
  ) {
    await repo.setPaymentStatus(payment.id, 'succeeded', {
      capturedAt: new Date(),
    });
    await reconcileInvoice(repo, payment.invoiceId);
  }

  return { received: true };
}

/** Recompute the invoice's paid state from its succeeded payments. */
export async function reconcileInvoice(
  repo: InvoicesRepository,
  invoiceId: string,
): Promise<void> {
  const payments = await repo.listPayments(invoiceId);
  const paid = payments
    .filter((payment) => payment.status === 'succeeded')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const refunded = await totalRefunded(repo, invoiceId);
  const netPaid = Math.max(0, round4(paid - refunded));

  await repo.setAmountPaid(invoiceId, netPaid);

  const fresh = await repo.getInvoice(invoiceId);
  if (netPaid >= fresh.totalAmount - 0.0001) {
    await repo.setInvoiceStatus(invoiceId, 'paid', { paidAt: new Date() });
  } else if (netPaid > 0) {
    await repo.setInvoiceStatus(invoiceId, 'partially_paid');
  }
}

async function totalRefunded(
  repo: InvoicesRepository,
  invoiceId: string,
): Promise<number> {
  const payments = await repo.listPayments(invoiceId);
  let total = 0;
  for (const payment of payments) {
    const refunds = await repo.listRefunds(payment.id);
    total += refunds.reduce((sum, refund) => sum + refund.amount, 0);
  }
  return total;
}
