import { PageHeader } from '@/components/page-header';
import { hasPermission } from '@/features/auth/permissions';
import { IntegrationsSettings } from '@/features/integrations/components/integrations-settings';
import * as integrations from '@/features/integrations/services/integrations.service';
import { requirePermission } from '@/server/auth-context';

export default async function IntegrationsPage() {
  const { organizationId, role } = await requirePermission('settings:read');
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect calendars, messaging, payments, CRM, automation, and commerce providers."
      />
      <IntegrationsSettings
        items={await integrations.list(organizationId)}
        canManage={hasPermission(role, 'settings:update')}
      />
    </div>
  );
}
