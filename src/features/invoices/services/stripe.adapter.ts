import type { PaymentGatewayAdapter } from '@/features/invoices/services/invoices.service';
import type { PaymentRow } from '@/features/invoices/repositories/invoices.repository';
import { env } from '@/lib/env';

/**
 * Stripe gateway adapter — Milestone 12.
 *
 * The first real adapter behind the payment seam. In M12 this runs in
 * TEST MODE: it reads `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` from the
 * validated env, creates checkout sessions, verifies webhook signatures, and
 * issues refunds via the Stripe API.
 *
 * When the keys are absent the adapter reports `configured: false`, and the
 * service refuses with a clear error instead of a silent no-op.
 */

type StripeLike = {
  checkout: {
    sessions: {
      create: (input: {
        mode: string;
        payment_method_types: string[];
        line_items: {
          price_data: {
            currency: string;
            product_data: { name: string };
            unit_amount: number;
          };
          quantity: number;
        }[];
        success_url: string;
        cancel_url: string;
        metadata: { paymentId?: string; invoiceNumber: string };
      }) => Promise<{ id: string; url: string | null }>;
    };
  };
  refunds: {
    create: (input: {
      payment_intent: string;
      amount?: number;
      reason?: string;
    }) => Promise<{ id: string }>;
  };
  webhooks: {
    constructEvent: (payload: string, signature: string, secret: string) => unknown;
  };
};

function loadStripe(): StripeLike | null {
  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  // Dynamic require so the SDK is only pulled when configured.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require('stripe') as unknown as new (key: string) => StripeLike;
  return new Stripe(secretKey);
}

export class StripePaymentAdapter implements PaymentGatewayAdapter {
  readonly gateway = 'stripe' as const;
  readonly configured: boolean;
  private readonly stripe: StripeLike | null;
  private readonly webhookSecret: string | null;

  constructor() {
    this.stripe = loadStripe();
    this.webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? null;
    this.configured = this.stripe !== null && this.webhookSecret !== null;
  }

  async createPayment(input: {
    invoice: { number: string };
    amount: number;
    currency: string;
  }): Promise<{
    checkoutUrl: string | null;
    gatewayPaymentId: string;
  }> {
    if (!this.stripe) throw new Error('Stripe is not configured.');
    // amount in the gateway's smallest unit (fils for SAR / cents).
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            product_data: { name: `Invoice ${input.invoice.number}` },
            unit_amount: Math.round(input.amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${env.APP_URL ?? env.NEXT_PUBLIC_APP_URL}/invoices/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL ?? env.NEXT_PUBLIC_APP_URL}/invoices`,
      metadata: { invoiceNumber: input.invoice.number },
    });
    return { checkoutUrl: session.url, gatewayPaymentId: session.id };
  }

  verifyWebhook(_payload: unknown, signature: string | null): boolean {
    if (!this.stripe || !this.webhookSecret || !signature) return false;
    try {
      // The service passes the raw body as a string when it can; constructEvent
      // needs the raw payload text + signature header.
      const raw = typeof _payload === 'string' ? _payload : JSON.stringify(_payload);
      this.stripe.webhooks.constructEvent(raw, signature, this.webhookSecret);
      return true;
    } catch {
      return false;
    }
  }

  async refund(input: {
    payment: PaymentRow;
    amount: number;
    currency: string;
  }): Promise<{
    gatewayRefundId: string;
  }> {
    if (!this.stripe) throw new Error('Stripe is not configured.');
    const refund = await this.stripe.refunds.create({
      payment_intent: input.payment.gatewayPaymentId,
      amount: Math.round(input.amount * 100),
    });
    return { gatewayRefundId: refund.id };
  }
}
