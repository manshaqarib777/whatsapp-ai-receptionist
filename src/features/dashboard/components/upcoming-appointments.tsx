import { CalendarDays } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Upcoming appointments — the next few non-cancelled bookings.
 *
 * Each row is a doorway to the appointment (which lives in Milestone 9; the stub
 * route exists so the link is real). Timestamps are formatted with Intl, locale-
 * aware for the Arabic/RTL product.
 */

type Appointment = {
  id: string;
  contactDisplayName: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  branchId: string;
};

function formatStart(date: Date): string {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function UpcomingAppointments({ appointments }: { appointments: Appointment[] }) {
  if (appointments.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Upcoming appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-10 text-center text-sm">
            New bookings will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Upcoming appointments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {appointments.map((appointment) => (
          <Link
            key={appointment.id}
            href={`/appointments/${appointment.id}`}
            className="hover:bg-muted focus-visible:ring-ring flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                <CalendarDays aria-hidden="true" className="size-4" />
              </span>
              <span className="truncate text-sm font-medium">
                {appointment.contactDisplayName}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className="hidden sm:inline-flex">
                {appointment.status}
              </Badge>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatStart(appointment.startsAt)}
              </span>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
