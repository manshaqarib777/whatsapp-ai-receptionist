import { PageHeader } from '@/components/page-header';
import { BranchesSettings } from '@/features/organizations/components/branches-settings';
import * as branchesService from '@/features/organizations/services/branches.service';
import { hasPermission } from '@/features/auth/permissions';
import { requireOrg } from '@/server/auth-context';

export default async function BranchesPage() {
  const { organizationId, role } = await requireOrg();
  const branches = await branchesService.list(organizationId);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Manage locations and their local timezones."
      />
      <BranchesSettings
        branches={branches}
        canManage={hasPermission(role, 'organization:update')}
      />
    </div>
  );
}
