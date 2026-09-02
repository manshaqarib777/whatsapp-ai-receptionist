'use client';

import { format } from 'date-fns';
import { Download } from 'lucide-react';
import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  useInvoice,
  useInvoiceTransition,
  type Invoice,
} from '@/features/invoices/hooks/use-invoices';

import { PaymentHistory } from './payment-history';
import { PaymentDialogs, type PaymentDialogsState } from './payment-dialogs';

/**
 * Invoice detail (M12) — line items, totals, payment history, refunds, the
 * status lifecycle (issue → record payment → paid / void), and a PDF download.
 *
 * The header + line-item table lives in `invoice-summary.tsx`; the payments
 * list in `payment-history.tsx`; the refund/record-payment dialogs in
 * `payment-dialogs.tsx`.
 */

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  draft: 'outline',
  issued: 'default',
  partially_paid: 'secondary',
  paid: 'default',
  overdue: 'destructive',
  void: 'outline',
};

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const { data, isPending, isError, refetch } = useInvoice(invoiceId);
  const transition = useInvoiceTransition();
  const [dialogs, setDialogs] = useState<PaymentDialogsState>({ kind: 'none' });

  if (isPending && !data) {
    return <LoadingState rows={6} label="Loading invoice" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const invoice = data?.invoice;
  if (!invoice) {
    return (
      <EmptyState title="Invoice not found" description="It may have been removed." />
    );
  }
  const payments = data?.payments ?? [];
  const refunds = data?.refunds ?? [];

  const act = (action: 'issue' | 'void' | 'mark_paid') => {
    transition.mutate({ id: invoice.id, action });
  };

  const balance = Math.max(0, invoice.totalAmount - invoice.amountPaid);
  const isDraft = invoice.status === 'draft';
  const isIssued = invoice.status === 'issued' || invoice.status === 'partially_paid';
  const canPay = isIssued && balance > 0;

  return (
    <div className="space-y-6">
      <InvoiceSummary
        invoice={invoice}
        balance={balance}
        canPay={canPay}
        isDraft={isDraft}
        transitionPending={transition.isPending}
        onIssue={() => act('issue')}
        onVoid={() => act('void')}
        onMarkPaid={() => act('mark_paid')}
        onRecordPayment={() =>
          setDialogs({
            kind: 'payment',
            invoiceId: invoice.id,
            balance,
            currency: invoice.currency,
          })
        }
      />

      <PaymentHistory
        payments={payments}
        refunds={refunds}
        onRefund={(payment) => setDialogs({ kind: 'refund', payment })}
      />

      <PaymentDialogs state={dialogs} onClose={() => setDialogs({ kind: 'none' })} />
    </div>
  );
}

function InvoiceSummary({
  invoice,
  balance,
  canPay,
  isDraft,
  transitionPending,
  onIssue,
  onVoid,
  onMarkPaid,
  onRecordPayment,
}: {
  invoice: Invoice;
  balance: number;
  canPay: boolean;
  isDraft: boolean;
  transitionPending: boolean;
  onIssue: () => void;
  onVoid: () => void;
  onMarkPaid: () => void;
  onRecordPayment: () => void;
}) {
  const money = (value: number) =>
    value.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="bg-card text-card-foreground rounded-xl border p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge variant={STATUS_VARIANTS[invoice.status] ?? 'outline'}>
          {invoice.status}
        </Badge>
        <span className="font-medium">{invoice.number}</span>
        <span className="text-muted-foreground text-sm">
          {invoice.contactName ?? invoice.contactId}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground text-xs">Issued</dt>
          <dd>
            {invoice.issuedAt ? format(new Date(invoice.issuedAt), 'd MMM yyyy') : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Due</dt>
          <dd>{invoice.dueAt ? format(new Date(invoice.dueAt), 'd MMM yyyy') : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Total</dt>
          <dd className="font-semibold tabular-nums">
            {money(invoice.totalAmount)} {invoice.currency}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Balance due</dt>
          <dd className="font-semibold tabular-nums">
            {money(balance)} {invoice.currency}
          </dd>
        </div>
      </dl>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="text-muted-foreground sr-only">Line items</caption>
          <thead>
            <tr className="text-muted-foreground border-b text-start text-xs uppercase">
              <th className="py-2 text-start font-medium">Description</th>
              <th className="py-2 text-end font-medium">Qty</th>
              <th className="py-2 text-end font-medium">Unit</th>
              <th className="py-2 text-end font-medium">Tax</th>
              <th className="py-2 text-end font-medium">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoice.lineItems.map((line) => (
              <tr key={line.id}>
                <td className="py-2">{line.description}</td>
                <td className="py-2 text-end tabular-nums">{line.quantity}</td>
                <td className="py-2 text-end tabular-nums">
                  {money(line.unitPriceAmount)}
                </td>
                <td className="py-2 text-end tabular-nums">{money(line.taxAmount)}</td>
                <td className="py-2 text-end tabular-nums">
                  {money(line.lineTotalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ms-auto mt-4 w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{money(invoice.subtotalAmount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">VAT</dt>
          <dd className="tabular-nums">{money(invoice.taxAmount)}</dd>
        </div>
        {invoice.discountAmount > 0 ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Coupon discount</dt>
            <dd className="tabular-nums">-{money(invoice.discountAmount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Paid</dt>
          <dd className="tabular-nums">{money(invoice.amountPaid)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Balance due</dt>
          <dd className="tabular-nums">{money(balance)}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
            <Download aria-hidden="true" className="size-4" />
            PDF
          </a>
        </Button>

        {isDraft ? (
          <Button disabled={transitionPending} onClick={onIssue}>
            Issue invoice
          </Button>
        ) : null}
        {canPay ? (
          <Button disabled={transitionPending} onClick={onRecordPayment}>
            Record payment
          </Button>
        ) : null}
        {canPay ? (
          <Button variant="outline" disabled={transitionPending} onClick={onMarkPaid}>
            Mark paid
          </Button>
        ) : null}
        {invoice.status !== 'void' && invoice.status !== 'paid' ? (
          <Button variant="outline" disabled={transitionPending} onClick={onVoid}>
            Void
          </Button>
        ) : null}
      </div>
    </section>
  );
}
