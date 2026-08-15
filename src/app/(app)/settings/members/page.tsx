import type { Metadata } from 'next';

import { MembersTable } from '@/features/auth/components/members-table';
import * as organizationService from '@/features/auth/services/organization.service';
import { requirePermission } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Members' };

// Session + permission reads make this page request-time only; it must never
// be statically prerendered (a prerender has no session headers).
export const dynamic = 'force-dynamic';

export default async function MembersSettingsPage() {
  // Authorization happens HERE, server-side. The table receives only what this
  // user is permitted to see.
  const { organizationId, role, user } = await requirePermission('member:read');

  const members = await organizationService.listMembers(organizationId);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-muted-foreground text-sm">
          People with access to this organization.
        </p>
      </div>

      <MembersTable members={members} currentUserId={user.id} currentRole={role} />
    </div>
  );
}
