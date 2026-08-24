'use client';

import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { ConversationRow } from '@/features/inbox/components/conversation-row';
import { useConversations } from '@/features/inbox/hooks/use-inbox';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { virtualWindow } from '@/lib/virtual-window';

/**
 * The inbox conversation list (AD-9).
 *
 * Filters are URL-driven: `/inbox?status=&assignee=&q=`. The server component
 * renders the initial list; this client view polls it via `useConversations`
 * (5s, stops when the tab is hidden) and re-sorts live as messages arrive.
 */

type FilterValue = { status?: string; assignee?: string; q?: string };

function parseSearchParams(params: URLSearchParams): FilterValue {
  return {
    status: params.get('status') ?? undefined,
    assignee: params.get('assignee') ?? undefined,
    q: params.get('q') ?? undefined,
  };
}

export function ConversationList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = parseSearchParams(searchParams);
  const [q, setQ] = useState(filter.q ?? '');
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 704 });

  const { data, isPending, isError, refetch } = useConversations({
    status: filter.status,
    assignee: filter.assignee,
    q: filter.q,
  });

  const rows = data?.rows ?? [];
  const useWindow = rows.length > 20;
  const window = virtualWindow({
    count: rows.length,
    scrollTop: viewport.scrollTop,
    viewportHeight: viewport.height,
    rowHeight: 88,
  });
  const visibleRows = useWindow ? rows.slice(window.start, window.end) : rows;

  function apply(next: FilterValue) {
    const params = new URLSearchParams();
    if (next.status) params.set('status', next.status);
    if (next.assignee) params.set('assignee', next.assignee);
    if (next.q) params.set('q', next.q);
    const qs = params.toString();
    router.replace(qs ? `/inbox?${qs}` : '/inbox');
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    apply({ ...filter, q: q.trim() || undefined });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <Tabs
          value={filter.status ?? 'all'}
          onValueChange={(status) =>
            apply({ ...filter, status: status === 'all' ? undefined : status })
          }
        >
          <TabsList className="w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
          {/* Radix triggers emit aria-controls pointing at a panel; without a
              TabsContent per value, axe flags aria-valid-attr-value (critical).
              The panels are visually hidden — the shared list below renders. */}
          {['all', 'open', 'unread', 'archived'].map((value) => (
            <TabsContent
              key={value}
              value={value}
              className="hidden"
              aria-hidden="true"
            />
          ))}
        </Tabs>

        <form onSubmit={submitSearch} className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2"
            />
            <Input
              aria-label="Search conversations"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search messages or contacts"
              className="ps-9"
            />
          </div>
        </form>
      </div>

      <div
        className="flex-1 overflow-y-auto p-2"
        onScroll={(event) => {
          const target = event.currentTarget;
          setViewport({ scrollTop: target.scrollTop, height: target.clientHeight });
        }}
      >
        {isPending && !data ? (
          <LoadingState rows={8} label="Loading conversations" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No conversations match"
            description="Try a different filter, or wait for a new message to arrive."
          />
        ) : (
          <ul
            className={useWindow ? 'relative' : 'space-y-0.5'}
            style={useWindow ? { height: window.totalHeight } : undefined}
            aria-label={`${rows.length} conversations`}
          >
            {visibleRows.map((conversation, visibleIndex) => {
              const index = useWindow ? window.start + visibleIndex : visibleIndex;
              return (
                <li
                  key={conversation.id}
                  aria-posinset={index + 1}
                  aria-setsize={rows.length}
                  className={
                    useWindow ? 'absolute inset-x-0 h-22 overflow-hidden' : undefined
                  }
                  style={
                    useWindow ? { transform: `translateY(${index * 88}px)` } : undefined
                  }
                >
                  <ConversationRow conversation={conversation} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
