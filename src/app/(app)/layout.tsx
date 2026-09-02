import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { AppShell, SIDEBAR_COOKIE } from '@/components/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { APP_NAV_SECTIONS } from '@/features/auth/navigation';
import * as organizationService from '@/features/auth/services/organization.service';
import {
  SidebarAccountMenu,
  SidebarWorkspaceSwitcher,
} from '@/features/auth/components/sidebar-slots';
import { NotificationsBell } from '@/features/dashboard/components/notifications-bell';
import { requireAuth } from '@/server/auth-context';
import * as branchesService from '@/features/organizations/services/branches.service';

/**
 * Authenticated shell.
 *
 * This is the AUTHORITATIVE session check for every page beneath it — middleware
 * only performs an optimistic cookie check and cannot be relied upon.
 *
 * A user with no organization is sent to onboarding: almost nothing in the product
 * is meaningful without a tenant.
 *
 * Layout is the Milestone-3 AppShell: sidebar rail (collapsed state persisted in a
 * cookie) with the workspace switcher on top and the account menu pinned below. A
 * slim top bar in the content column carries the notifications bell; each page
 * owns its own PageHeader below it.
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
  const branches = context.organizationId
    ? await branchesService.list(context.organizationId)
    : [];

  const cookieStore = await cookies();
  const defaultCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === '1';

  return (
    <AppShell
      sections={APP_NAV_SECTIONS}
      defaultCollapsed={defaultCollapsed}
      sidebarHeader={
        <SidebarWorkspaceSwitcher
          organizations={organizations}
          activeOrganizationId={active?.id ?? null}
          branches={branches}
          activeBranchId={context.branchId}
        />
      }
      sidebarFooter={<SidebarAccountMenu user={context.user} />}
    >
      <div className="flex min-h-screen flex-col">
        <header className="bg-background/80 sticky top-0 z-30 flex h-12 items-center justify-end border-b px-4 backdrop-blur-sm sm:px-6">
          <NotificationsBell />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <Toaster />
    </AppShell>
  );
}
