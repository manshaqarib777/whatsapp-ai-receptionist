'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ANALYTICS_RANGES, type AnalyticsRange } from '@/features/analytics/lib/range';

/**
 * Analytics date range picker.
 *
 * Same cookie → refresh pattern as the dashboard's RangePicker, extended with
 * 180d and 12m for longer-horizon analytics. The cookie is read server-side by
 * the page, so the first paint already reflects the choice.
 */

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  '30d': '30 days',
  '90d': '90 days',
  '180d': '180 days',
  '12m': '12 months',
};

export function AnalyticsRangePicker({
  value,
  className,
}: {
  value: AnalyticsRange;
  className?: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function selectRange(next: AnalyticsRange) {
    if (next === value || saving) return;

    setSaving(true);
    try {
      const response = await fetch('/api/analytics/range', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: next }),
      });

      if (!response.ok) return;
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="group"
      aria-label="Date range"
      className={cn('bg-muted flex items-center gap-0.5 rounded-lg p-0.5', className)}
    >
      {ANALYTICS_RANGES.map((option) => {
        const isActive = option === value;
        return (
          <Button
            key={option}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            disabled={saving}
            onClick={() => selectRange(option)}
            className={cn(
              'h-7 px-2.5 text-xs font-medium',
              isActive && 'bg-background text-foreground shadow-sm',
              !isActive && 'text-muted-foreground',
            )}
          >
            {RANGE_LABELS[option]}
          </Button>
        );
      })}
    </div>
  );
}
