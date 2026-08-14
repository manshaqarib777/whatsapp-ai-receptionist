'use client';

import { format } from 'date-fns';
import { Download } from 'lucide-react';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuote, useTransitionQuote } from '@/features/quotations/hooks/use-quotations';

/**
 * Quote detail (M11) — line items, totals, the status lifecycle (send → accept /
 * reject / expire), a PDF download, and the version history.
 */

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  sent: 'default',
  accepted: 'secondary',
  rejected: 'destructive',
  expired: 'outline',
};

export function QuoteDetail({ quoteId }: { quoteId: string }) {
  const { data, isPending, isError, refetch } = useQuote(quoteId);
  const transition = useTransitionQuote();

  if (isPending && !data) {
    return <LoadingState rows={6} label="Loading quote" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const quote = data?.quote;
  if (!quote) {
    return (
      <EmptyState title="Quote not found" description="It may have been removed." />
    );
  }
  const versions = data?.versions ?? [];

  const act = (action: 'send' | 'accept' | 'reject' | 'expire' | 'mark_draft') => {
    transition.mutate({ id: quote.id, action });
  };

  const isDraft = quote.status === 'draft';
  const isSent = quote.status === 'sent';

  return (
    <div className="space-y-6">
      <section className="bg-card text-card-foreground rounded-xl border p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge variant={STATUS_VARIANTS[quote.status] ?? 'outline'}>{quote.status}</Badge>
          <span className="font-medium">{quote.number}</span>
          <span className="text-muted-foreground text-sm">{quote.contactName ?? quote.contactId}</span>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs">Created</dt>
            <dd>{format(new Date(quote.createdAt), 'd MMM yyyy')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Valid until</dt>
            <dd>{quote.validUntil ? format(new Date(quote.validUntil), 'd MMM yyyy') : '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Total</dt>
            <dd className="font-semibold tabular-nums">
              {quote.totalAmount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              {quote.currency}
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
              {quote.lineItems.map((line) => (
                <tr key={line.id}>
                  <td className="py-2">{line.description}</td>
                  <td className="py-2 text-end tabular-nums">{line.quantity}</td>
                  <td className="py-2 text-end tabular-nums">
                    {line.unitPriceAmount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 text-end tabular-nums">
                    {line.taxAmount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 text-end tabular-nums">
                    {line.lineTotalAmount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 ms-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{quote.subtotalAmount.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">VAT</dt>
            <dd className="tabular-nums">{quote.taxAmount.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{quote.totalAmount.toFixed(2)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer">
              <Download aria-hidden="true" className="size-4" />
              PDF
            </a>
          </Button>

          {isDraft ? (
            <Button disabled={transition.isPending} onClick={() => act('send')}>
              Send quote
            </Button>
          ) : null}
          {isSent ? (
            <>
              <Button variant="outline" disabled={transition.isPending} onClick={() => act('accept')}>
                Accept
              </Button>
              <Button variant="outline" disabled={transition.isPending} onClick={() => act('reject')}>
                Reject
              </Button>
              <Button variant="outline" disabled={transition.isPending} onClick={() => act('expire')}>
                Expire
              </Button>
            </>
          ) : null}
        </div>
      </section>

      <section className="bg-card text-card-foreground rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Versions</h2>
        {versions.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            No versions yet — sending this quote snapshots it.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {versions.map((version) => (
              <li key={version.versionNumber} className="text-muted-foreground flex justify-between">
                <span>Version {version.versionNumber}</span>
                <span>{format(new Date(version.createdAt), 'd MMM yyyy, HH:mm')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
