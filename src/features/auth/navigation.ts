import type { NavSection } from '@/components/sidebar-nav';

/**
 * The authenticated app's navigation.
 *
 * The sidebar derives its active state from the route, so these are pure data.
 * Icons are NAMES, not component references: this module is imported by the server
 * layout, which passes the sections across the server→client boundary, and React
 * cannot serialise a component function. `SidebarNav` resolves the name to a
 * Lucide icon on the client.
 *
 * Inbox and Contacts are built in later milestones; the dashboard links to their
 * stub routes so its doorways are real (COMPONENT_DESIGN.md §7).
 */

export const APP_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
      { href: '/inbox', label: 'Inbox', icon: 'inbox' },
      { href: '/contacts', label: 'Contacts', icon: 'users' },
      { href: '/knowledge', label: 'Knowledge', icon: 'book-open' },
      { href: '/ai', label: 'AI', icon: 'sparkles' },
      { href: '/appointments', label: 'Appointments', icon: 'calendar' },
      { href: '/crm', label: 'CRM', icon: 'briefcase' },
      { href: '/quotes', label: 'Quotes', icon: 'file-text' },
      { href: '/invoices', label: 'Invoices', icon: 'receipt' },
      { href: '/workflows', label: 'Workflows', icon: 'workflow' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];
