'use client';

import type { ColumnDef } from '@tanstack/react-table';

import { ComparisonChart, Sparkline, TrendChart } from '@/components/charts';
import { DataTable } from '@/components/data-table';
import { Metric } from '@/components/metric';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  CHART_CONFIG,
  CHART_DATA,
  TABLE_DATA,
  type CustomerRow,
} from '@/features/design-system/fixtures';
import { Section } from '@/features/design-system/components/section';

const COLUMNS: ColumnDef<CustomerRow, unknown>[] = [
  { accessorKey: 'customer', header: 'Customer' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
  },
  {
    accessorKey: 'value',
    header: 'Value',
    // Numbers end-aligned with tabular figures (COMPONENT_DESIGN.md §5).
    cell: ({ row }) => (
      <span className="block text-end tabular-nums">{row.original.value.toFixed(2)}</span>
    ),
  },
];

export function DataSection() {
  return (
    <>
      <Section
        id="metrics"
        title="Metrics"
        description="Every metric carries its comparison period. Colour follows sentiment, not sign."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Conversations"
            value="1,284"
            delta={12}
            deltaLabel="vs last week"
          />
          <Metric
            label="Resolution rate"
            value="94%"
            delta={3}
            deltaLabel="vs last week"
          />
          {/* Falling response time is GOOD — sentiment overrides the sign. */}
          <Metric
            label="Avg response"
            value="2m 14s"
            delta={-8}
            deltaLabel="vs last week"
            sentiment="positive"
          />
          <Metric label="Escalations" value="18" delta={0} deltaLabel="vs last week" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Metric label="Loading" value="—" isLoading />

          <Card>
            <CardContent className="space-y-2">
              <p className="text-muted-foreground text-sm font-medium">With sparkline</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">88</p>
              <Sparkline
                data={CHART_DATA}
                config={CHART_CONFIG}
                categoryKey="date"
                series={['conversations']}
                summary="Conversations rose steadily to a Friday peak of 88, then fell over the weekend."
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        id="charts"
        title="Charts"
        description="Each chart ships a table fallback — a canvas is invisible to a screen reader."
      >
        <Card>
          <CardHeader>
            <CardTitle>Conversations over time</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <TrendChart
              data={CHART_DATA}
              config={CHART_CONFIG}
              categoryKey="date"
              series={['conversations', 'resolved']}
              summary="Conversations rose from 42 on Monday to a peak of 88 on Friday, with resolutions tracking closely behind."
            />
            <ComparisonChart
              data={CHART_DATA}
              config={CHART_CONFIG}
              categoryKey="date"
              series={['conversations']}
              summary="Friday saw the highest conversation volume at 88; Sunday the lowest at 21."
            />
          </CardContent>
        </Card>
      </Section>

      <Section
        id="tables"
        title="Tables"
        description="Sortable headers are real buttons with aria-sort. Loading and empty are table-shaped."
      >
        <DataTable columns={COLUMNS} data={TABLE_DATA} caption="Example customer table" />
        <DataTable
          columns={COLUMNS}
          data={[]}
          caption="Empty example"
          emptyTitle="No customers yet"
          emptyDescription="Customers appear here once someone messages your WhatsApp number."
          emptyAction={<Button size="sm">Connect WhatsApp</Button>}
        />
        <DataTable columns={COLUMNS} data={[]} caption="Loading example" isLoading />
      </Section>
    </>
  );
}
