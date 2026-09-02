'use client';

import { format } from 'date-fns';
import { useState } from 'react';

import {
  useCalendar,
  useCancelAppointment,
  type Appointment,
} from '@/features/appointments/hooks/use-appointments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';

/**
 * The appointment calendar — a 14-day rolling window of appointments (M9).
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

export function CalendarView() {
  // Computed once — a fresh `toISOString()` on every render would change the
  // query key each time and loop the fetch forever.
  const [range] = useState(() => {
    const from = new Date();
    const to = new Date(from.getTime() + 14 * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  });
  const { data, isPending, isError, refetch } = useCalendar(range.from, range.to);
  const cancel = useCancelAppointment();

  if (isPending && !data) {
    return <LoadingState rows={6} label="Loading appointments" />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const appointments = data?.appointments ?? [];

  if (appointments.length === 0) {
    return (
      <EmptyState
        title="No appointments in this window"
        description="Book a slot from the Book tab, or check back later."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {appointments.map((appointment) => (
        <AppointmentRow
          key={appointment.id}
          appointment={appointment}
          onCancel={() => cancel.mutate(appointment.id)}
          cancelling={cancel.isPending}
        />
      ))}
    </ul>
  );
}

function AppointmentRow({
  appointment,
  onCancel,
  cancelling,
}: {
  appointment: Appointment;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="bg-card text-card-foreground flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3 text-sm">
      <Badge variant={STATUS_VARIANTS[appointment.status] ?? 'outline'}>
        {appointment.status}
      </Badge>
      <span className="font-medium">
        {format(new Date(appointment.startsAt), 'EEE d MMM, HH:mm')}
      </span>
      <span className="text-muted-foreground">
        {format(new Date(appointment.endsAt), 'HH:mm')} · {appointment.timezone}
      </span>
      <span className="text-muted-foreground text-xs">
        service {appointment.serviceId.slice(0, 8)}
      </span>

      {appointment.status === 'booked' || appointment.status === 'confirmed' ? (
        <div className="ms-auto">
          {confirming ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={cancelling}
                onClick={onCancel}
              >
                {cancelling ? 'Cancelling…' : 'Confirm cancel'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
              Cancel
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}
