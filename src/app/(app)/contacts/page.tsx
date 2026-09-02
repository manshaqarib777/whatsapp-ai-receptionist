import { Users } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/states';
import { requireOrg } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Contacts' };

// requireOrg reads the session; never statically prerender this page.
export const dynamic = 'force-dynamic';

/**
 * Contacts doorway — Milestone 10 builds the real CRM.
 *
 * The dashboard's activity feed and the sidebar's Contacts item link here so the
 * doorways are real (COMPONENT_DESIGN.md §7). This deliberate stub keeps the link
 * honest without building future-milestone scope.
 */
export default async function ContactsPage() {
  await requireOrg();

  return (
    <EmptyState
      icon={Users}
      title="Contacts are being built"
      description="Customers, leads, and companies arrive with the CRM in Milestone 10. The dashboard already shows your recent activity."
    />
  );
}
