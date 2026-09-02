'use client';

import { useState } from 'react';
import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useCampaign,
  useCampaignTransition,
} from '@/features/broadcast/hooks/use-broadcast';

/**
 * Campaign detail (M14) — segment, template, schedule, the lifecycle actions
 * (schedule, send now, cancel), and the analytics totals derived from the
 * recipient rows.
 */

export function CampaignDetail({ campaignId }: { campaignId: string }) {
  const { data, isPending, isError, refetch } = useCampaign(campaignId);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  if (isPending && !data) {
    return (
      <div className="bg-card text-card-foreground animate-pulse rounded-xl border p-5">
        Loading campaign…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="bg-card text-card-foreground rounded-xl border p-5">
        <p className="text-destructive text-sm">Could not load this campaign.</p>
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

  const campaign = data?.campaign;
  if (!campaign) return null;

  const canSchedule = campaign.status === 'draft' || campaign.status === 'scheduled';
  const canSend = campaign.status === 'draft' || campaign.status === 'scheduled';
  const canCancel = campaign.status !== 'sent' && campaign.status !== 'cancelled';

  return (
    <div className="space-y-6">
      <div className="bg-card text-card-foreground rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{campaign.name}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {campaign.segmentName} · {campaign.templateName}
            </p>
          </div>
          <Badge variant={campaign.status === 'sent' ? 'secondary' : 'outline'}>
            {campaign.status}
          </Badge>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs">Segment</dt>
            <dd className="mt-0.5">{campaign.segmentName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Template</dt>
            <dd className="mt-0.5">{campaign.templateName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Scheduled for</dt>
            <dd className="mt-0.5">
              {campaign.scheduledFor
                ? format(new Date(campaign.scheduledFor), 'd MMM yyyy, HH:mm')
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Started</dt>
            <dd className="mt-0.5">
              {campaign.startedAt
                ? format(new Date(campaign.startedAt), 'd MMM yyyy, HH:mm')
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Finished</dt>
            <dd className="mt-0.5">
              {campaign.finishedAt
                ? format(new Date(campaign.finishedAt), 'd MMM yyyy, HH:mm')
                : '—'}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          {canSchedule ? (
            <Button onClick={() => setScheduleOpen(true)}>Schedule</Button>
          ) : null}
          {canSend ? <SendNowButton campaignId={campaignId} /> : null}
          {canCancel ? <CancelButton campaignId={campaignId} /> : null}
        </div>
      </div>

      <Analytics campaignId={campaignId} />

      <Recipients campaignId={campaignId} />

      <ScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        campaignId={campaignId}
      />
    </div>
  );
}

function SendNowButton({ campaignId }: { campaignId: string }) {
  const transition = useCampaignTransition();
  return (
    <Button
      variant="default"
      disabled={transition.isPending}
      onClick={() => transition.mutate({ id: campaignId, action: 'send' })}
    >
      {transition.isPending ? 'Sending…' : 'Send now'}
    </Button>
  );
}

function CancelButton({ campaignId }: { campaignId: string }) {
  const transition = useCampaignTransition();
  return (
    <Button
      variant="outline"
      disabled={transition.isPending}
      onClick={() => transition.mutate({ id: campaignId, action: 'cancel' })}
    >
      Cancel
    </Button>
  );
}

function ScheduleDialog({
  open,
  onClose,
  campaignId,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
}) {
  const transition = useCampaignTransition();
  const [scheduledFor, setScheduledFor] = useState('');

  const submit = () => {
    if (!scheduledFor) return;
    transition.mutate(
      {
        id: campaignId,
        action: 'schedule',
        scheduledFor: new Date(scheduledFor).toISOString(),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule campaign</DialogTitle>
          <DialogDescription>
            Choose when the recipients are materialised and the send begins.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="campaign-schedule-time">Send at</Label>
          <Input
            id="campaign-schedule-time"
            type="datetime-local"
            value={scheduledFor}
            onChange={(event) => setScheduledFor(event.target.value)}
          />
        </div>
        {transition.isError ? (
          <p className="text-destructive text-sm">Could not schedule the campaign.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!scheduledFor || transition.isPending} onClick={submit}>
            {transition.isPending ? 'Scheduling…' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Analytics({ campaignId }: { campaignId: string }) {
  const { data } = useCampaign(campaignId);
  const analytics = data?.analytics;

  return (
    <section className="bg-card text-card-foreground rounded-xl border p-5">
      <h2 className="text-sm font-semibold">Analytics</h2>
      {!analytics ? (
        <p className="text-muted-foreground mt-2 text-sm">No analytics yet.</p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <dt className="text-muted-foreground text-xs">Total</dt>
            <dd className="mt-0.5 text-lg font-semibold">{analytics.total}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Sent</dt>
            <dd className="mt-0.5 text-lg font-semibold">{analytics.sent}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Delivered</dt>
            <dd className="mt-0.5 text-lg font-semibold">{analytics.delivered}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Read</dt>
            <dd className="mt-0.5 text-lg font-semibold">{analytics.read}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Failed</dt>
            <dd className="mt-0.5 text-lg font-semibold">{analytics.failed}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Delivered rate</dt>
            <dd className="mt-0.5 text-lg font-semibold">
              {analytics.deliveredRate === null
                ? '—'
                : `${Math.round(analytics.deliveredRate * 100)}%`}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function Recipients({ campaignId }: { campaignId: string }) {
  const { data } = useCampaign(campaignId);
  const recipients = data?.recipients ?? [];

  return (
    <section className="bg-card text-card-foreground rounded-xl border p-5">
      <h2 className="text-sm font-semibold">Recipients</h2>
      {recipients.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">
          Recipients are materialised when the campaign sends.
        </p>
      ) : (
        <ul className="mt-3 divide-y text-sm">
          {recipients.map((recipient) => (
            <li
              key={recipient.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{recipient.contactDisplayName}</p>
                <p className="text-muted-foreground text-xs">{recipient.phoneNumber}</p>
              </div>
              <Badge variant="outline">{recipient.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
