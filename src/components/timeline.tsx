import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Timeline — ordered events with a connecting rail.
 *
 * Rendered as an ordered list so screen readers announce position and count. The
 * rail and dots are decorative and hidden from assistive technology; the meaning
 * lives entirely in the text.
 */

export type TimelineItem = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  timestamp?: ReactNode;
  icon?: LucideIcon;
};

export function Timeline({
  items,
  className,
}: {
  items: TimelineItem[];
  className?: string;
}) {
  return (
    <ol className={cn('relative space-y-6', className)}>
      {items.map((item, index) => {
        const Icon = item.icon;
        const isLast = index === items.length - 1;

        return (
          <li key={item.id} className="relative flex gap-4">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className="bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full border"
              >
                {Icon ? (
                  <Icon className="size-3.5" />
                ) : (
                  <span className="bg-muted-foreground size-1.5 rounded-full" />
                )}
              </span>

              {/* The rail stops at the last item rather than trailing into nothing. */}
              {!isLast ? (
                <span aria-hidden="true" className="bg-border mt-1 w-px flex-1" />
              ) : null}
            </div>

            <div className="flex-1 space-y-1 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium">{item.title}</p>
                {item.timestamp ? (
                  <span className="text-muted-foreground text-xs">{item.timestamp}</span>
                ) : null}
              </div>
              {item.description ? (
                <p className="text-muted-foreground text-sm">{item.description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
