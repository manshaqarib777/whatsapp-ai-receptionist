import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { processPaymentWebhook } from '@/features/invoices/services/webhook';

/**
 * POST /api/webhooks/payments/[gateway] — gateway webhook entry.
 *
 * NOT authenticated by session: gateways verify via their own signature
 * (Stripe's constructEvent with the webhook secret). The handler resolves the
 * org from the matched payment (gatewayPaymentId) and journals the event.
 * Idempotent by construction: the payment event journal's unique
 * `gatewayEventId` makes a retried webhook a no-op.
 *
 * Errors thrown here are mapped by `withApiHandler`: an invalid signature is a
 * 401/400, an unknown gateway is a 400.
 */

type Params = { gateway: string };

export const POST = withApiHandler(
  'POST /api/webhooks/payments/[gateway]',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { gateway } = await routeParams.params;
    const signature = request.headers.get('stripe-signature');
    const raw = await request.text();

    const received = await processPaymentWebhook(gateway, raw, signature);
    return jsonSuccess({ received }, { correlationId });
  },
);
