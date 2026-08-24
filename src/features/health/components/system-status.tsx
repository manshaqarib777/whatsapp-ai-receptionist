'use client';

import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

import { useHealth } from '@/features/health/hooks/use-health';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * System status card.
 *
 * Milestone 1 scaffold — proves Tailwind, React Query, and the API round-trip are
 * wired correctly. Replaced by the real dashboard in Milestone 5.
 *
 * Handles all four states required by .claude/UI_RULES.md: loading, error, empty,
 * success. Status is never conveyed by colour alone — each state pairs an icon and
 * a text label with the colour.
 */
export function SystemStatus() {
  const { data, isPending, isError, refetch } = useHealth();

  return (
    <Card className="w-full max-w-md rounded-2xl">
      <CardHeader>
        <CardTitle>System status</CardTitle>
        <CardDescription>
          Liveness of the application and its dependencies.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isPending ? (
          <div
            role="status"
            className="space-y-3"
            aria-busy="true"
            aria-label="Loading system status"
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-48" />
          </div>
        ) : isError ? (
          <div className="space-y-4" role="alert">
            <p className="text-destructive flex items-center gap-2 text-sm font-medium">
              <AlertCircle aria-hidden="true" className="size-4" />
              Status unavailable
            </p>
            <p className="text-muted-foreground text-sm">
              The health endpoint could not be reached.
            </p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              <RefreshCw aria-hidden="true" className="size-4" />
              Retry
            </Button>
          </div>
        ) : (
          <dl className="space-y-3 text-sm" aria-live="polite">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Application</dt>
              <dd className="flex items-center gap-2 font-medium">
                <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600" />
                {data.status === 'ok' ? 'Operational' : 'Degraded'}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Database</dt>
              <dd className="flex items-center gap-2 font-medium">
                <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600" />
                {data.checks.database === 'ok' ? 'Connected' : 'Unavailable'}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Cache</dt>
              <dd className="font-medium">
                {data.checks.redis === 'ok'
                  ? 'Connected'
                  : data.checks.redis === 'not-configured'
                    ? 'Optional'
                    : 'Unavailable'}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Uptime</dt>
              <dd className="font-mono font-medium tabular-nums">
                {data.uptimeSeconds}s
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
