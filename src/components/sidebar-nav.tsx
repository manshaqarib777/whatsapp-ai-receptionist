'use client';

import type { LucideIcon } from 'lucide-react';
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, type ReactNode } from 'react';

import { useDirection } from '@/hooks/use-direction';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Application sidebar.
 *
 * Implements COMPONENT_DESIGN.md §6 so no screen has to re-derive it:
 *
 *   - 260px expanded, 64px collapsed; `--sidebar` surface with a hairline inline-end
 *     border
 *   - 36px items, `--radius-md`, icon-to-label gap 3
 *   - **active state comes from the route**, never from click state, so a deep link
 *     or a back-navigation highlights correctly
 *   - active is background *and* weight *and* icon colour — a subtle active state
 *     means users lose their place
 *   - groups are separated by a label and space, not by dividers
 *   - counts are muted; `--destructive` is reserved for genuinely urgent ones
 *   - collapsed items keep their name through a tooltip, which is also their
 *     accessible name
 *
 * Domain-agnostic: sections are passed in. Workspace switcher and account menu are
 * slots, because both are auth concerns and this component knows nothing about auth.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Unread or pending count. Muted by default — see `urgent`. */
  count?: number;
  /** Only for counts a user must act on now. Colour alone never carries meaning. */
  urgent?: boolean;
};

export type NavSection = {
  /** Omit for the first, unlabelled group. */
  label?: string;
  items: NavItem[];
};

export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // `/settings/members` activates `/settings`, but `/settings-x` must not.
  return pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  sections,
  collapsed = false,
  onCollapsedChange,
  header,
  footer,
  onSearch,
  className,
}: {
  sections: NavSection[];
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Workspace switcher. Rendered in the 56px top bar. */
  header?: ReactNode;
  /** Account menu. Pinned to the bottom — the item list scrolls, this does not. */
  footer?: ReactNode;
  /** Opens the command palette. Omit to hide the search row. */
  onSearch?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);

  // Collapsed tooltips sit beside the rail — which is the left edge in Arabic.
  const tooltipSide = useDirection(ref) === 'rtl' ? 'left' : 'right';

  return (
    <TooltipProvider delayDuration={0}>
      <nav
        ref={ref}
        aria-label="Main"
        data-collapsed={collapsed}
        className={cn(
          'bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full flex-col border-e',
          collapsed ? 'w-16' : 'w-65',
          className,
        )}
      >
        {header ? (
          <div
            className={cn(
              'flex h-14 items-center border-b',
              collapsed ? 'justify-center px-2' : 'px-3',
            )}
          >
            {header}
          </div>
        ) : null}

        {onSearch ? (
          <div className={cn('pt-3', collapsed ? 'px-2' : 'px-3')}>
            <Button
              variant="outline"
              onClick={onSearch}
              aria-label="Search"
              aria-keyshortcuts="Meta+K Control+K"
              className={cn(
                'text-muted-foreground h-9 w-full font-normal',
                collapsed ? 'justify-center px-0' : 'justify-start',
              )}
            >
              <Search aria-hidden="true" className="size-4" />
              {!collapsed ? (
                <>
                  <span>Search</span>
                  <kbd className="bg-muted text-muted-foreground ms-auto rounded px-1.5 py-0.5 font-mono text-[0.6875rem]">
                    ⌘K
                  </kbd>
                </>
              ) : null}
            </Button>
          </div>
        ) : null}

        {/* Only the item list scrolls. The switcher and account menu stay put. */}
        <div
          className={cn(
            'flex-1 space-y-6 overflow-y-auto py-3',
            collapsed ? 'px-2' : 'px-3',
          )}
        >
          {sections.map((section, index) => (
            <div key={section.label ?? `section-${index}`} className="space-y-1">
              {section.label && !collapsed ? (
                <p className="text-muted-foreground px-2 pb-1 text-[0.6875rem] font-medium tracking-[0.05em] uppercase">
                  {section.label}
                </p>
              ) : null}

              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={isNavItemActive(pathname, item.href)}
                      collapsed={collapsed}
                      tooltipSide={tooltipSide}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {footer ? (
          <div className={cn('border-t py-3', collapsed ? 'px-2' : 'px-3')}>{footer}</div>
        ) : null}

        {onCollapsedChange ? (
          <div className={cn('border-t py-2', collapsed ? 'px-2' : 'px-3')}>
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              onClick={() => onCollapsedChange(!collapsed)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              className={cn(
                'text-muted-foreground',
                collapsed ? 'mx-auto' : 'w-full justify-start',
              )}
            >
              {/* The icon is mirrored in RTL along with the panel it describes. */}
              {collapsed ? (
                <PanelLeftOpen aria-hidden="true" className="size-4 rtl:scale-x-[-1]" />
              ) : (
                <PanelLeftClose aria-hidden="true" className="size-4 rtl:scale-x-[-1]" />
              )}
              {!collapsed ? <span>Collapse</span> : null}
            </Button>
          </div>
        ) : null}
      </nav>
    </TooltipProvider>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  tooltipSide,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  tooltipSide: 'left' | 'right';
}) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      // The route decides this, not a click handler — so it survives a reload.
      aria-current={active ? 'page' : undefined}
      // Collapsed, the visible label is gone; the tooltip text becomes the name.
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
