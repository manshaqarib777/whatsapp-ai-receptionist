'use client';

import { useState } from 'react';
import Link from 'next/link';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useLoyaltyAccounts } from '@/features/loyalty/hooks/use-loyalty';

/**
 * Loyalty account list (M17) — contact, tier, balance, and a tier filter.
 */

export const TIER_FILTERS = ['all', 'bronze', 'silver', 'gold'] as const;

const TIER_LABELS: Record<string, string> = {
  all: 'All',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};

export function LoyaltyAccountList() {
  const [tier, setTier] = useState<string>('all');
  const { data, isPending, isError, refetch } = useLoyaltyAccounts(tier);

  if (isPending && !data) {
    return <LoadingState rows={4} label="Loading accounts" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const accounts = data?.accounts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tier">
        {TIER_FILTERS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={tier === value ? 'default' : 'outline'}
            onClick={() => setTier(value)}
          >
            {TIER_LABELS[value]}
          </Button>
        ))}
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          title="No loyalty accounts yet"
          description="Accounts are created automatically when a contact first earns points."
        />
      ) : (
        <ul className="bg-card text-card-foreground divide-y overflow-hidden rounded-xl border">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/loyalty/accounts/${account.id}`}
                  className="hover:text-foreground text-sm font-medium hover:underline"
                >
                  {account.contactDisplayName}
                </Link>
                <p className="text-muted-foreground text-xs">
                  {account.programName} · {account.balance} points
                </p>
              </div>
              <Badge variant={account.tier === 'gold' ? 'secondary' : 'outline'}>
                {account.tier}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
