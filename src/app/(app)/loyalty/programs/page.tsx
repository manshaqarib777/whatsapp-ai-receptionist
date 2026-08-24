import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { ProgramList } from '@/features/loyalty/components/program-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Loyalty programs' };

export const dynamic = 'force-dynamic';

/**
 * Loyalty programs (Milestone 17).
 */
export default async function LoyaltyProgramsPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programs"
        description="The earn rate that turns paid invoices into points."
      />
      <Suspense fallback={<LoadingState rows={3} label="Loading programs" />}>
        <ProgramList />
      </Suspense>
    </div>
  );
}
