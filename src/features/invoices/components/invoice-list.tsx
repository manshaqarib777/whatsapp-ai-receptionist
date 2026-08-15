'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreateInvoiceDialog } from '@/features/invoices/components/create-invoice-dialog';
import { useInvoices, type InvoiceStatus } from '@/features/invoices/hooks/use-invoices';

/**
 * Invoice list (M12) — status-filtered, with the create-invoice doorway.
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

const STATUS_FILTERS: (InvoiceStatus | 'all')[] = [
  'all',
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'void',
];

export function InvoiceList() {
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all');
  const { data, isPending, isError, refetch } = useInvoices(status);
  const [createOpen, setCreateOpen] = useState(false);

  if (isPending && !data) {
    return <LoadingState rows={6} label="Loading invoices" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const invoices = data?.invoices ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={status === filter ? 'default' : 'ghost'}
              onClick={() => setStatus(filter)}
            >
              {filter === 'partially_paid' ? 'partial' : filter}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          New invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Create an invoice to bill a customer for a treatment plan."
        />
      ) : (
        <ul className="bg-card divide-border divide-y rounded-xl border">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link
                href={`/invoices/${invoice.id}`}
                className="hover:bg-muted focus-visible:ring-ring flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 focus-visible:ring-2 focus-visible:outline-none"
              >
                <Badge variant={STATUS_VARIANTS[invoice.status] ?? 'outline'}>
                  {invoice.status}
                </Badge>
                <span className="font-medium">{invoice.number}</span>
                <span className="text-muted-foreground text-sm">
                  {invoice.contactName ?? invoice.contactId}
                </span>
                <span className="text-muted-foreground ms-auto text-xs">
                  {format(new Date(invoice.createdAt), 'd MMM yyyy')} ·{' '}
                  {invoice.totalAmount.toLocaleString('en', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {invoice.currency}
                  {invoice.amountPaid > 0 ? (
                    <span className="text-success ms-1">
                      (
                      {invoice.amountPaid.toLocaleString('en', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      paid)
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
