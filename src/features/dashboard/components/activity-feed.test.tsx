import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { ActivityFeed } from '@/features/dashboard/components/activity-feed';

/**
 * Activity feed — the last few org events as a timeline.
 *
 * COMPONENT_DESIGN.md §7: "Recent-activity beats all-activity." The feed is an
 * ordered list (Timeline) with a "View all" doorway, and each event links to its
 * subject's page — a notFound() stub where the page does not exist yet.
 */

const ACTIVITIES = [
  {
    id: 'act-1',
    kind: 'call',
    subjectType: 'contact',
    subjectId: 'contact-1',
    body: 'Discussed the follow-up plan',
    actorName: 'Alex',
    createdAt: new Date('2026-08-12T09:00:00.000Z'),
  },
  {
    id: 'act-2',
    kind: 'note',
    subjectType: 'conversation',
    subjectId: 'conv-1',
    body: null,
    actorName: null,
    createdAt: new Date('2026-08-11T14:00:00.000Z'),
  },
];

describe('ActivityFeed', () => {
  it('renders activities as an ordered timeline', () => {
    render(<ActivityFeed activities={ACTIVITIES} />);

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /call · alex/i })).toBeInTheDocument();
    expect(screen.getByText('Discussed the follow-up plan')).toBeInTheDocument();
  });

  it('links a contact activity to the contact page', () => {
    render(<ActivityFeed activities={ACTIVITIES} />);

    expect(screen.getByRole('link', { name: /call · alex/i })).toHaveAttribute(
      'href',
      '/contacts/contact-1',
    );
  });

  it('links a conversation activity to the inbox', () => {
    render(<ActivityFeed activities={ACTIVITIES} />);

    expect(screen.getByRole('link', { name: /note/i })).toHaveAttribute(
      'href',
      '/inbox/conv-1',
    );
  });

  it('offers a View all doorway', () => {
    render(<ActivityFeed activities={ACTIVITIES} />);

    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute(
      'href',
      '/contacts',
    );
  });

  it('renders an empty state with guidance', () => {
    render(<ActivityFeed activities={[]} />);

    expect(screen.getByText('Team activity will appear here.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<ActivityFeed activities={ACTIVITIES} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
