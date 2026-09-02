import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { RangePicker } from '@/features/dashboard/components/range-picker';

/**
 * Global date range — COMPONENT_DESIGN.md §7: "at the top, persisted, applying to
 * every widget."
 *
 * The client only writes the cookie via the API route and refreshes; it never
 * decides what the page shows. The suite proves the picker reflects the server
 * value and that a selection persists through the API before refreshing.
 */

const { useRouter } = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter,
}));

const refresh = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
  useRouter.mockReturnValue({ refresh });
});

describe('RangePicker', () => {
  it('marks the active range as pressed', () => {
    render(<RangePicker value="30d" />);

    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '90 days' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('groups the toggle as a labelled control', () => {
    const { container } = render(<RangePicker value="30d" />);

    expect(
      container.querySelector('[role="group"][aria-label="Date range"]'),
    ).toBeInTheDocument();
  });

  it('persists a new range through the API and refreshes', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    render(<RangePicker value="30d" />);
    await user.click(screen.getByRole('button', { name: '90 days' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/range',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: '90d' }),
      }),
    );
    expect(refresh).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('does not refetch when the selection is unchanged', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<RangePicker value="90d" />);
    await user.click(screen.getByRole('button', { name: '90 days' }));

    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<RangePicker value="30d" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
