'use client';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';

import { useLoyaltyReferrals } from '@/features/loyalty/hooks/use-loyalty';

/**
 * Referral list (M17) — referrer → referred, bonus, and status.
 */

export function ReferralList() {
  const { data, isPending, isError, refetch } = useLoyaltyReferrals();

  if (isPending && !data) {
    return <LoadingState rows={3} label="Loading referrals" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const referrals = data?.referrals ?? [];

  if (referrals.length === 0) {
    return (
      <EmptyState
        title="No referrals yet"
        description="When a referred contact first earns points, the referrer earns a bonus."
      />
    );
  }

  return (
    <ul className="bg-card text-card-foreground divide-y overflow-hidden rounded-xl border">
      {referrals.map((referral) => (
        <li
          key={referral.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {referral.referrerDisplayName} → {referral.referredDisplayName}
            </p>
            <p className="text-muted-foreground text-xs">
              {referral.bonusPoints} point bonus when the referral earns
            </p>
          </div>
          <Badge variant={referral.status === 'rewarded' ? 'secondary' : 'outline'}>
            {referral.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
