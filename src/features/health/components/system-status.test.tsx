import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemStatus } from '@/features/health/components/system-status';

/**
 * Component tests cover every state required by .claude/UI_RULES.md:
 * loading, error, and success. Assertions target accessible roles and text —
 * never class names or internal state.
 */

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const healthyPayload = {
  data: {
    status: 'ok',
    timestamp: '2026-08-01T00:00:00.000Z',
    uptimeSeconds: 42,
    checks: { database: 'ok' },
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SystemStatus', () => {
  it('renders a loading state while the request is in flight', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );

    renderWithQuery(<SystemStatus />);

    expect(screen.getByLabelText('Loading system status')).toBeInTheDocument();
  });

  it('renders the report on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(healthyPayload),
        }),
      ),
    );

    renderWithQuery(<SystemStatus />);

    expect(await screen.findByText('Operational')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('42s')).toBeInTheDocument();
  });

  it('renders an error state with a retry action when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) }),
      ),
    );

    renderWithQuery(<SystemStatus />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Status unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('refetches when the user activates retry', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({}) })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(healthyPayload),
      });

    vi.stubGlobal('fetch', fetchMock);

    renderWithQuery(<SystemStatus />);

    await user.click(await screen.findByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Operational')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('does not convey status by colour alone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(healthyPayload),
        }),
      ),
    );

    renderWithQuery(<SystemStatus />);

    // Each status carries a text label, not just a coloured icon.
    expect(await screen.findByText('Operational')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('exposes the report to assistive technology as a live region', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(healthyPayload),
        }),
      ),
    );

    const { container } = renderWithQuery(<SystemStatus />);

    await screen.findByText('Operational');
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});
