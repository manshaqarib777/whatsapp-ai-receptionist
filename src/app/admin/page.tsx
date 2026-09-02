import { AdminPortal } from '@/features/admin/components/admin-portal';
import { adminService } from '@/features/admin/admin.service';
import { requirePlatformAdmin } from '@/server/auth-context';

export const metadata = { title: 'Platform Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requirePlatformAdmin();
  const [overview, tenants, plans, billing, logs, usage, analytics, monitoring] =
    await Promise.all([
      adminService.overview(),
      adminService.tenants({ page: 1, limit: 25 }),
      adminService.plans(),
      adminService.billing({ page: 1, limit: 25 }),
      adminService.logs({ page: 1, limit: 25 }),
      adminService.aiUsage(),
      adminService.analytics(),
      adminService.monitoring(),
    ]);
  return (
    <main className="mx-auto min-h-screen max-w-7xl min-w-0 space-y-6 overflow-x-hidden p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-primary text-sm font-medium">Platform operations</p>
        <h1 className="text-3xl font-semibold tracking-tight">Admin Portal</h1>
        <p className="text-muted-foreground mt-1">
          Cross-tenant health and commercial operations. Customer content is intentionally
          excluded.
        </p>
      </header>
      <AdminPortal
        data={{ overview, tenants, plans, billing, logs, usage, analytics, monitoring }}
      />
    </main>
  );
}
