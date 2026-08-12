'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Global date range for the dashboard.
 *
 * COMPONENT_DESIGN.md §7: the date range is global and persisted, at the top,
 * applying to every widget. The choice is stored in a cookie read server-side by
 * the layout, so the first paint already reflects it — the same first-paint-correct
 * pattern `AppShell` uses for `sidebar:collapsed`. The client only writes the
 * cookie via the API route and refreshes; it never decides what the page shows.
 */

export const RANGE_OPTIONS = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
] as const;

export type RangeOption = (typeof RANGE_OPTIONS)[number]['value'];

export function RangePicker({
  value,
  className,
}: {
  value: RangeOption;
  className?: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function selectRange(next: RangeOption) {
    if (next === value || saving) return;

    setSaving(true);
    try {
      const response = await fetch('/api/dashboard/range', {
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
      {RANGE_OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            disabled={saving}
            onClick={() => selectRange(option.value)}
            className={cn(
              'h-7 px-2.5 text-xs font-medium',
              isActive && 'bg-background text-foreground shadow-sm',
              !isActive && 'text-muted-foreground',
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
