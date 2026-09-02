'use client';

import { useState } from 'react';
import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useLoyaltyAccount, useRedeemPoints } from '@/features/loyalty/hooks/use-loyalty';

/**
 * Loyalty account detail (M17) — balance, tier, transaction history, and a
 * redeem doorway.
 */

export function LoyaltyAccountDetail({ accountId }: { accountId: string }) {
  const { data, isPending, isError, refetch } = useLoyaltyAccount(accountId);
  const [redeemOpen, setRedeemOpen] = useState(false);

  if (isPending && !data) {
    return (
      <div className="bg-card text-card-foreground animate-pulse rounded-xl border p-5">
        Loading account…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="bg-card text-card-foreground rounded-xl border p-5">
        <p className="text-destructive text-sm">Could not load this account.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  const account = data?.account;
  if (!account) return null;

  const transactions = data?.transactions ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-card text-card-foreground rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{account.contactDisplayName}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{account.programName}</p>
          </div>
          <Badge variant={account.tier === 'gold' ? 'secondary' : 'outline'}>
            {account.tier}
          </Badge>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs">Balance</dt>
            <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
              {account.balance} pts
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Total earned</dt>
            <dd className="mt-0.5 tabular-nums">{account.totalEarned} pts</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Tier</dt>
            <dd className="mt-0.5 capitalize">{account.tier}</dd>
          </div>
        </dl>

        <div className="mt-5">
          <Button disabled={account.balance <= 0} onClick={() => setRedeemOpen(true)}>
            Redeem points
          </Button>
        </div>
      </div>

      <section className="bg-card text-card-foreground rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Transaction history</h2>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">No transactions yet.</p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {transactions.map((transaction) => (
              <li
                key={transaction.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="capitalize">{transaction.kind.replace('_', ' ')}</p>
                  <p className="text-muted-foreground text-xs">
                    {transaction.reason ?? '—'} ·{' '}
                    {format(new Date(transaction.createdAt), 'd MMM yyyy, HH:mm')}
                  </p>
                </div>
                <span
                  className={`text-sm font-medium tabular-nums ${
                    transaction.pointsDelta >= 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {transaction.pointsDelta >= 0 ? '+' : ''}
                  {transaction.pointsDelta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RedeemDialog
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        accountId={account.id}
        balance={account.balance}
      />
    </div>
  );
}

function RedeemDialog({
  open,
  onClose,
  accountId,
  balance,
}: {
  open: boolean;
  onClose: () => void;
  accountId: string;
  balance: number;
}) {
  const redeem = useRedeemPoints();
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');

  const parsed = Number(points);
  const valid = Number.isInteger(parsed) && parsed > 0 && parsed <= balance;

  const submit = () => {
    if (!valid) return;
    redeem.mutate(
      { accountId, points: parsed, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setPoints('');
          setReason('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Redeem points</DialogTitle>
          <DialogDescription>
            {balance} points available. Redemptions cannot exceed the balance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="redeem-points">Points</Label>
            <Input
              id="redeem-points"
              type="number"
              min={1}
              max={balance}
              value={points}
              onChange={(event) => setPoints(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="redeem-reason">Reason (optional)</Label>
            <Input
              id="redeem-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Free check-up"
            />
          </div>
        </div>
        {redeem.isError ? (
          <p className="text-destructive text-sm">
            Could not redeem — check the balance.
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || redeem.isPending} onClick={submit}>
            {redeem.isPending ? 'Redeeming…' : 'Redeem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
