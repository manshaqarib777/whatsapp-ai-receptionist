'use client';

import { Pin } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ConversationRow } from '@/features/inbox/repositories/inbox.repository';

/**
 * One row in the inbox conversation list.
 *
 * Clicking navigates to the thread. Pinned conversations show a pin; unread ones
 * show a count badge; typing agents show a small indicator (AD-10).
 */

export function formatRelativeTime(date: Date, now = new Date()): string {
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

export function ConversationRow({ conversation }: { conversation: ConversationRow }) {
  const pathname = usePathname();
  const href = `/inbox/${conversation.id}`;
  const active = pathname === href;
  const hasTyping = conversation.typing.length > 0;

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-visible:ring-ring flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'hover:bg-muted',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {conversation.contactDisplayName}
          </span>
          {conversation.isPinned ? (
            <Pin aria-hidden="true" className="text-muted-foreground size-3.5 shrink-0" />
          ) : null}
          {conversation.isEscalated ? (
            <Badge variant="destructive" className="shrink-0">
              Escalated
            </Badge>
          ) : null}
        </div>

        <p
          className={cn(
            'mt-0.5 truncate text-xs',
            conversation.unreadCount > 0
              ? 'text-foreground font-medium'
              : 'text-muted-foreground',
          )}
        >
          {hasTyping ? (
            <span className="text-primary italic">typing…</span>
          ) : (
            conversation.preview ?? 'No messages yet'
          )}
        </p>

        <div className="mt-1 flex items-center gap-1.5">
          {conversation.labels.slice(0, 2).map((label) => (
            <Badge key={label.id} variant="outline" className="text-muted-foreground text-[0.6875rem]">
              {label.name}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <time className="text-muted-foreground text-xs tabular-nums" dateTime={conversation.lastMessageAt.toISOString()}>
          {formatRelativeTime(conversation.lastMessageAt)}
        </time>
        {conversation.unreadCount > 0 ? (
          <span className="bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums">
            {conversation.unreadCount}
            <span className="sr-only">unread messages</span>
          </span>
        ) : null}
      </div>
    </Link>
  );
}
