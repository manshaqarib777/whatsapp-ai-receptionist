'use client';

import { Menu } from 'lucide-react';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { SidebarNav, type NavSection } from '@/components/sidebar-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

/**
 * Application shell — sidebar, mobile drawer, and content column.
 *
 * On a phone the sidebar becomes a drawer behind a menu button rather than a
 * squeezed copy of the desktop rail (COMPONENT_DESIGN.md §6).
 *
 * Collapse state persists across sessions in a cookie rather than `localStorage`,
 * because the server can read a cookie: the layout that renders this shell passes
 * the stored value as `defaultCollapsed`, so the first paint is already the right
 * width. `localStorage` is only readable after hydration, which means a visible snap
 * from 260px to 64px on every load.
 */

export const SIDEBAR_COOKIE = 'sidebar:collapsed';

const OpenDrawerContext = createContext<(() => void) | null>(null);

/**
 * Opens the mobile navigation drawer. Null outside an `AppShell`.
 *
 * The trigger lives in the page's own header rather than in a second bar stacked
 * above it, so the shell hands the opener down instead of rendering it.
 */
export function useOpenNavigationDrawer(): (() => void) | null {
  return useContext(OpenDrawerContext);
}

function persistCollapsed(collapsed: boolean) {
  if (typeof document === 'undefined') return;

  // A year: the preference should outlive the session. `SameSite=Lax` because this
  // is a UI preference and is never wanted on a cross-site request.
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
}

export function AppShell({
  sections,
  children,
  sidebarHeader,
  sidebarFooter,
  onSearch,
  defaultCollapsed = false,
}: {
  sections: NavSection[];
  children: ReactNode;
  sidebarHeader?: ReactNode;
  sidebarFooter?: ReactNode;
  onSearch?: () => void;
  /** Read from the `sidebar:collapsed` cookie by the server layout. */
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function changeCollapsed(next: boolean) {
    setCollapsed(next);
    persistCollapsed(next);
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop rail. Hidden rather than unmounted so the drawer owns mobile. */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <SidebarNav
          sections={sections}
          collapsed={collapsed}
          onCollapsedChange={changeCollapsed}
          header={sidebarHeader}
          footer={sidebarFooter}
          {...(onSearch ? { onSearch } : {})}
        />
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        {/* `side="left"` is positioned with `start-0` in our sheet, so the drawer
            opens from the same edge as the rail — the right-hand edge in Arabic. */}
        <SheetContent side="left" className="w-65 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>

          <SidebarNav
            sections={sections}
            header={sidebarHeader}
            footer={sidebarFooter}
            {...(onSearch ? { onSearch } : {})}
            className="border-e-0"
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <OpenDrawerContext.Provider value={() => setDrawerOpen(true)}>
          {children}
        </OpenDrawerContext.Provider>
      </div>
    </div>
  );
}

/** Mobile menu trigger, for a page header's `leading` slot. */
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label="Open navigation"
      className="lg:hidden"
    >
      <Menu aria-hidden="true" className="size-4" />
    </Button>
  );
}
