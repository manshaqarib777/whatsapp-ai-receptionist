import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { RecentConversations } from '@/features/dashboard/components/recent-conversations';

/**
 * Recent conversations — the last five non-archived threads as a table.
 *
 * Rows are doorways into the conversation stub. The DataTable supplies the
 * caption, aria-sort, and table-shaped empty state; this suite checks the data
 * wiring and the doorways.
 */

const CONVERSATIONS = [
  {
    id: 'conv-1',
    contactDisplayName: 'Layla',
    contactLocale: 'en',
    status: 'open',
    unreadCount: 2,
    lastMessageAt: new Date('2026-08-12T08:30:00.000Z'),
    branchId: 'branch-1',
  },
  {
    id: 'conv-2',
    contactDisplayName: 'Fatima',
    contactLocale: 'ar',
    status: 'pending',
    unreadCount: 0,
    lastMessageAt: new Date('2026-08-11T16:00:00.000Z'),
    branchId: 'branch-1',
  },
];

describe('RecentConversations', () => {
  it('renders each conversation with its status and unread count', () => {
    render(<RecentConversations conversations={CONVERSATIONS} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Layla')).toBeInTheDocument();
    expect(screen.getByText('Fatima')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('links each row to its conversation doorway', () => {
    render(<RecentConversations conversations={CONVERSATIONS} />);

    expect(screen.getByRole('link', { name: 'Layla' })).toHaveAttribute(
      'href',
      '/inbox/conv-1',
    );
    expect(screen.getByRole('link', { name: 'Fatima' })).toHaveAttribute(
      'href',
      '/inbox/conv-2',
    );
  });

  it('provides a View all doorway to the inbox', () => {
    render(<RecentConversations conversations={CONVERSATIONS} />);

    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute(
      'href',
      '/inbox',
    );
  });

  it('has a screen-reader caption on the table', () => {
    render(<RecentConversations conversations={CONVERSATIONS} />);

    expect(screen.getByRole('table')).toHaveAccessibleName('Most recent conversations');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<RecentConversations conversations={CONVERSATIONS} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
