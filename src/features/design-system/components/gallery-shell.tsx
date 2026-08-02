'use client';

import { Languages } from 'lucide-react';
import { useState } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { ButtonsSection } from '@/features/design-system/components/sections/buttons-section';
import { ContentSection } from '@/features/design-system/components/sections/content-section';
import { DataSection } from '@/features/design-system/components/sections/data-section';
import { DisplaySection } from '@/features/design-system/components/sections/display-section';
import { FormsSection } from '@/features/design-system/components/sections/forms-section';
import { MotionSection } from '@/features/design-system/components/sections/motion-section';
import { NavigationSection } from '@/features/design-system/components/sections/navigation-section';
import { OverlaysSection } from '@/features/design-system/components/sections/overlays-section';
import { TokensSection } from '@/features/design-system/components/sections/tokens-section';

/**
 * The gallery.
 *
 * Direction is toggled on a wrapper rather than on `<html>` so a reviewer can flip
 * LTR and RTL without a reload and without the toggle itself jumping across the
 * screen mid-review.
 */
export function GalleryShell() {
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');

  return (
    <div dir={direction} className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Design System</h1>
          <p className="text-muted-foreground text-sm">
            Every component, every state. Toggle theme and direction to review both.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDirection(direction === 'ltr' ? 'rtl' : 'ltr')}
            aria-label={`Switch to ${direction === 'ltr' ? 'right-to-left' : 'left-to-right'}`}
          >
            <Languages aria-hidden="true" className="size-4" />
            {direction.toUpperCase()}
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="space-y-12">
        <TokensSection />
        <ButtonsSection />
        <FormsSection />
        <DataSection />
        <DisplaySection />
        <ContentSection />
        <OverlaysSection />
        <NavigationSection />
        <MotionSection />
      </div>
    </div>
  );
}
