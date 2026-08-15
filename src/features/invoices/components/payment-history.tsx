'use client';

import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

import type { Payment, Refund } from '@/features/invoices/hooks/use-invoices';

/**
 * Invoice payment history (M12) — the list of payments against an invoice,
 * with per-payment refund totals and the refund doorway for succeeded
 * payments that have not been refunded.
 */

export function PaymentHistory({
  payments,
  refunds,
  onRefund,
}: {
  payments: Payment[];
  refunds: Refund[];
  onRefund: (payment: Payment) => void;
}) {
  if (payments.length === 0) {
    return (
      <section className="bg-card text-card-foreground rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Payments</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          No payments yet — issue the invoice and record a payment.
        </p>
      </section>
    );
  }

  const money = (value: number) =>
    value.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="bg-card text-card-foreground rounded-xl border p-5">
      <h2 className="text-sm font-semibold">Payments</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {payments.map((payment) => {
          const paymentRefunds = refunds.filter(
            (refund) => refund.paymentId === payment.id,
          );
          const refundedTotal = paymentRefunds.reduce(
            (sum, refund) => sum + refund.amount,
            0,
          );
          return (
            <li
              key={payment.id}
              className="text-muted-foreground flex flex-wrap items-center justify-between gap-2"
            >
              <span>
                {payment.gateway} · {payment.status} · {money(payment.amount)}{' '}
                {payment.currency}
                {refundedTotal > 0 ? (
                  <span className="text-destructive ms-1">
                    (refunded {money(refundedTotal)})
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-2">
                <span>{format(new Date(payment.createdAt), 'd MMM yyyy, HH:mm')}</span>
                {payment.status === 'succeeded' && refundedTotal === 0 ? (
                  <Button size="sm" variant="outline" onClick={() => onRefund(payment)}>
                    Refund
                  </Button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
