import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Metric } from '@/components/metric';
import { ComparisonChart, type ChartPoint } from '@/components/charts';
import { type ChartConfig } from '@/components/ui/chart';

import { formatCurrency } from '@/features/analytics/services/analytics.service';
import type { BookingsOverview } from '@/features/analytics/services/analytics.service';

/**
 * Bookings section (M15) — presentational. Receives the computed overview from
 * the server page; renders the status distribution and booking value.
 */

const BOOKINGS_CHART_CONFIG: ChartConfig = {
  appointments: { label: 'Appointments', color: 'var(--chart-1)' },
};

const STATUS_LABELS: Record<string, string> = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

export function BookingsSection({ bookings }: { bookings: BookingsOverview }) {
  const data: ChartPoint[] = bookings.byStatus.map((row) => ({
    status: STATUS_LABELS[row.status] ?? row.status,
    appointments: row.count,
  }));

  const pct = (value: number | null) => (value === null ? '—' : `${value}%`);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Bookings</CardTitle>
        <CardDescription>
          Appointment volume by status and the value of booked services in the period.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Appointments" value={String(bookings.total)} />
          <Metric label="Booking value" value={formatCurrency(bookings.value)} />
          <Metric
            label="Cancelled"
            value={String(bookings.cancelledCount)}
            deltaLabel={pct(bookings.cancellationRate)}
          />
          <Metric
            label="No shows"
            value={String(bookings.noShowCount)}
            deltaLabel={pct(bookings.noShowRate)}
          />
        </div>

        {data.length > 0 ? (
          <ComparisonChart
            data={data}
            config={BOOKINGS_CHART_CONFIG}
            categoryKey="status"
            series={['appointments']}
            summary={`${bookings.total} appointments in the period, by status.`}
          />
        ) : (
          <p className="text-muted-foreground text-sm">No appointments in the period.</p>
        )}
      </CardContent>
    </Card>
  );
}
