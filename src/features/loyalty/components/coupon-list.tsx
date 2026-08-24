'use client';

import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCreateCoupon, useLoyaltyCoupons } from '@/features/loyalty/hooks/use-loyalty';

/**
 * Coupon list (M17) — code, type, value, redemption count, and a create
 * doorway.
 */

export function CouponList() {
  const { data, isPending, isError, refetch } = useLoyaltyCoupons();
  const [createOpen, setCreateOpen] = useState(false);

  if (isPending && !data) {
    return <LoadingState rows={3} label="Loading coupons" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const coupons = data?.coupons ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>New coupon</Button>
      </div>

      {coupons.length === 0 ? (
        <EmptyState
          title="No coupons yet"
          description="Create a coupon to give customers a discount."
        />
      ) : (
        <ul className="bg-card text-card-foreground divide-y overflow-hidden rounded-xl border">
          {coupons.map((coupon) => (
            <li
              key={coupon.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{coupon.code}</p>
                <p className="text-muted-foreground text-xs">
                  {coupon.type === 'percent' ? `${coupon.value}%` : `SAR ${coupon.value}`}{' '}
                  · {coupon.redemptionCount}/{coupon.maxRedemptions} used
                  {coupon.expiresAt ? ' · expires soon' : ''}
                </p>
              </div>
              <Badge variant="outline">{coupon.type}</Badge>
            </li>
          ))}
        </ul>
      )}

      <CreateCouponDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateCouponDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateCoupon();
  const [code, setCode] = useState('');
  const [type, setType] = useState('percent');
  const [value, setValue] = useState('10');
  const [maxRedemptions, setMaxRedemptions] = useState('1');

  const parsedValue = Number(value);
  const parsedMax = Number(maxRedemptions);
  const valid =
    code.trim().length > 0 &&
    Number.isFinite(parsedValue) &&
    parsedValue >= 0 &&
    (type !== 'percent' || parsedValue <= 100) &&
    Number.isInteger(parsedMax) &&
    parsedMax >= 1;

  const submit = () => {
    if (!valid) return;
    create.mutate(
      {
        code: code.trim(),
        type: type as 'percent' | 'fixed',
        value: parsedValue,
        maxRedemptions: parsedMax,
      },
      {
        onSuccess: () => {
          setCode('');
          setType('percent');
          setValue('10');
          setMaxRedemptions('1');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New coupon</DialogTitle>
          <DialogDescription>
            A discount customers can redeem. Percent coupons are 0–100.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="coupon-code">Code</Label>
            <Input
              id="coupon-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="e.g. WELCOME10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="coupon-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percent</SelectItem>
                <SelectItem value="fixed">Fixed amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-value">Value</Label>
            <Input
              id="coupon-value"
              type="number"
              min={0}
              step={0.5}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-max">Max redemptions</Label>
            <Input
              id="coupon-max"
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={(event) => setMaxRedemptions(event.target.value)}
            />
          </div>
        </div>
        {create.isError ? (
          <p className="text-destructive text-sm">Could not create the coupon.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || create.isPending} onClick={submit}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
