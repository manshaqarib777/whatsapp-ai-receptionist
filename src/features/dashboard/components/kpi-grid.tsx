'use client';

import { Clock, DollarSign, MessageSquare, Users } from 'lucide-react';
import Link from 'next/link';

import { Metric, type MetricSentiment } from '@/components/metric';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * KPI row — the four headline numbers.
 *
 * COMPONENT_DESIGN.md §7: four KPIs maximum; every metric carries a comparison
 * (delta + label); deltas use icon + sign + colour, never colour alone; and
 * "everything is a doorway" — each KPI links to its filtered detail view. The
 * `Metric` component enforces the first two; this row supplies the doorways and
 * the loading skeleton.
 */

export type KpiItem = {
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
  sentiment: MetricSentiment;
  icon: KpiIcon;
  href: string;
};

const ICONS = {
  conversation: MessageSquare,
  clock: Clock,
  revenue: DollarSign,
  leads: Users,
} as const;

export type KpiIcon = keyof typeof ICONS;

export function KpiGrid({
  kpis,
  className,
}: {
  kpis: {
    label: string;
    value: string;
    delta: number;
    deltaLabel: string;
    sentiment: MetricSentiment;
    href: string;
    icon: KpiIcon;
  }[];
  className?: string;
}) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}
    >
      {kpis.map((kpi) => {
        const Icon = ICONS[kpi.icon];
        return (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="focus-visible:ring-ring rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
          >
            <Metric
              label={kpi.label}
              value={kpi.value}
              delta={kpi.delta}
              deltaLabel={kpi.deltaLabel}
              sentiment={kpi.sentiment}
              icon={<Icon aria-hidden="true" className="size-4" />}
            />
          </Link>
        );
      })}
    </div>
  );
}

export function KpiGridSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}
      role="status"
      aria-busy="true"
      aria-label="Loading key metrics"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border p-4">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-8 w-28" />
          <Skeleton className="mt-3 h-3.5 w-32" />
        </div>
      ))}
    </div>
  );
}
