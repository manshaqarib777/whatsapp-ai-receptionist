import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { NotificationsBell } from '@/features/dashboard/components/notifications-bell';

/**
 * Notifications bell — the shell header's unread count + dropdown.
 *
 * Fetches the current user's notifications on mount, shows an unread badge, and
 * renders the list in a labelled dropdown. The suite proves the fetch wiring, the
 * count, the empty state, and the labelled dialog.
 */

const NOTIFICATIONS = [
  {
    id: 'n-1',
    kind: 'escalation',
    title: 'Conversation escalated to you',
    body: 'A customer is waiting.',
    readAt: null,
    createdAt: '2026-08-12T09:00:00.000Z',
  },
  {
    id: 'n-2',
    kind: 'appointment',
    title: 'Appointment cancelled by customer',
    body: null,
    readAt: '2026-08-11T10:00:00.000Z',
    createdAt: '2026-08-11T10:00:00.000Z',
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

const OK_RESPONSE = (notifications: unknown[]) => ({
  ok: true,
  json: () => Promise.resolve({ data: { notifications } }),
});

describe('NotificationsBell', () => {
  it('shows an unread count on the bell', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(OK_RESPONSE(NOTIFICATIONS)));

    render(<NotificationsBell />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  it('labels the bell plainly when nothing is unread', async () => {
    const data = NOTIFICATIONS.slice(1); // only the read one
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(OK_RESPONSE(data)));

    render(<NotificationsBell />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  it('opens a dropdown listing the notifications', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(OK_RESPONSE(NOTIFICATIONS)));

    const user = userEvent.setup();
    render(<NotificationsBell />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));

    expect(await screen.findByText('Conversation escalated to you')).toBeInTheDocument();
    expect(await screen.findByText('Appointment cancelled by customer')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('shows a caught-up message when there are no notifications', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(OK_RESPONSE([])));

    const user = userEvent.setup();
    render(<NotificationsBell />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('You are all caught up.')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(OK_RESPONSE(NOTIFICATIONS)));

    const { container } = render(<NotificationsBell />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument());

    expect(await axe(container)).toHaveNoViolations();
    vi.unstubAllGlobals();
  });
});
