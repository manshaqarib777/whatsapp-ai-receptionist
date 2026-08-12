import { MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/states';
import { requireOrg } from '@/server/auth-context';

export const metadata: Metadata = { title: 'Conversation' };

/**
 * Conversation detail doorway — Milestone 6 builds the real inbox.
 *
 * The dashboard's recent-conversations rows link here. This deliberate stub keeps
 * the doorway real (COMPONENT_DESIGN.md §7) without building future scope.
 */
export default async function ConversationDetailPage() {
  await requireOrg();

  return (
    <EmptyState
      icon={MessageSquare}
      title="The inbox is being built"
      description="Full conversation threads, replies, and AI suggestions arrive in Milestone 6."
    />
  );
}
