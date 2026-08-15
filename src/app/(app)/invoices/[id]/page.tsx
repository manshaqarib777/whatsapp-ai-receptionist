import { Suspense } from 'react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { InvoiceDetail } from '@/features/invoices/components/invoice-detail';
import { requireOrg } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Invoice' };

export const dynamic = 'force-dynamic';

/**
 * Invoice detail (Milestone 12).
 */
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrg();
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader title="Invoice" description="Line items, payments, and PDF." />
      <Suspense fallback={<LoadingState rows={6} label="Loading invoice" />}>
        <InvoiceDetail invoiceId={id} />
      </Suspense>
    </div>
  );
}
