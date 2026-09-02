import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { DatePicker, formatDate } from '@/components/date-picker';

describe('formatDate', () => {
  it('uses a month name rather than an ambiguous numeric order', () => {
    // 01/08/2026 is August in the UK and January in the US. A month name cannot be
    // read as the wrong date in either.
    expect(formatDate(new Date(2026, 7, 1), 'en-GB')).toBe('1 Aug 2026');
  });

  it('follows the locale', () => {
    expect(formatDate(new Date(2026, 7, 1), 'en-US')).toBe('Aug 1, 2026');
  });
});

describe('DatePicker', () => {
  it('shows the placeholder when no date is chosen', () => {
    render(
      <DatePicker value={undefined} onChange={() => {}} placeholder="Pick a date" />,
    );

    expect(screen.getByRole('button', { name: /pick a date/i })).toBeInTheDocument();
  });

  it('shows the chosen date on the trigger', () => {
    render(
      <DatePicker value={new Date(2026, 7, 1)} onChange={() => {}} locale="en-GB" />,
    );

    expect(screen.getByRole('button', { name: /1 Aug 2026/ })).toBeInTheDocument();
  });

  it('opens the calendar from the keyboard', async () => {
    const user = userEvent.setup();
    render(<DatePicker value={undefined} onChange={() => {}} />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('grid')).toBeInTheDocument();
  });

  it('reports the chosen day and closes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <DatePicker value={new Date(2026, 7, 1)} onChange={onChange} locale="en-GB" />,
    );

    await user.click(screen.getByRole('button', { name: /1 Aug 2026/ }));

    const grid = await screen.findByRole('grid');
    await user.click(within(grid).getByText('14', { selector: 'button' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    // Leaving it open after a choice makes the user hunt for a way out.
    await waitFor(() => expect(screen.queryByRole('grid')).toBeNull());
  });

  it('can be disabled', () => {
    render(<DatePicker value={undefined} onChange={() => {}} disabled />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <>
        <label htmlFor="date">Appointment date</label>
        <DatePicker id="date" value={new Date(2026, 7, 1)} onChange={() => {}} />
      </>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
