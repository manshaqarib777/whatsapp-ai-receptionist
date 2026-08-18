'use client';

import { useState } from 'react';
import { format } from 'date-fns';

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
  useCreateReviewRequest,
  useReviewPlatforms,
  useReviewRequests,
  useReviewRequestTransition,
} from '@/features/reviews/hooks/use-reviews';
import type { ReviewRequestRow } from '@/features/reviews/repositories/reviews.types';

/**
 * Review request list (M16) — contact, appointment, platform, status, and the
 * lifecycle actions (send, cancel). A create dialog asks for a review after a
 * completed appointment.
 */

export const REQUEST_FILTERS = [
  'all',
  'created',
  'sent',
  'responded',
  'expired',
  'cancelled',
] as const;

export function ReviewRequestList() {
  const [status, setStatus] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isPending, isError, refetch } = useReviewRequests(status);

  if (isPending && !data) {
    return <LoadingState rows={4} label="Loading requests" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const requests = data?.requests ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter requests">
          {REQUEST_FILTERS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={status === value ? 'default' : 'outline'}
              onClick={() => setStatus(value)}
            >
              {value === 'all' ? 'All' : value[0]?.toUpperCase() + value.slice(1)}
            </Button>
          ))}
        </div>
        <Button onClick={() => setCreateOpen(true)}>New request</Button>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No review requests yet"
          description="Requests are created automatically after completed appointments, or by hand here."
        />
      ) : (
        <ul className="bg-card text-card-foreground divide-y overflow-hidden rounded-xl border">
          {requests.map((request) => (
            <RequestRowItem key={request.id} request={request} />
          ))}
        </ul>
      )}

      <CreateRequestDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function RequestRowItem({ request }: { request: ReviewRequestRow }) {
  const transition = useReviewRequestTransition();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{request.contactDisplayName}</p>
        <p className="text-muted-foreground text-xs">
          {request.platformName} ·{' '}
          {request.appointmentStartsAt
            ? format(new Date(request.appointmentStartsAt), 'd MMM yyyy')
            : 'no appointment date'}
          {request.sentAt ? ` · sent ${format(new Date(request.sentAt), 'd MMM')}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={request.status === 'responded' ? 'secondary' : 'outline'}>
          {request.status}
        </Badge>
        {request.status === 'created' ? (
          <>
            <Button
              size="sm"
              disabled={transition.isPending}
              onClick={() => transition.mutate({ id: request.id, action: 'send' })}
            >
              Send
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={transition.isPending}
              onClick={() => transition.mutate({ id: request.id, action: 'cancel' })}
            >
              Cancel
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function CreateRequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateReviewRequest();
  const platforms = useReviewPlatforms();

  const [contactId, setContactId] = useState('');
  const [appointmentId, setAppointmentId] = useState('');
  const [platformId, setPlatformId] = useState('');

  const submit = () => {
    if (!contactId || !appointmentId || !platformId) return;
    create.mutate(
      { contactId, appointmentId, platformId },
      {
        onSuccess: () => {
          setContactId('');
          setAppointmentId('');
          setPlatformId('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New review request</DialogTitle>
          <DialogDescription>
            Ask a customer for a review after a completed appointment. The contact must
            have consented.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="request-contact">Contact id</Label>
            <Input
              id="request-contact"
              value={contactId}
              onChange={(event) => setContactId(event.target.value)}
              placeholder="The contact's UUID"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="request-appointment">Appointment id</Label>
            <Input
              id="request-appointment"
              value={appointmentId}
              onChange={(event) => setAppointmentId(event.target.value)}
              placeholder="The completed appointment's UUID"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="request-platform">Platform</Label>
            <Select value={platformId} onValueChange={setPlatformId}>
              <SelectTrigger id="request-platform" className="w-full">
                <SelectValue placeholder="Choose a platform" />
              </SelectTrigger>
              <SelectContent>
                {(platforms.data?.platforms ?? []).map((platform) => (
                  <SelectItem key={platform.id} value={platform.id}>
                    {platform.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {create.isError ? (
          <p className="text-destructive text-sm">
            Could not create the request — check the ids and the contact&apos;s consent.
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!contactId || !appointmentId || !platformId || create.isPending}
            onClick={submit}
          >
            {create.isPending ? 'Creating…' : 'Create request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
