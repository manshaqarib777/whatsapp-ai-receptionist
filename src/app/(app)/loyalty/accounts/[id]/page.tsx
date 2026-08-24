import { Suspense } from 'react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { LoyaltyAccountDetail } from '@/features/loyalty/components/account-detail';
import { requireOrg } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Loyalty account' };

export const dynamic = 'force-dynamic';

/**
 * Loyalty account detail (Milestone 17).
 */
export default async function LoyaltyAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrg();
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader title="Account" description="Balance, tier, and transaction history." />
      <Suspense fallback={<LoadingState rows={6} label="Loading account" />}>
        <LoyaltyAccountDetail accountId={id} />
      </Suspense>
    </div>
  );
}
