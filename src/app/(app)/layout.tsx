import { redirect } from 'next/navigation';

import { AppHeader } from '@/features/auth/components/app-header';
import * as organizationService from '@/features/auth/services/organization.service';
import { requireAuth } from '@/server/auth-context';

import { Toaster } from '@/components/ui/sonner';

/**
 * Authenticated shell.
 *
 * This is the AUTHORITATIVE session check for every page beneath it — middleware
 * only performs an optimistic cookie check and cannot be relied upon.
 *
 * A user with no organization is sent to onboarding: almost nothing in the product
 * is meaningful without a tenant.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAuth().catch(() => null);

  if (!context) redirect('/login');

  const organizations = await organizationService.listForUser(context.user.id);

  if (organizations.length === 0) {
    redirect('/onboarding/organization');
  }

  const active =
    organizations.find((org) => org.id === context.organizationId) ?? organizations[0];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        user={context.user}
        organizations={organizations}
        activeOrganizationId={active?.id ?? null}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>

      <Toaster />
    </div>
  );
}
