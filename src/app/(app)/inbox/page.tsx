import { Inbox } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/states';
import { requireOrg } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Inbox' };

/**
 * Inbox doorway — Milestone 6 builds the real inbox.
 *
 * The dashboard's "Recent conversations" and the sidebar's Inbox item link here so
 * the doorways are real (COMPONENT_DESIGN.md §7: everything is a doorway). This
 * deliberate stub keeps the link honest without building future-milestone scope.
 */
export default async function InboxPage() {
  await requireOrg();

  return (
    <EmptyState
      icon={Inbox}
      title="The inbox is being built"
      description="Conversations, messages, and replies arrive in Milestone 6. In the meantime, the dashboard shows your recent conversations."
    />
  );
}
