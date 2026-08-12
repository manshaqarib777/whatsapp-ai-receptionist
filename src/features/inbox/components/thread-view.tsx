'use client';

import { Archive, ArchiveRestore, MoreHorizontal, Pin, PinOff, User } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { Composer } from '@/features/inbox/components/composer';
import { MessageBubble } from '@/features/inbox/components/message-bubble';
import {
  useArchiveConversation,
  useLabels,
  useMarkRead,
  useThread,
  useUpdateConversation,
  useAddLabel,
  useRemoveLabel,
} from '@/features/inbox/hooks/use-inbox';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * The conversation thread (AD-1, AD-10).
 *
 * Polls every 4s via `useThread`; marks the conversation read on mount and after
 * each poll sees inbound messages. Header actions: archive, pin, assign, label.
 * Suggestions + summary render from heuristic logic (AD-8).
 */

export function ThreadView({ conversationId }: { conversationId: string }) {
  const { data, isPending, isError, refetch } = useThread(conversationId);
  const markRead = useMarkRead(conversationId);
  const archive = useArchiveConversation(conversationId);
  const updateConversation = useUpdateConversation(conversationId);
  const addLabel = useAddLabel(conversationId);
  const removeLabel = useRemoveLabel(conversationId);
  const labelsQuery = useLabels();

  // Mark read on mount and whenever new inbound messages appear.
  useEffect(() => {
    if (data && data.messages.some((m) => m.direction === 'inbound')) {
      markRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, data?.messages.length]);

  if (isPending && !data) {
    return <ThreadLoading />;
  }

  if (isError || !data) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const { conversation, messages, notes, summary, suggestions, typing } = data;

  function togglePin() {
    updateConversation.mutate(
      { isPinned: !conversation.isPinned },
      { onError: () => toast.error('Could not update the conversation.') },
    );
  }

  function toggleArchive() {
    archive.mutate(
      conversation.status !== 'archived',
      { onError: () => toast.error('Could not update the conversation.') },
    );
  }

  function toggleLabel(labelId: string) {
    const has = conversation.labels.some((l) => l.id === labelId);
    if (has) {
      removeLabel.mutate(labelId, { onError: () => toast.error('Could not update labels.') });
    } else {
      addLabel.mutate(labelId, { onError: () => toast.error('Could not update labels.') });
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{conversation.contactDisplayName}</h2>
            {conversation.isEscalated ? <Badge variant="destructive">Escalated</Badge> : null}
            {conversation.isPinned ? (
              <Badge variant="outline">
                <Pin aria-hidden="true" className="size-3" /> Pinned
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {conversation.contactPhone}
            {conversation.assigneeName ? ` · ${conversation.assigneeName}` : ' · Unassigned'}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {conversation.labels.map((label) => (
              <button
                key={label.id}
                type="button"
                onClick={() => toggleLabel(label.id)}
                className="hover:bg-muted rounded-full focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`Remove label ${label.name}`}
              >
                <Badge variant="outline" className="cursor-pointer">
                  {label.name} ✕
                </Badge>
              </button>
            ))}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Conversation actions">
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={togglePin}>
              {conversation.isPinned ? (
                <PinOff aria-hidden="true" className="size-4" />
              ) : (
                <Pin aria-hidden="true" className="size-4" />
              )}
              {conversation.isPinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleArchive}>
              {conversation.status === 'archived' ? (
                <ArchiveRestore aria-hidden="true" className="size-4" />
              ) : (
                <Archive aria-hidden="true" className="size-4" />
              )}
              {conversation.status === 'archived' ? 'Unarchive' : 'Archive'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info('Assignments ship in this milestone.')}>
              <User aria-hidden="true" className="size-4" />
              Assign…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Labels</DropdownMenuLabel>
            {(labelsQuery.data ?? []).map((label) => (
              <DropdownMenuItem key={label.id} onClick={() => toggleLabel(label.id)}>
                <span className="flex-1">{label.name}</span>
                {conversation.labels.some((l) => l.id === label.id) ? '✓' : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 ? (
        <div className="border-b bg-muted/30 px-4 py-2">
          <p className="text-muted-foreground mb-1.5 text-xs font-medium">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.kind}
                type="button"
                className="hover:bg-muted focus-visible:ring-ring rounded-full border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                title={suggestion.description}
              >
                {suggestion.action}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Summary */}
      <div className="border-b px-4 py-2">
        <p className="text-muted-foreground text-xs">
          <span className="font-medium">Summary:</span> {summary.summary}
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 px-4 py-4">
          {messages.length === 0 ? (
            <EmptyState
              title="No messages yet"
              description="Start the conversation with a reply below."
            />
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          {typing.length > 0 ? (
            <p className="text-primary text-xs italic" role="status" aria-live="polite">
              Someone is typing…
            </p>
          ) : null}
        </div>
      </ScrollArea>

      {/* Notes */}
      {notes.length > 0 ? (
        <div className="border-t px-4 py-2">
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            Internal notes ({notes.length})
          </p>
          <ul className="space-y-1">
            {notes.map((note) => (
              <li key={note.id} className="text-muted-foreground text-xs">
                <span className="text-foreground font-medium">{note.authorName ?? 'Agent'}:</span>{' '}
                {note.body}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Composer conversationId={conversationId} />
    </div>
  );
}

function ThreadLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <LoadingState rows={1} label="Loading conversation" />
      </div>
      <div className="flex-1 p-4">
        <LoadingState rows={6} label="Loading messages" />
      </div>
    </div>
  );
}
