'use client';

import { format } from 'date-fns';
import { CalendarDays, Clock } from 'lucide-react';
import { useState } from 'react';

import {
  useAppointment,
  useCancelAppointment,
  useRescheduleAppointment,
} from '@/features/appointments/hooks/use-appointments';
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
import { EmptyState, ErrorState, LoadingState } from '@/components/states';

/**
 * Appointment detail — a single booking with cancel and reschedule (M9).
 *
 * Cancel keeps a confirm step so a misplaced tap cannot destroy a booking.
 * Reschedule is a `datetime-local` input converted to an ISO instant; the API
 * refuses slots that conflict, so a booked-away time surfaces as a clear error.
 */

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  booked: 'default',
  confirmed: 'secondary',
  cancelled: 'destructive',
  rescheduled: 'outline',
  completed: 'secondary',
  no_show: 'destructive',
};

export function AppointmentDetail({ appointmentId }: { appointmentId: string }) {
  const { data, isPending, isError, refetch } = useAppointment(appointmentId);
  const cancel = useCancelAppointment();
  const reschedule = useRescheduleAppointment();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newStartsAt, setNewStartsAt] = useState('');

  if (isPending && !data) {
    return <LoadingState rows={5} label="Loading appointment" />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const appointment = data?.appointment;
  if (!appointment) {
    return (
      <EmptyState
        title="Appointment not found"
        description="It may have been removed, or the link is out of date."
      />
    );
  }

  const isLive = appointment.status === 'booked' || appointment.status === 'confirmed';

  const confirmCancel = () => {
    cancel.mutate(appointment.id, {
      onSuccess: () => {
        setCancelOpen(false);
        void refetch();
      },
    });
  };

  const confirmReschedule = () => {
    if (!newStartsAt) return;
    reschedule.mutate(
      { id: appointment.id, startsAt: new Date(newStartsAt).toISOString() },
      {
        onSuccess: () => {
          setRescheduleOpen(false);
          setNewStartsAt('');
          void refetch();
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <section className="bg-card text-card-foreground space-y-3 rounded-xl border p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge variant={STATUS_VARIANTS[appointment.status] ?? 'outline'}>
            {appointment.status}
          </Badge>
          <span className="text-muted-foreground text-sm">{appointment.timezone}</span>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Starts</dt>
            <dd className="flex items-center gap-2 font-medium">
              <CalendarDays aria-hidden="true" className="text-muted-foreground size-4" />
              {format(new Date(appointment.startsAt), 'EEE d MMM yyyy, HH:mm')}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Ends</dt>
            <dd className="flex items-center gap-2 font-medium">
              <Clock aria-hidden="true" className="text-muted-foreground size-4" />
              {format(new Date(appointment.endsAt), 'EEE d MMM yyyy, HH:mm')}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Service</dt>
            <dd>{appointment.serviceId.slice(0, 8)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Resource</dt>
            <dd>{appointment.resourceId.slice(0, 8)}</dd>
          </div>
        </dl>

        {appointment.notes ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Notes</dt>
            <dd className="text-sm">{appointment.notes}</dd>
          </div>
        ) : null}

        {isLive ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setNewStartsAt(appointment.startsAt);
                setRescheduleOpen(true);
              }}
            >
              Reschedule
            </Button>
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              Cancel appointment
            </Button>
          </div>
        ) : null}
      </section>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this appointment?</DialogTitle>
            <DialogDescription>
              The slot is released and any scheduled reminders are cancelled. This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep appointment
            </Button>
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={confirmCancel}
            >
              {cancel.isPending ? 'Cancelling…' : 'Cancel appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule appointment</DialogTitle>
            <DialogDescription>
              Pick a new start time. Slots that conflict with another booking are refused.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-datetime">New start</Label>
            <Input
              id="reschedule-datetime"
              type="datetime-local"
              value={newStartsAt}
              onChange={(event) => setNewStartsAt(event.target.value)}
            />
          </div>
          {reschedule.isError ? (
            <p className="text-destructive text-sm">
              {reschedule.error instanceof Error
                ? reschedule.error.message
                : 'Rescheduling failed.'}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>
              Keep current time
            </Button>
            <Button
              disabled={!newStartsAt || reschedule.isPending}
              onClick={confirmReschedule}
            >
              {reschedule.isPending ? 'Rescheduling…' : 'Reschedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
