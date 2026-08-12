import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { RevenueChart } from '@/features/dashboard/components/revenue-chart';

/**
 * Revenue chart — cumulative invoice value across the range.
 *
 * The widget owns its title, summary text, and the empty state; the chart wrapper
 * owns the accessibility contract. The suite checks the empty/loaded split and the
 * chart's accessible summary.
 */

const DATA = [
  { date: new Date('2026-08-01T00:00:00.000Z'), label: '1 Aug', revenue: 100 },
  { date: new Date('2026-08-02T00:00:00.000Z'), label: '2 Aug', revenue: 150 },
];

describe('RevenueChart', () => {
  it('renders the title and a summary of the period', () => {
    render(
      <RevenueChart data={DATA} summary="Invoiced revenue per day in the period; 250 in total." />,
    );

    expect(
      screen.getByText('Revenue', { selector: '[data-slot="card-title"]' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/invoiced value in this period/i)).toBeInTheDocument();
  });

  it('renders an empty state with guidance instead of a bare "no data"', () => {
    render(<RevenueChart data={[]} summary="Invoiced revenue per day in the period; 0 in total." />);

    // Exactly one — the description and the empty body must not duplicate.
    expect(
      screen.getAllByText('Invoiced revenue will appear here as invoices are issued.'),
    ).toHaveLength(1);
    expect(
      screen.getByText('No invoices issued yet in this period.'),
    ).toBeInTheDocument();
  });

  it('exposes the chart with a screen-reader summary when there is data', async () => {
    const { container } = render(
      <RevenueChart data={DATA} summary="Invoiced revenue per day in the period; 250 in total." />,
    );

    expect(screen.getByLabelText(/250 in total/i)).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
