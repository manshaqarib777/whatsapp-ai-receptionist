import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Metric } from '@/components/metric';
import { TrendChart, type ChartPoint } from '@/components/charts';
import { type ChartConfig } from '@/components/ui/chart';

import { formatCurrency } from '@/features/analytics/services/analytics.service';
import type { RevenueOverview } from '@/features/analytics/services/analytics.service';

/**
 * Revenue section (M15) — presentational. Receives the computed overview from
 * the server page; renders the KPIs and the invoiced/collected trend.
 */

const REVENUE_CHART_CONFIG: ChartConfig = {
  invoiced: { label: 'Invoiced', color: 'var(--chart-1)' },
  collected: { label: 'Collected', color: 'var(--chart-2)' },
};

export function RevenueSection({ revenue }: { revenue: RevenueOverview }) {
  const data: ChartPoint[] = revenue.invoicedSeries.map((point, index) => ({
    date: point.label,
    invoiced: point.amount,
    collected: revenue.collectedSeries[index]?.amount ?? 0,
  }));

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Revenue</CardTitle>
        <CardDescription>
          Invoiced vs collected across the period. Outstanding is the difference.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Invoiced" value={formatCurrency(revenue.invoiced)} />
          <Metric label="Collected" value={formatCurrency(revenue.collected)} />
          <Metric label="Outstanding" value={formatCurrency(revenue.outstanding)} />
          <Metric label="Refunds" value={formatCurrency(revenue.refunds)} />
        </div>
        <TrendChart
          data={data}
          config={REVENUE_CHART_CONFIG}
          categoryKey="date"
          series={['invoiced', 'collected']}
          variant="area"
          summary={`Invoiced ${formatCurrency(revenue.invoiced)} and collected ${formatCurrency(revenue.collected)} across the period.`}
        />
      </CardContent>
    </Card>
  );
}
