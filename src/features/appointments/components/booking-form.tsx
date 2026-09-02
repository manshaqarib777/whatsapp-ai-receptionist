'use client';

import { useState } from 'react';

import {
  useBook,
  useServices,
  useAvailability,
} from '@/features/appointments/hooks/use-appointments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';

/**
 * Booking form (M9): pick a service + date, see open slots, book one.
 * Contact id is taken as an input in M9 (the contact picker is M10's surface).
 */

export function BookingForm() {
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [contactId, setContactId] = useState('');
  const [picked, setPicked] = useState<{ resourceId: string; startsAt: string } | null>(
    null,
  );

  const {
    data: servicesData,
    isPending: servicesPending,
    isError: servicesError,
    refetch: refetchServices,
  } = useServices();
  const {
    data: availabilityData,
    isPending: availabilityPending,
    isError: availabilityError,
    refetch: refetchAvailability,
  } = useAvailability(serviceId, date);
  const book = useBook();

  if (servicesPending && !servicesData) {
    return <LoadingState rows={3} label="Loading services" />;
  }
  if (servicesError) {
    return <ErrorState onRetry={() => void refetchServices()} />;
  }

  const services = servicesData?.services ?? [];
  const slotsByResource = availabilityData?.slots ?? [];

  return (
    <div className="max-w-xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="book-service">Service</Label>
          <Select value={serviceId} onValueChange={setServiceId}>
            <SelectTrigger id="book-service">
              <SelectValue placeholder="Choose a service" />
            </SelectTrigger>
            <SelectContent>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name} ({service.durationMinutes} min)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="book-date">Date</Label>
          <Input
            id="book-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="book-contact">Contact id</Label>
          <Input
            id="book-contact"
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </div>
      </div>

      {serviceId && date ? (
        availabilityPending ? (
          <LoadingState rows={3} label="Checking availability" />
        ) : availabilityError ? (
          <ErrorState onRetry={() => void refetchAvailability()} />
        ) : slotsByResource.length === 0 ? (
          <EmptyState title="No open slots" description="Try another service or date." />
        ) : (
          <div className="space-y-3">
            {slotsByResource.map(({ resourceId, slots }) => (
              <div key={resourceId} className="rounded-lg border p-3">
                <p className="text-muted-foreground mb-2 text-xs">
                  Resource {resourceId.slice(0, 8)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <Button
                      key={slot.startsAt}
                      size="sm"
                      variant={picked?.startsAt === slot.startsAt ? 'default' : 'outline'}
                      onClick={() => setPicked({ resourceId, startsAt: slot.startsAt })}
                    >
                      {new Date(slot.startsAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Button>
                  ))}
                </div>
              </div>
            ))}

            <Button
              disabled={!picked || !contactId.trim() || book.isPending}
              onClick={() => {
                if (!picked) return;
                book.mutate({
                  contactId: contactId.trim(),
                  serviceId,
                  resourceId: picked.resourceId,
                  startsAt: picked.startsAt,
                  timezone: 'Asia/Riyadh',
                });
              }}
            >
              {book.isPending ? 'Booking…' : 'Book appointment'}
            </Button>

            {book.isError ? (
              <p className="text-destructive text-sm">
                {book.error instanceof Error ? book.error.message : 'Booking failed.'}
              </p>
            ) : null}
            {book.isSuccess ? <p className="text-success text-sm">Booked.</p> : null}
          </div>
        )
      ) : null}
    </div>
  );
}
