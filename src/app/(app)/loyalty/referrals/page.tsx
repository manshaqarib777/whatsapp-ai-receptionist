import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { ReferralList } from '@/features/loyalty/components/referral-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Loyalty referrals' };

export const dynamic = 'force-dynamic';

/**
 * Loyalty referrals (Milestone 17).
 */
export default async function LoyaltyReferralsPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referrals"
        description="Customers referring customers — each earns a bonus."
      />
      <Suspense fallback={<LoadingState rows={3} label="Loading referrals" />}>
        <ReferralList />
      </Suspense>
    </div>
  );
}
