import type { Scope } from '@/lib/db/scope';

import { InvoicesBaseRepository } from './invoices.base';
import { toRefundRow } from './invoices.mappers';
import type { RefundRow } from './invoices.types';

const REFUND_SELECT = {
  id: true,
  paymentId: true,
  gatewayRefundId: true,
  amount: true,
  currency: true,
  reason: true,
  createdAt: true,
} as const;

/**
 * Refund data access.
 *
 * Refunds carry the unique `gatewayRefundId` idempotency key, so a retried
 * gateway call cannot double-refund.
 */
export class InvoicesRefundsRepository extends InvoicesBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async createRefund(input: {
    paymentId: string;
    gatewayRefundId: string;
    amount: number;
    currency: string;
    reason?: string;
  }): Promise<RefundRow> {
    const db = this.writeScope(await this.resolveDefaultBranch());
    const row = await db.refund.create({
      data: {
        organizationId: this.organizationId,
        paymentId: input.paymentId,
        gatewayRefundId: input.gatewayRefundId,
        amount: input.amount,
        currency: input.currency,
        reason: input.reason ?? null,
      },
      select: REFUND_SELECT,
    });
    return toRefundRow(row);
  }

  async listRefunds(paymentId: string): Promise<RefundRow[]> {
    const rows = await this.db.refund.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
      select: REFUND_SELECT,
    });
    return rows.map(toRefundRow);
  }
}
