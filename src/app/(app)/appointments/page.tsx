import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState } from '@/components/states';
import { CalendarView } from '@/features/appointments/components/calendar-view';
import { ServiceManager } from '@/features/appointments/components/service-manager';
import { BookingForm } from '@/features/appointments/components/booking-form';
import { requireOrg } from '@/server/auth-context';

export const metadata = { title: 'Appointments' };

export const dynamic = 'force-dynamic';

/**
 * Appointment Engine (Milestone 9).
 *
 * Calendar + booking on one tab, services/resources on another. Every widget is
 * server-scoped and fails independently behind its own Suspense boundary.
 */
export default async function AppointmentsPage() {
  await requireOrg();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Calendars, availability, booking, and rescheduling."
      />

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="book">Book</TabsTrigger>
          <TabsTrigger value="services">Services & resources</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <Suspense fallback={<LoadingState rows={6} label="Loading calendar" />}>
            <CalendarView />
          </Suspense>
        </TabsContent>

        <TabsContent value="book" className="mt-4">
          <BookingForm />
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <ServiceManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
