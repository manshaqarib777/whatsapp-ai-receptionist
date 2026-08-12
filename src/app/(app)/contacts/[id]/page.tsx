import { Users } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/states';
import { requireOrg } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Contact' };

/**
 * Contact detail doorway — Milestone 10 builds the real CRM.
 *
 * The dashboard's activity feed links here. This deliberate stub keeps the doorway
 * real (COMPONENT_DESIGN.md §7) without building future scope.
 */
export default async function ContactDetailPage() {
  await requireOrg();

  return (
    <EmptyState
      icon={Users}
      title="Contacts are being built"
      description="Customer profiles, companies, and pipelines arrive with the CRM in Milestone 10."
    />
  );
}
