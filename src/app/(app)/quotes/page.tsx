import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { QuoteList } from '@/features/quotations/components/quote-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Quotes' };

export const dynamic = 'force-dynamic';

/**
 * Quotes (Milestone 11).
 */
export default async function QuotesPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader title="Quotes" description="Generate, send, and track quotations." />
      <Suspense fallback={<LoadingState rows={6} label="Loading quotes" />}>
        <QuoteList />
      </Suspense>
    </div>
  );
}
