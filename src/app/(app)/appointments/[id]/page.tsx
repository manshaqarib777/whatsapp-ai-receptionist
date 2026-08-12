import { CalendarDays } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/states';
import { requireOrg } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Appointment' };

/**
 * Appointment detail doorway — Milestone 9 builds the booking engine.
 *
 * The dashboard's upcoming-appointments rows link here. This deliberate stub keeps
 * the doorway real (COMPONENT_DESIGN.md §7) without building future scope.
 */
export default async function AppointmentDetailPage() {
  await requireOrg();

  return (
    <EmptyState
      icon={CalendarDays}
      title="Appointments are being built"
      description="Booking, rescheduling, and reminders arrive with the Appointment Engine in Milestone 9."
    />
  );
}
