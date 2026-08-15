import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { InvoicesBaseRepository } from './invoices.base';
import { toPaymentRow } from './invoices.mappers';
import type { PaymentGateway, PaymentRow, PaymentStatus } from './invoices.types';

/** Prisma's accepted Json input shape (string | number | boolean | objects/arrays). */
type PrismaJsonValue =
  | string
  | number
  | boolean
  | PrismaJsonValue[]
  | { [key: string]: PrismaJsonValue | null };

const PAYMENT_SELECT = {
  id: true,
  invoiceId: true,
  gateway: true,
  gatewayPaymentId: true,
  amount: true,
  currency: true,
  status: true,
  capturedAt: true,
  createdAt: true,
} as const;

/**
 * Payment + payment-event data access.
 *
 * Payments carry the unique `gatewayPaymentId` idempotency key; the webhook
 * journal's unique `gatewayEventId` makes a retried webhook structurally a
 * no-op (P2002 swallowed) — never a double charge.
 */
export class InvoicesPaymentsRepository extends InvoicesBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async createPayment(input: {
    invoiceId: string;
    gateway: PaymentGateway;
    gatewayPaymentId: string;
    amount: number;
    currency: string;
  }): Promise<PaymentRow> {
    const db = this.writeScope(await this.resolveDefaultBranch());
    const row = await db.payment.create({
      data: {
        organizationId: this.organizationId,
        invoiceId: input.invoiceId,
        gateway: input.gateway,
        gatewayPaymentId: input.gatewayPaymentId,
        amount: input.amount,
        currency: input.currency,
        status: 'pending',
      },
      select: PAYMENT_SELECT,
    });
    return toPaymentRow(row);
  }

  async listPayments(invoiceId: string): Promise<PaymentRow[]> {
    const rows = await this.db.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
      select: PAYMENT_SELECT,
    });
    return rows.map(toPaymentRow);
  }

  async getPayment(id: string): Promise<PaymentRow> {
    const row = await this.db.payment.findFirst({
      where: { id },
      select: PAYMENT_SELECT,
    });
    if (!row) throw new NotFoundError('Payment not found.');
    return toPaymentRow(row);
  }

  async getPaymentByGatewayId(gatewayPaymentId: string): Promise<PaymentRow | null> {
    const row = await this.db.payment.findFirst({
      where: { gatewayPaymentId },
      select: PAYMENT_SELECT,
    });
    return row ? toPaymentRow(row) : null;
  }

  async setPaymentStatus(
    id: string,
    status: PaymentStatus,
    extras: { capturedAt?: Date } = {},
  ): Promise<PaymentRow> {
    await this.db.payment.updateMany({
      where: { id },
      data: { status, ...(extras.capturedAt ? { capturedAt: extras.capturedAt } : {}) },
    });
    return this.getPayment(id);
  }

  /** Appends a webhook event. Returns false when the event id already exists. */
  async appendPaymentEvent(input: {
    paymentId: string;
    gatewayEventId: string;
    kind: string;
    payload: unknown;
  }): Promise<boolean> {
    try {
      const db = this.writeScope(await this.resolveDefaultBranch());
      await db.paymentEvent.create({
        data: {
          organizationId: this.organizationId,
          paymentId: input.paymentId,
          gatewayEventId: input.gatewayEventId,
          kind: input.kind,
          payload: input.payload as PrismaJsonValue,
        },
      });
      return true;
    } catch (error) {
      // Unique gatewayEventId — a retried webhook is a no-op, not a failure.
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
