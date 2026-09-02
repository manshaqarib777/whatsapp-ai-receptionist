import { Suspense } from 'react';

import { ConversationList } from '@/features/inbox/components/conversation-list';
import { requireOrg } from '@/server/auth-context';
import { LoadingState } from '@/components/states';

export const metadata = { title: 'Inbox' };

export const dynamic = 'force-dynamic';

/**
 * Inbox — the conversation list pane (AD-1, AD-9).
 *
 * The server resolves the session and renders the list shell; the client
 * `ConversationList` owns filters (URL-driven) and polling (5s). On desktop the
 * thread renders beside it in the same page; on mobile the list links to
 * `/inbox/[id]`.
 */
export default async function InboxPage() {
  await requireOrg();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <section
        aria-label="Conversations"
        className="border-border flex w-full flex-col border-e md:w-96 md:shrink-0"
      >
        <Suspense fallback={<LoadingState rows={8} label="Loading conversations" />}>
          <ConversationList />
        </Suspense>
      </section>
    </div>
  );
}
