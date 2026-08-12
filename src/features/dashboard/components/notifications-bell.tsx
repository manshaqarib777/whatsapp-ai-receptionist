'use client';

import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';

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

/**
 * Notifications bell for the app shell header.
 *
 * Fetches the current user's notifications for the active org from
 * `/api/dashboard/notifications` on mount (React Query is the convention for
 * client polling; a one-shot fetch is enough here and avoids the extra provider
 * wiring for a single read). The bell shows an unread count badge and a dropdown
 * of the most recent notifications.
 */

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/dashboard/notifications')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { data?: { notifications?: Notification[] } } | null) => {
        if (cancelled) return;
        setNotifications(data?.data?.notifications ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <span className="relative">
            <Bell aria-hidden="true" className="size-4" />
            {unread > 0 ? (
              <Badge
                aria-hidden="true"
                className="bg-destructive text-destructive-foreground absolute -top-2 -end-2 flex size-4 min-w-4 items-center justify-center rounded-full p-0 text-[10px] font-semibold"
              >
                {unread}
              </Badge>
            ) : null}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <p className="text-muted-foreground px-3 py-4 text-center text-sm">
            Loading…
          </p>
        ) : notifications.length === 0 ? (
          <p className="text-muted-foreground px-3 py-4 text-center text-sm">
            You are all caught up.
          </p>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem key={notification.id} className="flex-col items-start gap-0.5">
              <span className="text-sm font-medium">{notification.title}</span>
              {notification.body ? (
                <span className="text-muted-foreground line-clamp-2 text-xs">
                  {notification.body}
                </span>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
