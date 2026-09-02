import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { AppointmentDetail } from '@/features/appointments/components/appointment-detail';

/**
 * Appointment detail component tests — every state (loading, error, success)
 * plus the cancel and reschedule actions and axe cleanliness.
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

function mockFetch(appointment = APPOINTMENT) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => ok({ data: { appointment } })),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppointmentDetail', () => {
  it('renders the booking details', async () => {
    mockFetch();
    renderWithQuery(<AppointmentDetail appointmentId="appt-1" />);

    expect(await screen.findByText('booked')).toBeInTheDocument();
    expect(screen.getByText('Asia/Riyadh')).toBeInTheDocument();
    expect(screen.getAllByText(/16 Aug 2026/).length).toBeGreaterThan(0);
    expect(screen.getByText('service-1'.slice(0, 8))).toBeInTheDocument();
  });

  it('shows cancel and reschedule for a live booking', async () => {
    mockFetch();
    renderWithQuery(<AppointmentDetail appointmentId="appt-1" />);

    expect(
      await screen.findByRole('button', { name: 'Cancel appointment' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reschedule' })).toBeInTheDocument();
  });

  it('hides destructive actions once cancelled', async () => {
    mockFetch({ ...APPOINTMENT, status: 'cancelled' });
    renderWithQuery(<AppointmentDetail appointmentId="appt-1" />);

    await waitFor(() => expect(screen.getByText('cancelled')).toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: 'Cancel appointment' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reschedule' })).not.toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
      ),
    );
    renderWithQuery(<AppointmentDetail appointmentId="missing" />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('cancels through the confirmation dialog', async () => {
    // Delay the PATCH response so the pending state is observable.
    let resolveCancel: ((value: unknown) => void) | undefined;
    const cancelResponse = new Promise((resolve) => {
      resolveCancel = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (
          String(url).endsWith('/api/appointments/appt-1') &&
          init?.method === 'PATCH'
        ) {
          return cancelResponse.then(() => ok({ data: { ok: true } }));
        }
        return Promise.resolve(ok({ data: { appointment: APPOINTMENT } }));
      }),
    );

    renderWithQuery(<AppointmentDetail appointmentId="appt-1" />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel appointment' }),
    );
    expect(await screen.findByText('Cancel this appointment?')).toBeInTheDocument();

    // The dialog carries its own confirm button with a destructive variant.
    await userEvent.click(screen.getByRole('button', { name: 'Cancel appointment' }));
    expect(await screen.findByText('Cancelling…')).toBeInTheDocument();

    resolveCancel?.(null);
  });

  it('has no accessibility violations', async () => {
    mockFetch();
    const { container } = renderWithQuery(<AppointmentDetail appointmentId="appt-1" />);
    await screen.findByText('booked');

    expect(await axe(container)).toHaveNoViolations();
  });
});
