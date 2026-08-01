import { redirect } from 'next/navigation';

import { requireAuth } from '@/server/auth-context';

import { Toaster } from '@/components/ui/sonner';

/**
 * Onboarding shell.
 *
 * Deliberately NOT inside the (app) route group. That layout redirects any user
 * with zero organizations to onboarding — so hosting onboarding beneath it makes
 * the page that CREATES the first organization unreachable to exactly the users
 * who need it, in an infinite redirect loop.
 *
 * The contract here is narrower and is the whole reason this group exists:
 * authenticated, but NOT required to belong to an organization.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireAuth().catch(() => null);

  if (!context) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12">
        {children}
      </main>

      <Toaster />
    </div>
  );
}
