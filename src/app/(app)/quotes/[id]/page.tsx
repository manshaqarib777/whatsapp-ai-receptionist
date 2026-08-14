import { Suspense } from 'react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { QuoteDetail } from '@/features/quotations/components/quote-detail';
import { requireOrg } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Quote' };

export const dynamic = 'force-dynamic';

/**
 * Quote detail (Milestone 11).
 */
export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrg();
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader title="Quote" description="Line items, lifecycle, and PDF." />
      <Suspense fallback={<LoadingState rows={6} label="Loading quote" />}>
        <QuoteDetail quoteId={id} />
      </Suspense>
    </div>
  );
}
