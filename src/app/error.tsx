'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary.
 *
 * Renders a real recovery UI, never a blank screen or a raw error
 * (.claude/CODING_STANDARDS.md → Error Boundaries). The message shown to the user
 * is deliberately generic; the detail goes to the console/telemetry, not the page.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side: report to telemetry. Wired to a real sink in Milestone 25.
    // eslint-disable-next-line no-console -- no client logger exists until M25
    console.error('route error', { digest: error.digest });
  }, [error]);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-8"
      role="alert"
    >
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-2xl">
        <AlertTriangle aria-hidden="true" className="size-6" />
      </div>

      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground text-sm">
          This page could not be loaded. You can try again, and if it keeps happening the
          reference below will help support diagnose it.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground font-mono text-xs">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>

      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
