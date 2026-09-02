import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { Timeline } from '@/components/timeline';

const ITEMS = [
  { id: '1', title: 'Conversation started', timestamp: '2 hours ago' },
  {
    id: '2',
    title: 'AI replied',
    description: 'Answered an opening-hours question.',
    timestamp: '2 hours ago',
  },
  { id: '3', title: 'Escalated to Alex', timestamp: '1 hour ago' },
];

describe('Timeline', () => {
  it('renders events as an ordered list, so position and count are announced', () => {
    render(<Timeline items={ITEMS} />);

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders titles, descriptions, and timestamps', () => {
    render(<Timeline items={ITEMS} />);

    expect(screen.getByText('AI replied')).toBeInTheDocument();
    expect(screen.getByText('Answered an opening-hours question.')).toBeInTheDocument();
    expect(screen.getByText('1 hour ago')).toBeInTheDocument();
  });

  it('renders nothing but an empty list when there are no events', () => {
    render(<Timeline items={[]} />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Timeline items={ITEMS} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
