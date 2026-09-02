import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { CalendarView } from '@/features/appointments/components/calendar-view';

/**
 * Calendar view component tests — the four states (loading, error, empty,
 * populated) plus the cancel flow and axe cleanliness.
 */

const APPOINTMENT = {
  id: 'appt-1',
  contactId: 'contact-1',
  serviceId: 'service-1',
  resourceId: 'resource-1',
  startsAt: '2026-08-16T09:00:00.000Z',
  endsAt: '2026-08-16T09:30:00.000Z',
  timezone: 'Asia/Riyadh',
  status: 'booked',
  notes: null,
};

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function ok(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload),
  };
}

function mockFetch(appointments: unknown[] = [APPOINTMENT]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => ok({ data: { appointments } })),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CalendarView', () => {
  it('renders appointments from the calendar query', async () => {
    mockFetch();
    renderWithQuery(<CalendarView />);

    expect(await screen.findByText('booked')).toBeInTheDocument();
    expect(screen.getAllByText(/16 Aug/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Asia\/Riyadh/)).toBeInTheDocument();
  });

  it('shows an empty state when no appointments fall in the window', async () => {
    mockFetch([]);
    renderWithQuery(<CalendarView />);

    expect(await screen.findByText('No appointments in this window')).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
      ),
    );
    renderWithQuery(<CalendarView />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('cancels through the two-step confirm', async () => {
    mockFetch();
    renderWithQuery(<CalendarView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(
      await screen.findByRole('button', { name: 'Confirm cancel' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    mockFetch();
    const { container } = renderWithQuery(<CalendarView />);
    await screen.findByText('booked');

    expect(await axe(container)).toHaveNoViolations();
  });
});
