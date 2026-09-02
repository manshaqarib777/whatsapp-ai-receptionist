'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { NavItem } from './sidebar-nav';

/**
 * One sidebar navigation link.
 *
 * Active state comes from the route (via the `active` prop computed by the
 * parent), never from click state — so a deep link or back-navigation
 * highlights correctly. Collapsed, the visible label is gone and the tooltip
 * text becomes the accessible name.
 */
export function NavLink({
  item,
  icon,
  active,
  collapsed,
  tooltipSide,
}: {
  item: NavItem;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  tooltipSide: 'left' | 'right';
}) {
  const Icon = icon;

  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        'focus-visible:ring-ring flex h-9 items-center gap-3 rounded-md text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
        collapsed ? 'justify-center px-0' : 'px-2',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground font-normal',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('size-4 shrink-0', active && 'text-sidebar-accent-foreground')}
      />

      {!collapsed ? (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {typeof item.count === 'number' ? (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                item.urgent
                  ? 'bg-destructive/10 text-destructive font-medium'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {item.count}
              <span className="sr-only"> {item.urgent ? 'urgent items' : 'items'}</span>
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        {item.label}
        {typeof item.count === 'number' ? ` (${item.count})` : ''}
      </TooltipContent>
    </Tooltip>
  );
}
