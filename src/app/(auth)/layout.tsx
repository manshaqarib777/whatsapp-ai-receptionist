import Link from 'next/link';

import { Toaster } from '@/components/ui/sonner';

/**
 * Auth shell — centred card layout shared by every unauthenticated screen.
 *
 * Milestone 2 styling is deliberately plain: the design system is Milestone 3, and
 * this layout is restyled then (MILESTONE_02_PLAN.md → Approved Deviations).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center">
            <Link
              href="/"
              className="focus-visible:ring-ring rounded-md text-lg font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              WhatsApp AI Receptionist
            </Link>
          </div>

          {children}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
