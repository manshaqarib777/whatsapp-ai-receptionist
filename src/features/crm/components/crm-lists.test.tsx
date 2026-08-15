import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { CompanyList } from '@/features/crm/components/company-list';
import { TagManager } from '@/features/crm/components/tag-manager';
import { TaskList } from '@/features/crm/components/task-list';

/**
 * CRM list component tests — companies, tags, tasks (M10). Each covers the
 * populated + empty states and axe cleanliness.
 */

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

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CompanyList', () => {
  it('renders companies with counts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        ok({
          data: {
            companies: [
              {
                id: 'c1',
                name: 'Alrajhi Logistics',
                vatNumber: '300123',
                createdAt: '2026-08-01',
                contactCount: 2,
                dealCount: 1,
              },
            ],
          },
        }),
      ),
    );
    renderWithQuery(<CompanyList />);

    expect(await screen.findByText('Alrajhi Logistics')).toBeInTheDocument();
    expect(screen.getByText('2 contacts')).toBeInTheDocument();
    expect(screen.getByText('1 deals')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { companies: [] } })),
    );
    renderWithQuery(<CompanyList />);

    expect(await screen.findByText('No companies yet')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { companies: [] } })),
    );
    const { container } = renderWithQuery(<CompanyList />);
    await screen.findByText('No companies yet');

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('TagManager', () => {
  it('renders tags', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        ok({
          data: {
            tags: [
              { id: 't1', name: 'Insurance', color: 'info' },
              { id: 't2', name: 'Referral', color: 'success' },
            ],
          },
        }),
      ),
    );
    renderWithQuery(<TagManager />);

    expect(await screen.findByText('Insurance')).toBeInTheDocument();
    expect(screen.getByText('Referral')).toBeInTheDocument();
  });

  it('creates a tag through the dialog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { tags: [] } })),
    );
    renderWithQuery(<TagManager />);

    await userEvent.click(await screen.findByRole('button', { name: 'New tag' }));
    expect(await screen.findByRole('heading', { name: 'New tag' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Name'), 'VIP');
    await userEvent.click(screen.getByRole('button', { name: 'Create tag' }));

    expect(fetch).toHaveBeenCalledWith(
      '/api/crm/tags',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { tags: [] } })),
    );
    const { container } = renderWithQuery(<TagManager />);
    await screen.findByText('No tags yet');

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('TaskList', () => {
  it('renders tasks with status and due date', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        ok({
          data: {
            tasks: [
              {
                id: 'task-1',
                title: 'Call back about the crown fitting',
                description: null,
                dueAt: '2026-08-16T17:00:00.000Z',
                status: 'open',
                assigneeName: 'Amina Farouk',
                createdAt: '2026-08-10T09:00:00.000Z',
                updatedAt: '2026-08-10T09:00:00.000Z',
              },
            ],
          },
        }),
      ),
    );
    renderWithQuery(<TaskList />);

    expect(
      await screen.findByText('Call back about the crown fitting'),
    ).toBeInTheDocument();
    expect(screen.getByText('Amina Farouk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { tasks: [] } })),
    );
    renderWithQuery(<TaskList />);

    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { tasks: [] } })),
    );
    const { container } = renderWithQuery(<TaskList />);
    await screen.findByText('No tasks yet');

    expect(await axe(container)).toHaveNoViolations();
  });
});
