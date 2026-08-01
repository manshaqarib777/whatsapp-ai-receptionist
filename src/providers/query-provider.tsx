'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * React Query provider.
 *
 * The client is created in state rather than at module scope: a module-scope
 * client is shared across requests on the server, which leaks one user's cached
 * data into another's response.
 *
 * All server state flows through React Query (PRD coding standards) — no
 * useEffect + fetch, and no server data mirrored into other stores.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A non-zero default prevents a refetch storm on every mount.
            // Individual queries override this deliberately.
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Never retry a client error — the request is wrong, not unlucky.
              const status = (error as { status?: number })?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
