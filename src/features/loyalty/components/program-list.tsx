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
  useCreateLoyaltyProgram,
  useLoyaltyPrograms,
} from '@/features/loyalty/hooks/use-loyalty';

/**
 * Program list (M17) — name, earn rate, enabled state, and a create doorway.
 */

export function ProgramList() {
  const { data, isPending, isError, refetch } = useLoyaltyPrograms();
  const [createOpen, setCreateOpen] = useState(false);

  if (isPending && !data) {
    return <LoadingState rows={3} label="Loading programs" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const programs = data?.programs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>New program</Button>
      </div>

      {programs.length === 0 ? (
        <EmptyState
          title="No loyalty programs yet"
          description="Create a program to start awarding points."
        />
      ) : (
        <ul className="bg-card text-card-foreground divide-y overflow-hidden rounded-xl border">
          {programs.map((program) => (
            <li
              key={program.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{program.name}</p>
                <p className="text-muted-foreground text-xs">
                  {program.pointsPerCurrency} point
                  {program.pointsPerCurrency === 1 ? '' : 's'} per currency unit
                </p>
              </div>
              {program.isEnabled ? (
                <Badge variant="secondary">Enabled</Badge>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      <CreateProgramDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateProgramDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateLoyaltyProgram();
  const [name, setName] = useState('');
  const [pointsPerCurrency, setPointsPerCurrency] = useState('1');

  const parsed = Number(pointsPerCurrency);
  const valid = name.trim().length > 0 && Number.isFinite(parsed) && parsed >= 0;

  const submit = () => {
    if (!valid) return;
    create.mutate(
      { name: name.trim(), pointsPerCurrency: parsed },
      {
        onSuccess: () => {
          setName('');
          setPointsPerCurrency('1');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New loyalty program</DialogTitle>
          <DialogDescription>
            Set how many points a customer earns per currency unit on paid invoices.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="program-name">Name</Label>
            <Input
              id="program-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Smile Rewards"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="program-rate">Points per currency unit</Label>
            <Input
              id="program-rate"
              type="number"
              min={0}
              step={0.25}
              value={pointsPerCurrency}
              onChange={(event) => setPointsPerCurrency(event.target.value)}
            />
          </div>
        </div>
        {create.isError ? (
          <p className="text-destructive text-sm">Could not create the program.</p>
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
