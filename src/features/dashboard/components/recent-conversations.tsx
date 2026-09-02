'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';

import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Recent conversations — the last five non-archived threads.
 *
 * Rows are doorways into the conversation (Milestone 6 owns the real inbox; the
 * stub route keeps the link real). The table itself enforces tabular numerals,
 * aria-sort, and the table-shaped loading/empty states via `DataTable`.
 */

type Conversation = {
  id: string;
  contactDisplayName: string;
  contactLocale: string;
  status: string;
  unreadCount: number;
  lastMessageAt: Date;
  branchId: string;
};

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  open: 'default',
  pending: 'secondary',
  resolved: 'outline',
  archived: 'outline',
};

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function RecentConversations({
  conversations,
}: {
  conversations: Conversation[];
}) {
  const columns: ColumnDef<Conversation, unknown>[] = [
    {
      accessorKey: 'contactDisplayName',
      header: 'Contact',
      cell: ({ row }) => (
        <Link
          href={`/inbox/${row.original.id}`}
          className="hover:text-foreground font-medium hover:underline"
        >
          {row.original.contactDisplayName}
        </Link>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? 'outline'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'unreadCount',
      header: 'Unread',
      cell: ({ row }) => (
        <span
          className={
            row.original.unreadCount > 0 ? 'font-semibold' : 'text-muted-foreground'
          }
        >
          {row.original.unreadCount}
        </span>
      ),
    },
    {
      accessorKey: 'lastMessageAt',
      header: 'Last message',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatTime(row.original.lastMessageAt)}
        </span>
      ),
    },
  ];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Recent conversations</CardTitle>
        <Link
          href="/inbox"
          className="text-muted-foreground hover:text-foreground text-sm font-medium"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={conversations}
          caption="Most recent conversations"
          emptyTitle="No conversations yet"
          emptyDescription="When customers message you, they will appear here."
        />
      </CardContent>
    </Card>
  );
}
