'use client';

import { useState } from 'react';
import Link from 'next/link';

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

import {
  useCampaigns,
  useCreateCampaign,
  useSegments,
  useTemplates,
} from '@/features/broadcast/hooks/use-broadcast';

/**
 * Campaign list (M14) — status-filtered, with a create doorway that picks a
 * segment, an approved template, and an optional schedule.
 */

export const CAMPAIGN_STATUSES = [
  'all',
  'draft',
  'scheduled',
  'sending',
  'sent',
  'cancelled',
] as const;

const STATUS_LABELS: Record<string, string> = {
  all: 'All',
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  cancelled: 'Cancelled',
};

export function CampaignList() {
  const [status, setStatus] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isPending, isError, refetch } = useCampaigns(status);

  if (isPending && !data) {
    return <LoadingState rows={4} label="Loading campaigns" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const campaigns = data?.campaigns ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter by status"
        >
          {CAMPAIGN_STATUSES.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={status === value ? 'default' : 'outline'}
              onClick={() => setStatus(value)}
            >
              {STATUS_LABELS[value]}
            </Button>
          ))}
        </div>
        <Button onClick={() => setCreateOpen(true)}>New campaign</Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          title={
            status === 'all'
              ? 'No campaigns yet'
              : `No ${STATUS_LABELS[status]} campaigns`
          }
          description="Create a campaign to send a template to a segment."
        />
      ) : (
        <ul className="bg-card text-card-foreground divide-y overflow-hidden rounded-xl border">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/broadcast/${campaign.id}`}
                  className="hover:text-foreground text-sm font-medium hover:underline"
                >
                  {campaign.name}
                </Link>
                <p className="text-muted-foreground text-xs">
                  {campaign.segmentName} · {campaign.templateName}
                </p>
              </div>
              <Badge variant={campaign.status === 'sent' ? 'secondary' : 'outline'}>
                {campaign.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <CreateCampaignDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateCampaignDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateCampaign();
  const segments = useSegments();
  const templates = useTemplates();

  const [name, setName] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');

  const approvedTemplates = (templates.data?.templates ?? []).filter(
    (template) => template.metaStatus === 'approved',
  );

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || !segmentId || !templateId) return;
    create.mutate(
      {
        name: trimmed,
        segmentId,
        templateId,
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          setName('');
          setSegmentId('');
          setTemplateId('');
          setScheduledFor('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Pick a segment and an approved template. The segment is evaluated at send
            time, never stored as a snapshot.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. June checkup reminder"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-segment">Segment</Label>
            <Select value={segmentId} onValueChange={setSegmentId}>
              <SelectTrigger id="campaign-segment" className="w-full">
                <SelectValue placeholder="Choose a segment" />
              </SelectTrigger>
              <SelectContent>
                {(segments.data?.segments ?? []).map((segment) => (
                  <SelectItem key={segment.id} value={segment.id}>
                    {segment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-template">Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="campaign-template" className="w-full">
                <SelectValue placeholder="Choose an approved template" />
              </SelectTrigger>
              <SelectContent>
                {approvedTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} ({template.language})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.data && approvedTemplates.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No approved templates yet — add one on the Templates page.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-schedule">Schedule (optional)</Label>
            <Input
              id="campaign-schedule"
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Leave empty to send as soon as the campaign is started.
            </p>
          </div>
        </div>
        {create.isError ? (
          <p className="text-destructive text-sm">
            Could not create the campaign — check that the template is approved.
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || !segmentId || !templateId || create.isPending}
            onClick={submit}
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
