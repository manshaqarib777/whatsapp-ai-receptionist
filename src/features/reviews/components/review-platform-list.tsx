'use client';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';

import { useReviewPlatforms } from '@/features/reviews/hooks/use-reviews';

/**
 * Platform list (M16) — Google/Facebook connection state. The adapters are
 * `unconfigured` in M16 (real APIs need OAuth credentials), so both show as
 * unconfigured until the integration milestone wires them.
 */

export function ReviewPlatformList() {
  const { data, isPending, isError, refetch } = useReviewPlatforms();

  if (isPending && !data) {
    return <LoadingState rows={2} label="Loading platforms" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const platforms = data?.platforms ?? [];

  if (platforms.length === 0) {
    return (
      <EmptyState
        title="No review platforms"
        description="Google and Facebook platforms are created automatically."
      />
    );
  }

  return (
    <ul className="bg-card text-card-foreground divide-y overflow-hidden rounded-xl border">
      {platforms.map((platform) => (
        <li
          key={platform.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{platform.name}</p>
            <p className="text-muted-foreground text-xs">{platform.provider}</p>
          </div>
          {platform.isConnected ? (
            <Badge variant="secondary">Connected</Badge>
          ) : (
            <Badge variant="outline">Not configured</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
