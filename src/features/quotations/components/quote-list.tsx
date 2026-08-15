'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreateQuoteDialog } from '@/features/quotations/components/create-quote-dialog';
import { useQuotes, type QuoteStatus } from '@/features/quotations/hooks/use-quotations';

/**
 * Quote list (M11) — status-filtered, with the create-quote doorway.
 */

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  draft: 'outline',
  sent: 'default',
  accepted: 'secondary',
  rejected: 'destructive',
  expired: 'outline',
};

const STATUS_FILTERS: (QuoteStatus | 'all')[] = [
  'all',
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
];

export function QuoteList() {
  const [status, setStatus] = useState<QuoteStatus | 'all'>('all');
  const { data, isPending, isError, refetch } = useQuotes(status);
  const [createOpen, setCreateOpen] = useState(false);

  if (isPending && !data) {
    return <LoadingState rows={6} label="Loading quotes" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const quotes = data?.quotes ?? [];

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
              {filter}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          New quote
        </Button>
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          description="Create a quote to send a customer a priced treatment plan."
        />
      ) : (
        <ul className="bg-card divide-border divide-y rounded-xl border">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Link
                href={`/quotes/${quote.id}`}
                className="hover:bg-muted focus-visible:ring-ring flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 focus-visible:ring-2 focus-visible:outline-none"
              >
                <Badge variant={STATUS_VARIANTS[quote.status] ?? 'outline'}>
                  {quote.status}
                </Badge>
                <span className="font-medium">{quote.number}</span>
                <span className="text-muted-foreground text-sm">
                  {quote.contactName ?? quote.contactId}
                </span>
                <span className="text-muted-foreground ms-auto text-xs">
                  {format(new Date(quote.createdAt), 'd MMM yyyy')} ·{' '}
                  {quote.totalAmount.toLocaleString('en', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {quote.currency}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateQuoteDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
