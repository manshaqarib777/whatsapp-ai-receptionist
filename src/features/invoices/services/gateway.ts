import type {
  InvoiceRow,
  PaymentGateway,
  PaymentRow,
} from '@/features/invoices/repositories/invoices.repository';
import { UnprocessableError } from '@/lib/errors';

/**
 * The payment-gateway seam — Milestone 12 (AD-2).
 *
 * Narrow interface: create a checkout, verify a webhook signature, refund.
 * Adapters per provider behind it. A provider is added by implementing this
 * interface, never by extending a switch in the service (open/closed —
 * ARCHITECTURE_RULES.md §13).
 */

export interface PaymentGatewayAdapter {
  readonly gateway: PaymentGateway;
  /** Whether the gateway has real credentials configured. */
  readonly configured: boolean;
  /** Create a checkout/redirect surface for a payment. */
  createPayment(input: {
    invoice: InvoiceRow;
    amount: number;
    currency: string;
  }): Promise<{ checkoutUrl: string | null; gatewayPaymentId: string }>;
  /** Verify a webhook signature; throws when invalid. */
  verifyWebhook(payload: unknown, signature: string | null): boolean;
  refund(input: { payment: PaymentRow; amount: number; currency: string }): Promise<{
    gatewayRefundId: string;
  }>;
}

/** A gateway that is not yet configured — clear error, no silent no-op. */
export class UnconfiguredGateway implements PaymentGatewayAdapter {
  constructor(readonly gateway: PaymentGateway) {}

  readonly configured = false;

  async createPayment(): Promise<never> {
    throw new UnprocessableError(`${this.gateway} is not configured.`);
  }

  verifyWebhook(): boolean {
    return false;
  }

  async refund(): Promise<never> {
    throw new UnprocessableError(`${this.gateway} is not configured.`);
  }
}

/** The five gateways the PRD lists, in registration order. */
export const GATEWAYS: readonly PaymentGateway[] = [
  'stripe',
  'hyperpay',
  'paytabs',
  'stcpay',
  'applepay',
] as const;
