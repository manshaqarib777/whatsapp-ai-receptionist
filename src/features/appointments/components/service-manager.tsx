'use client';

import { useServices } from '@/features/appointments/hooks/use-appointments';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';

/**
 * Services list (M9). Creation UI is minimal in this milestone — the API
 * surface exists and the seed demonstrates the data.
 */

export function ServiceManager() {
  const { data, isPending, isError, refetch } = useServices();

  if (isPending && !data) {
    return <LoadingState rows={3} label="Loading services" />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const services = data?.services ?? [];

  if (services.length === 0) {
    return (
      <EmptyState title="No services yet" description="Add a service to start booking." />
    );
  }

  return (
    <ul className="max-w-xl space-y-2">
      {services.map((service) => (
        <li
          key={service.id}
          className="bg-card text-card-foreground flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3 text-sm"
        >
          <span className="font-medium">{service.name}</span>
          <Badge variant="secondary">{service.durationMinutes} min</Badge>
          <span className="text-muted-foreground tabular-nums">
            {service.priceAmount} {service.priceCurrency}
          </span>
        </li>
      ))}
    </ul>
  );
}
