import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { InvoiceList } from '@/features/invoices/components/invoice-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Invoices' };

export const dynamic = 'force-dynamic';

/**
 * Invoices (Milestone 12).
 */
export default async function InvoicesPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Bill customers and track payments." />
      <Suspense fallback={<LoadingState rows={6} label="Loading invoices" />}>
        <InvoiceList />
      </Suspense>
    </div>
  );
}
