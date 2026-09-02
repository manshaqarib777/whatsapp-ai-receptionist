import { notFound } from 'next/navigation';

import { Toaster } from '@/components/ui/sonner';
import { isDesignGalleryEnabled } from '@/lib/env';

/**
 * Design system gallery shell.
 *
 * DEV ONLY. The PRD says "no pages, only components" but also "test visually" —
 * which cannot both be satisfied without something rendering the components. This
 * is a development tool that ships with the design system, not a product surface,
 * and in a production build it 404s.
 *
 * The one exception is an explicit `DESIGN_GALLERY=enabled`, which the E2E suite sets
 * so it can audit the real production markup. A deployment must never set it; the
 * default, asserted by a test, is that `/design` does not exist in production.
 */
/**
 * Rendered per request, not prerendered.
 *
 * Without this the gate is evaluated once at build time and baked in, so the E2E
 * server could not serve the gallery no matter what it set — and, worse, a build made
 * with the flag on would serve it forever. A runtime decision has to run at runtime.
 */
export const dynamic = 'force-dynamic';

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  if (!isDesignGalleryEnabled) notFound();

  return (
    <div className="min-h-screen">
      {children}
      <Toaster />
    </div>
  );
}
