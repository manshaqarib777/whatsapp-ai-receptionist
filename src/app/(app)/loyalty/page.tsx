import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { LoyaltyAccountList } from '@/features/loyalty/components/account-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Loyalty' };

export const dynamic = 'force-dynamic';

/**
 * Loyalty (Milestone 17) — the account list.
 */
export default async function LoyaltyPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loyalty"
        description="Points, membership tiers, coupons, rewards, and referrals."
      />
      <Suspense fallback={<LoadingState rows={4} label="Loading accounts" />}>
        <LoyaltyAccountList />
      </Suspense>
    </div>
  );
}
