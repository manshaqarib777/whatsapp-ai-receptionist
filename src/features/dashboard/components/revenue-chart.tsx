import { TrendChart } from '@/components/charts';
import type { ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Revenue chart — cumulative invoice value issued across the range.
 *
 * Shown as an area chart (COMPONENT_DESIGN.md §8: "area if cumulative"). The
 * `revenue` series is the total of invoices issued in the period, excluding void.
 * The chart wrapper handles the accessibility contract.
 */

type RevenueChartProps = {
  data: { date: Date; label: string; revenue: number }[];
  summary: string;
};

const CONFIG: ChartConfig = {
  revenue: { label: 'Revenue', color: 'var(--chart-2)' },
};

export function RevenueChart({ data, summary }: RevenueChartProps) {
  const total = data.reduce((sum, point) => sum + point.revenue, 0);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Revenue</CardTitle>
        <CardDescription>
          {total > 0 ? 'Invoiced value in this period' : 'No invoices issued yet in this period.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">
            Invoiced revenue will appear here as invoices are issued.
          </p>
        ) : (
          <TrendChart
            data={data.map((point) => ({
              label: point.label,
              revenue: point.revenue,
            }))}
            config={CONFIG}
            categoryKey="label"
            series={['revenue']}
            summary={summary}
            variant="area"
          />
        )}
      </CardContent>
    </Card>
  );
}
