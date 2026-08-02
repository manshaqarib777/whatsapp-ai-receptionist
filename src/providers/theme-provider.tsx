'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

/**
 * Theme provider.
 *
 * `next-themes` injects a blocking inline script that applies the stored theme
 * before first paint. Without it the browser renders light, then swaps to dark on
 * hydration — a visible flash that is the single most obvious "unfinished" signal
 * in a SaaS product (DESIGN_TOKENS.md §3).
 *
 * Class-based rather than media-query-only, so a user can override their system
 * preference.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Transitions during a theme swap animate every colour on the page at once,
      // which reads as a glitch rather than a transition.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
