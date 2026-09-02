import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { CouponList } from '@/features/loyalty/components/coupon-list';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Loyalty coupons' };

export const dynamic = 'force-dynamic';

/**
 * Loyalty coupons (Milestone 17).
 */
export default async function LoyaltyCouponsPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader title="Coupons" description="Discount codes customers can redeem." />
      <Suspense fallback={<LoadingState rows={3} label="Loading coupons" />}>
        <CouponList />
      </Suspense>
    </div>
  );
}
