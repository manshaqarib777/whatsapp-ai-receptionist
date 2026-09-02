'use client';

import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
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

import {
  useCreateSegment,
  useSegments,
  useSegmentPreview,
} from '@/features/broadcast/hooks/use-broadcast';
import type { SegmentDefinition } from '@/features/broadcast/services/segments';

/**
 * Segment manager (M14) — list, create, and preview the eligible count before
 * any send. A segment is a filter tree evaluated at send time.
 */

const LIFECYCLE_STAGES = ['lead', 'prospect', 'customer'] as const;

export function SegmentManager() {
  const { data, isPending, isError, refetch } = useSegments();
  const [createOpen, setCreateOpen] = useState(false);

  if (isPending && !data) {
    return <LoadingState rows={3} label="Loading segments" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const segments = data?.segments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>New segment</Button>
      </div>

      {segments.length === 0 ? (
        <EmptyState
          title="No segments yet"
          description="Create a segment to target a group of contacts."
        />
      ) : (
        <ul className="bg-card text-card-foreground divide-y overflow-hidden rounded-xl border">
          {segments.map((segment) => (
            <SegmentRowItem key={segment.id} segmentId={segment.id} name={segment.name} />
          ))}
        </ul>
      )}

      <CreateSegmentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function SegmentRowItem({ segmentId, name }: { segmentId: string; name: string }) {
  const preview = useSegmentPreview();
  const [count, setCount] = useState<number | null>(null);

  const showPreview = () => {
    preview.mutate(segmentId, { onSuccess: (result) => setCount(result.count) });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-muted-foreground text-xs">
          {count === null
            ? 'Eligible count is evaluated at send time.'
            : `${count} eligible`}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={preview.isPending}
        onClick={showPreview}
      >
        {preview.isPending ? 'Counting…' : 'Preview'}
      </Button>
    </li>
  );
}

function CreateSegmentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateSegment();
  const [name, setName] = useState('');
  const [locale, setLocale] = useState('');
  const [lifecycleStage, setLifecycleStage] = useState('');
  const [createdAtAfter, setCreatedAtAfter] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const definition: SegmentDefinition = {};
    if (locale) definition.locale = locale;
    if (lifecycleStage)
      definition.lifecycleStage = lifecycleStage as SegmentDefinition['lifecycleStage'];
    if (createdAtAfter)
      definition.createdAtAfter = new Date(createdAtAfter).toISOString();

    create.mutate(
      { name: trimmed, definition },
      {
        onSuccess: () => {
          setName('');
          setLocale('');
          setLifecycleStage('');
          setCreatedAtAfter('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New segment</DialogTitle>
          <DialogDescription>
            A segment is a filter evaluated against contacts at send time. Contacts
            without consent are always excluded.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="segment-name">Name</Label>
            <Input
              id="segment-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Riyadh customers"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="segment-locale">Locale</Label>
            <Input
              id="segment-locale"
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              placeholder="e.g. ar (optional)"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="segment-stage">Lifecycle stage</Label>
            <Select value={lifecycleStage} onValueChange={setLifecycleStage}>
              <SelectTrigger id="segment-stage" className="w-full">
                <SelectValue placeholder="Any stage" />
              </SelectTrigger>
              <SelectContent>
                {LIFECYCLE_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="segment-created">Created after</Label>
            <Input
              id="segment-created"
              type="date"
              value={createdAtAfter}
              onChange={(event) => setCreatedAtAfter(event.target.value)}
            />
          </div>
        </div>
        {create.isError ? (
          <p className="text-destructive text-sm">Could not create the segment.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              !name.trim() ||
              create.isPending ||
              (!locale && !lifecycleStage && !createdAtAfter)
            }
            onClick={submit}
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
