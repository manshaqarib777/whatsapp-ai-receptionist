'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Metric card — the KPI tile used across dashboards.
 *
 * Two rules from COMPONENT_DESIGN.md §7 are enforced by the API rather than left to
 * the caller:
 *
 * 1. **A delta requires a comparison period.** `1,284` is trivia; "1,284, up 12% on
 *    last week" is information. `deltaLabel` is required whenever `delta` is given.
 *
 * 2. **Down is not always bad.** Response time falling is good. `sentiment` decides
 *    the colour, not the sign — so the component cannot silently mislead.
 */

export type MetricSentiment = 'positive' | 'negative' | 'neutral';

type MetricProps = {
  label: string;
  value: string;
  /** Signed percentage, e.g. 12 or -8. Omit when there is nothing to compare to. */
  delta?: number;
  /** Required with `delta` — the period compared against. */
  deltaLabel?: string;
  /**
   * Whether the change is good or bad. Defaults to reading a rise as positive, which
   * is wrong for latency and cost metrics — set it explicitly for those.
   */
  sentiment?: MetricSentiment;
  icon?: ReactNode;
  isLoading?: boolean;
  className?: string;
};

function resolveSentiment(
  delta: number,
  explicit: MetricSentiment | undefined,
): MetricSentiment {
  if (explicit) return explicit;
  if (delta === 0) return 'neutral';
  return delta > 0 ? 'positive' : 'negative';
}

export function Metric({
  label,
  value,
  delta,
  deltaLabel,
  sentiment,
  icon,
  isLoading = false,
  className,
}: MetricProps) {
  if (isLoading) {
    return (
      <Card className={cn('rounded-2xl', className)}>
        <CardContent
          role="status"
          aria-busy="true"
          aria-label={`Loading ${label}`}
          className="space-y-3"
        >
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3.5 w-32" />
        </CardContent>
      </Card>
    );
  }

  const hasDelta = typeof delta === 'number';
  const tone = hasDelta ? resolveSentiment(delta, sentiment) : 'neutral';

  // Direction and sentiment are separate: the arrow shows which way the number moved,
  // the colour shows whether that is good.
  const DirectionIcon =
    !hasDelta || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;

  return (
    <Card className={cn('rounded-2xl', className)}>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>

        {/* Proportional sans with tabular figures, not full monospace: mono gives a
            comma a full character width, so "1,284" reads with a gap in it. Tabular
            still keeps the digits from jittering as values update. */}
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>

        {hasDelta ? (
          <p className="flex items-center gap-1.5 text-xs">
            {/* Icon + sign + colour. Never colour alone (DESIGN_RULES.md). */}
            <span
              className={cn(
                'flex items-center gap-0.5 font-medium',
                tone === 'positive' && 'text-success',
                tone === 'negative' && 'text-destructive',
                tone === 'neutral' && 'text-muted-foreground',
              )}
            >
              <DirectionIcon aria-hidden="true" className="size-3.5" />
              {delta > 0 ? '+' : ''}
              {delta}%
            </span>
            {deltaLabel ? (
              <span className="text-muted-foreground">{deltaLabel}</span>
            ) : null}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
