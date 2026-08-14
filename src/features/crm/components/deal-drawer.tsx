'use client';

import { format } from 'date-fns';
import { useState } from 'react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import {
  useAddActivity,
  useCloseDeal,
  useDeal,
  useMoveDeal,
  usePipelines,
} from '@/features/crm/hooks/use-crm';

/**
 * Deal drawer — detail + timeline + actions (M10).
 */

const ACTIVITY_LABELS: Record<string, string> = {
  note: 'Note',
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  stage_change: 'Stage change',
  status_change: 'Status change',
  assigned: 'Assigned',
  label_changed: 'Tag changed',
};

export function DealDrawer({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const { data, isPending, isError, refetch } = useDeal(dealId);
  const { data: pipelinesData } = usePipelines();
  const move = useMoveDeal();
  const close = useCloseDeal();
  const addActivity = useAddActivity();

  const [newStageId, setNewStageId] = useState<string>('');
  const [activityKind, setActivityKind] = useState<'note' | 'call' | 'email' | 'meeting'>('note');
  const [activityBody, setActivityBody] = useState('');

  if (isPending && !data) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent>
          <LoadingState rows={6} label="Loading deal" />
        </SheetContent>
      </Sheet>
    );
  }

  if (isError) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent>
          <ErrorState onRetry={() => void refetch()} />
        </SheetContent>
      </Sheet>
    );
  }

  const deal = data?.deal;
  if (!deal) return null;
  const activities = data?.activities ?? [];

  const pipeline = pipelinesData?.pipelines[0];
  const isOpen = deal.status === 'open';
  const currentStage = pipeline?.stages.find((s) => s.id === deal.stageId);

  const submitMove = () => {
    if (!newStageId) return;
    move.mutate({ id: deal.id, stageId: newStageId });
    setNewStageId('');
  };

  const submitActivity = () => {
    if (!activityBody.trim()) return;
    addActivity.mutate({ dealId: deal.id, kind: activityKind, body: activityBody.trim() });
    setActivityBody('');
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{deal.title}</SheetTitle>
          <SheetDescription>
            {deal.contactName ?? 'No contact'} · {deal.companyName ?? 'No company'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 overflow-y-auto py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={deal.status === 'open' ? 'default' : deal.status === 'won' ? 'secondary' : 'destructive'}>
              {deal.status}
            </Badge>
            {deal.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">Value</dt>
              <dd className="font-medium tabular-nums">
                {deal.valueAmount.toLocaleString()} {deal.valueCurrency}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Stage</dt>
              <dd className="font-medium">{currentStage?.name ?? deal.stageName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Created</dt>
              <dd>{format(new Date(deal.createdAt), 'd MMM yyyy')}</dd>
            </div>
            {deal.closedAt ? (
              <div>
                <dt className="text-muted-foreground text-xs">Closed</dt>
                <dd>{format(new Date(deal.closedAt), 'd MMM yyyy')}</dd>
              </div>
            ) : null}
          </dl>

          {isOpen ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="deal-move-stage">Move to stage</Label>
                <Select value={newStageId} onValueChange={setNewStageId}>
                  <SelectTrigger id="deal-move-stage">
                    <SelectValue placeholder="Choose a stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipeline?.stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!newStageId || move.isPending} onClick={submitMove}>
                  {move.isPending ? 'Moving…' : 'Move deal'}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={close.isPending}
                  onClick={() => close.mutate({ id: deal.id, status: 'won' })}
                >
                  Mark won
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={close.isPending}
                  onClick={() => close.mutate({ id: deal.id, status: 'lost' })}
                >
                  Mark lost
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="activity-kind">Add activity</Label>
              <Select value={activityKind} onValueChange={(v) => setActivityKind(v as typeof activityKind)}>
                <SelectTrigger id="activity-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['note', 'call', 'email', 'meeting'] as const).map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {ACTIVITY_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-body">Details</Label>
              <Textarea
                id="activity-body"
                value={activityBody}
                onChange={(event) => setActivityBody(event.target.value)}
                rows={3}
              />
            </div>
            <Button size="sm" disabled={!activityBody.trim() || addActivity.isPending} onClick={submitActivity}>
              {addActivity.isPending ? 'Adding…' : 'Add activity'}
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Timeline</h3>
            {activities.length === 0 ? (
              <EmptyState title="No activity yet" description="Notes and stage changes appear here." />
            ) : (
              <ol className="relative space-y-4 border-s ps-4">
                {activities.map((activity) => (
                  <li key={activity.id} className="space-y-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">
                        {ACTIVITY_LABELS[activity.kind] ?? activity.kind}
                      </p>
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(activity.createdAt), 'd MMM, HH:mm')}
                      </span>
                    </div>
                    {activity.body ? (
                      <p className="text-muted-foreground text-sm">{activity.body}</p>
                    ) : null}
                    {activity.actorName ? (
                      <p className="text-muted-foreground text-xs">by {activity.actorName}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
