import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { ThreadView } from '@/features/inbox/components/thread-view';
import { InboxService } from '@/features/inbox/services/inbox.service';
import { requireOrg } from '@/server/auth-context';
import { LoadingState } from '@/components/states';

export const metadata = { title: 'Conversation' };

export const dynamic = 'force-dynamic';

/**
 * Conversation thread — the message pane (AD-1).
 *
 * The server resolves the conversation (404 via notFound() when it is not in the
 * tenant); the client `ThreadView` polls it every 4s and owns the composer,
 * actions, suggestions, and summary.
 */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { organizationId } = await requireOrg();
  const { id } = await params;

  // Server-side existence check: a cross-tenant or missing id 404s, never leaks.
  const service = InboxService.forOrganization(organizationId);
  try {
    await service.getConversation(id);
  } catch {
    notFound();
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <section
        aria-label="Conversation"
        className="border-border flex w-full flex-col md:border-s"
      >
        <Suspense fallback={<LoadingState rows={8} label="Loading conversation" />}>
          <ThreadView conversationId={id} />
        </Suspense>
      </section>
    </div>
  );
}
