import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { UpcomingAppointments } from '@/features/dashboard/components/upcoming-appointments';

/**
 * Upcoming appointments — the next few non-cancelled bookings.
 *
 * Each row is a doorway to the appointment detail stub. The suite checks the
 * rendered rows, the doorway hrefs, and the empty state.
 */

const APPOINTMENTS = [
  {
    id: 'appt-1',
    contactDisplayName: 'Aisha Khan',
    startsAt: new Date('2026-08-15T09:30:00.000Z'),
    endsAt: new Date('2026-08-15T10:00:00.000Z'),
    status: 'confirmed',
    branchId: 'branch-1',
  },
  {
    id: 'appt-2',
    contactDisplayName: 'Omar Hassan',
    startsAt: new Date('2026-08-16T11:00:00.000Z'),
    endsAt: new Date('2026-08-16T11:30:00.000Z'),
    status: 'booked',
    branchId: 'branch-1',
  },
];

describe('UpcomingAppointments', () => {
  it('renders the contact names and statuses', () => {
    render(<UpcomingAppointments appointments={APPOINTMENTS} />);

    expect(screen.getByText('Upcoming appointments')).toBeInTheDocument();
    expect(screen.getByText('Aisha Khan')).toBeInTheDocument();
    expect(screen.getByText('Omar Hassan')).toBeInTheDocument();
    expect(screen.getByText('confirmed')).toBeInTheDocument();
    expect(screen.getByText('booked')).toBeInTheDocument();
  });

  it('links each appointment to its detail doorway', () => {
    render(<UpcomingAppointments appointments={APPOINTMENTS} />);

    expect(screen.getByRole('link', { name: /aisha khan/i })).toHaveAttribute(
      'href',
      '/appointments/appt-1',
    );
    expect(screen.getByRole('link', { name: /omar hassan/i })).toHaveAttribute(
      'href',
      '/appointments/appt-2',
    );
  });

  it('renders an empty state with guidance', () => {
    render(<UpcomingAppointments appointments={[]} />);

    expect(screen.getByText('New bookings will appear here.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<UpcomingAppointments appointments={APPOINTMENTS} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
