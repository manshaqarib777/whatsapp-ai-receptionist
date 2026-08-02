import { MessageCircle } from 'lucide-react';
import Link from 'next/link';

import { ThemeToggle } from '@/components/theme-toggle';
import { Card, CardContent } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';

/**
 * Auth shell — the centred card layout shared by every unauthenticated screen.
 *
 * Restyled in Milestone 3 against the design system. The change is deliberately
 * cosmetic: structure, DOM order, and behaviour are untouched, so Milestone 2's auth
 * tests pass unmodified — which is the check that this is a restyle rather than a
 * rewrite (MILESTONE_03_PLAN.md → Risks §3).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* One soft wash behind the card: enough that the page does not read as a blank
          sheet, faint enough that it never competes with the form. */}
      <div
        aria-hidden="true"
        className="from-primary/[0.06] pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b via-transparent to-transparent"
      />

      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pt-2 pb-16">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex justify-center">
            <Link
              href="/"
              className="focus-visible:ring-ring inline-flex items-center gap-2 rounded-lg px-2 py-1 text-base font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
                <MessageCircle aria-hidden="true" className="size-4" />
              </span>
              WhatsApp AI Receptionist
            </Link>
          </div>

          <Card className="rounded-2xl shadow-lg [--card-spacing:--spacing(6)]">
            <CardContent>{children}</CardContent>
          </Card>
        </div>
      </main>

      <Toaster />
    </div>
  );
}
