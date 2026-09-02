import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox, LayoutDashboard, Settings } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { SidebarNav, isNavItemActive, type NavSection } from '@/components/sidebar-nav';

const pathname = vi.hoisted(() => ({ current: '/dashboard' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}));

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/inbox', label: 'Inbox', icon: Inbox, count: 12 },
    ],
  },
  { label: 'Manage', items: [{ href: '/settings', label: 'Settings', icon: Settings }] },
];

describe('isNavItemActive', () => {
  it('matches the exact route', () => {
    expect(isNavItemActive('/inbox', '/inbox')).toBe(true);
  });

  it('matches a child route', () => {
    expect(isNavItemActive('/settings/members', '/settings')).toBe(true);
  });

  it('does not match a route that merely shares a prefix', () => {
    // `/settings-export` is a different page; a prefix check without the separator
    // would highlight Settings while the user is somewhere else entirely.
    expect(isNavItemActive('/settings-export', '/settings')).toBe(false);
  });
});

describe('SidebarNav', () => {
  it('marks the current route with aria-current', () => {
    pathname.current = '/inbox';
    render(<SidebarNav sections={SECTIONS} />);

    expect(screen.getByRole('link', { name: /inbox/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /dashboard/i })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('derives the active item from a child route', () => {
    pathname.current = '/settings/members';
    render(<SidebarNav sections={SECTIONS} />);

    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('labels the navigation landmark', () => {
    pathname.current = '/dashboard';
    render(<SidebarNav sections={SECTIONS} />);

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('announces a count rather than showing a bare number', () => {
    pathname.current = '/dashboard';
    render(<SidebarNav sections={SECTIONS} />);

    // "Inbox, 12" tells a screen-reader user nothing about what the 12 are.
    expect(screen.getByRole('link', { name: /inbox/i })).toHaveAccessibleName(
      expect.stringContaining('items') as unknown as string,
    );
  });

  it('keeps every destination named when collapsed', () => {
    pathname.current = '/dashboard';
    render(<SidebarNav sections={SECTIONS} collapsed />);

    // The visible label is gone, so the accessible name has to come from somewhere:
    // an icon-only link with no name is unusable by screen reader or by voice.
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inbox' })).toBeInTheDocument();
  });

  it('reports the collapse state and toggles it', async () => {
    pathname.current = '/dashboard';
    const onCollapsedChange = vi.fn();
    const user = userEvent.setup();

    render(<SidebarNav sections={SECTIONS} onCollapsedChange={onCollapsedChange} />);

    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);

    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it('shows the search row only when there is something to search', () => {
    pathname.current = '/dashboard';
    const { rerender } = render(<SidebarNav sections={SECTIONS} />);

    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();

    rerender(<SidebarNav sections={SECTIONS} onSearch={() => {}} />);

    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('is reachable by keyboard in reading order', async () => {
    pathname.current = '/dashboard';
    const user = userEvent.setup();
    render(<SidebarNav sections={SECTIONS} />);

    await user.tab();
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('link', { name: /inbox/i })).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    pathname.current = '/inbox';
    const { container } = render(
      <SidebarNav sections={SECTIONS} onSearch={() => {}} onCollapsedChange={() => {}} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations when collapsed', async () => {
    pathname.current = '/inbox';
    const { container } = render(<SidebarNav sections={SECTIONS} collapsed />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
