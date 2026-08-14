import { Suspense } from 'react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { LoadingState } from '@/components/states';
import { AppointmentDetail } from '@/features/appointments/components/appointment-detail';
import { requireOrg } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Appointment' };

export const dynamic = 'force-dynamic';

/**
 * Appointment detail — a single booking with cancel and reschedule (M9).
 * The dashboard's upcoming-appointments rows link here.
 */
export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrg();
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment"
        description="Booking details, reschedule, and cancellation."
      />
      <Suspense fallback={<LoadingState rows={5} label="Loading appointment" />}>
        <AppointmentDetail appointmentId={id} />
      </Suspense>
    </div>
  );
}
