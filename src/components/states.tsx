import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * The four states, as components.
 *
 * `UI_RULES.md` requires every data-bound component to handle loading, error, empty,
 * and success. Providing them here means a feature cannot skip one by accident, and
 * that "No data" never ships as an empty state.
 */

/**
 * Empty state.
 *
 * Explains WHY it is empty and offers the next action. A bare "No results" tells the
 * user nothing and gives them nowhere to go (`UI_RULES.md` → The Four States).
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-2xl">
        <Icon aria-hidden="true" className="size-5" />
      </div>

      <div className="max-w-sm space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      {action}
    </div>
  );
}

/**
 * Error state.
 *
 * Says what failed in plain language and offers a retry. Never a raw stack — that is
 * both unhelpful and an information leak (`SECURITY_RULES.md`).
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'This could not be loaded. Try again in a moment.',
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-12 text-center',
        className,
      )}
    >
      <div className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-2xl">
        <AlertCircle aria-hidden="true" className="size-5" />
      </div>

      <div className="max-w-sm space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Loading state — a skeleton shaped like the content it replaces.
 *
 * Line widths vary because a paragraph of equal bars reads as a loading bar, not as
 * text. `aria-busy` plus a label means a screen reader announces what is loading
 * rather than nothing (`MOTION_RULES.md` → Skeleton Loaders).
 */
export function LoadingState({
  rows = 3,
  label = 'Loading',
  className,
}: {
  rows?: number;
  label?: string;
  className?: string;
}) {
  const widths = ['w-3/4', 'w-full', 'w-5/6', 'w-2/3', 'w-4/5'];

  return (
    <div
      // `role="status"` is not decoration: `aria-label` on a bare div is invalid ARIA
      // and is ignored, so without a role the label announces nothing at all.
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn('space-y-3', className)}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton
          key={index}
          aria-hidden="true"
          className={cn('h-4', widths[index % widths.length])}
        />
      ))}
    </div>
  );
}
