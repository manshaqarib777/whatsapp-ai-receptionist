import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { ConversationsChart } from '@/features/dashboard/components/conversations-chart';

/**
 * Conversations over time — the dashboard's primary chart.
 *
 * Same contract as RevenueChart: title, period summary, empty guidance, and the
 * chart wrapper's accessible summary.
 */

const DATA = [
  { date: new Date('2026-08-01T00:00:00.000Z'), label: '1 Aug', conversations: 3 },
  { date: new Date('2026-08-02T00:00:00.000Z'), label: '2 Aug', conversations: 5 },
];

describe('ConversationsChart', () => {
  it('renders the title and the total for the period', () => {
    render(
      <ConversationsChart
        data={DATA}
        summary="Conversations per day across the last 30 days; 8 in total."
      />,
    );

    expect(screen.getByText('Conversations over time')).toBeInTheDocument();
    expect(screen.getByText(/8 conversations in this period/i)).toBeInTheDocument();
  });

  it('renders empty guidance when there is no data', () => {
    render(<ConversationsChart data={[]} summary="Conversations per day; 0 in total." />);

    expect(
      screen.getByText('New conversations will appear here as they come in.'),
    ).toBeInTheDocument();
  });

  it('exposes the chart summary to assistive technology', async () => {
    const { container } = render(
      <ConversationsChart
        data={DATA}
        summary="Conversations per day across the last 30 days; 8 in total."
      />,
    );

    expect(screen.getByLabelText(/8 in total/i)).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
