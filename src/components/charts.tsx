'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';

/**
 * Chart wrappers.
 *
 * Enforce COMPONENT_DESIGN.md §8 centrally, because these rules are what separate a
 * chart that reads instantly from one that reads as clutter:
 *
 *   - horizontal gridlines only, and only 4–5 of them
 *   - no chart border, no background fill, no 3D, no shadows on bars
 *   - axis numbers formatted (1.2k, not 1200.00000)
 *   - a bar chart's Y axis starts at zero — a truncated bar axis misrepresents
 *     magnitude, which is the most common way a chart lies
 *
 * ACCESSIBILITY: a chart is an image to a screen reader. Every wrapper takes a
 * `summary` describing the TREND (not the data), and renders the underlying numbers
 * as a visually-hidden table. That table is the accessible equivalent, not a
 * nice-to-have (ACCESSIBILITY_RULES.md 1.1.1).
 */

export type ChartPoint = Record<string, string | number>;

type BaseProps = {
  data: ChartPoint[];
  config: ChartConfig;
  /** X-axis key, e.g. "date". */
  categoryKey: string;
  /** Series keys to plot. Maximum 6 — beyond that, group into "Other". */
  series: string[];
  /** Describes the TREND for screen readers, e.g. "Conversations rose 12%…". */
  summary: string;
  className?: string;
};

/** 1234 → "1.2k". Raw axis numbers are unreadable at a glance. */
export function formatAxisNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/** The visually-hidden data table that makes a chart readable by assistive tech. */
function DataFallback({
  data,
  categoryKey,
  series,
  config,
  summary,
}: Pick<BaseProps, 'data' | 'categoryKey' | 'series' | 'config' | 'summary'>) {
  return (
    // The wrapper carries `sr-only`, not the table. `sr-only` works by clamping an
    // element to 1px with `overflow: hidden`, and a <table> lays out to its content
    // regardless — so putting it on the table left a full-width table positioned off
    // the page, which is exactly the horizontal overflow a mobile viewport reports.
    <div className="sr-only">
      <table>
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">{categoryKey}</th>
            {series.map((key) => (
              <th key={key} scope="col">
                {config[key]?.label ?? key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((point, index) => (
            <tr key={index}>
              <th scope="row">{String(point[categoryKey])}</th>
              {series.map((key) => (
                <td key={key}>{String(point[key] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  className: 'text-xs',
} as const;

export function TrendChart({
  data,
  config,
  categoryKey,
  series,
  summary,
  variant = 'line',
  className,
}: BaseProps & { variant?: 'line' | 'area' }) {
  const Chart = variant === 'area' ? AreaChart : LineChart;

  return (
    <figure className={cn('w-full', className)} role="img" aria-label={summary}>
      {/* Explicit height, not aspect-ratio: aspect-video on a wide card renders a
          seven-point chart over 500px tall, which reads as empty space rather than
          data. Height is a function of legibility, not of container width. */}
      <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
        <Chart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
          {/* Horizontal only — vertical gridlines almost never aid reading. */}
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={categoryKey} {...AXIS_PROPS} />
          <YAxis tickFormatter={formatAxisNumber} width={44} {...AXIS_PROPS} />
          <ChartTooltip content={<ChartTooltipContent />} />

          {series.map((key, index) =>
            variant === 'area' ? (
              <Area
                key={key}
                dataKey={key}
                type="monotone"
                stroke={`var(--chart-${index + 1})`}
                fill={`var(--chart-${index + 1})`}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            ) : (
              <Line
                key={key}
                dataKey={key}
                type="monotone"
                stroke={`var(--chart-${index + 1})`}
                strokeWidth={2}
                dot={false}
              />
            ),
          )}
        </Chart>
      </ChartContainer>

      <DataFallback
        data={data}
        categoryKey={categoryKey}
        series={series}
        config={config}
        summary={summary}
      />
    </figure>
  );
}

export function ComparisonChart({
  data,
  config,
  categoryKey,
  series,
  summary,
  className,
}: BaseProps) {
  return (
    <figure className={cn('w-full', className)} role="img" aria-label={summary}>
      <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
        <BarChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={categoryKey} {...AXIS_PROPS} />
          {/* domain starts at 0: a truncated bar axis misrepresents magnitude. */}
          <YAxis
            domain={[0, 'auto']}
            tickFormatter={formatAxisNumber}
            width={44}
            {...AXIS_PROPS}
          />
          <ChartTooltip content={<ChartTooltipContent />} />

          {series.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              fill={`var(--chart-${index + 1})`}
              radius={[6, 6, 0, 0]}
            />
          ))}
        </BarChart>
      </ChartContainer>

      <DataFallback
        data={data}
        categoryKey={categoryKey}
        series={series}
        config={config}
        summary={summary}
      />
    </figure>
  );
}

/**
 * Sparkline — shape only, no axes or grid. Pairs with a Metric where the number is
 * the message and the trend is context.
 */
export function Sparkline({
  data,
  config,
  categoryKey,
  series,
  summary,
  className,
}: BaseProps) {
  const key = series[0];
  if (!key) return null;

  return (
    <figure className={cn('w-full', className)} role="img" aria-label={summary}>
      <ChartContainer config={config} className="aspect-auto h-12 w-full">
        <LineChart data={data} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
          <Line
            dataKey={key}
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ChartContainer>

      <DataFallback
        data={data}
        categoryKey={categoryKey}
        series={series}
        config={config}
        summary={summary}
      />
    </figure>
  );
}
