import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PipelineBoard } from '@/features/crm/components/pipeline-board';

/**
 * Pipeline board component tests — the four states plus the move-deal action
 * and axe cleanliness.
 */

const PIPELINE = {
  id: 'pipeline-1',
  name: 'Treatment plans',
  isDefault: true,
  stages: [
    {
      id: 'stage-1',
      pipelineId: 'pipeline-1',
      name: 'New enquiry',
      position: 0,
      winProbability: 0.1,
      dealCount: 1,
    },
    {
      id: 'stage-2',
      pipelineId: 'pipeline-1',
      name: 'Qualified',
      position: 1,
      winProbability: 0.4,
      dealCount: 0,
    },
  ],
};

const DEAL = {
  id: 'deal-1',
  contactId: null,
  companyId: null,
  stageId: 'stage-1',
  stageName: 'New enquiry',
  title: 'Root canal case',
  valueAmount: 1450,
  valueCurrency: 'SAR',
  status: 'open' as const,
  closedAt: null,
  createdAt: '2026-08-14T09:00:00.000Z',
  updatedAt: '2026-08-14T09:00:00.000Z',
  version: 1,
  contactName: 'Aisha Khan',
  companyName: null,
  tags: [{ id: 'tag-1', name: 'Insurance', color: 'info' }],
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

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/crm/pipelines'))
        return Promise.resolve(ok({ data: { pipelines: [PIPELINE] } }));
      if (u.includes('/api/crm/deals')) {
        const deals = u.includes('stageId=stage-2') ? [] : [DEAL];
        return Promise.resolve(ok({ data: { deals } }));
      }
      return Promise.resolve(ok({ data: {} }));
    }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PipelineBoard', () => {
  it('renders stages and deals from the query', async () => {
    mockFetch();
    renderWithQuery(<PipelineBoard />);

    expect(await screen.findByText('Treatment plans')).toBeInTheDocument();
    expect(screen.getByText('New enquiry')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
    expect(await screen.findByText('Root canal case')).toBeInTheDocument();
    expect(screen.getByText('Insurance')).toBeInTheDocument();
  });

  it('shows an empty state when there is no pipeline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { pipelines: [] } })),
    );
    renderWithQuery(<PipelineBoard />);

    expect(await screen.findByText('No pipeline yet')).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
      ),
    );
    renderWithQuery(<PipelineBoard />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('moves a deal through the stage menu', async () => {
    mockFetch();
    renderWithQuery(<PipelineBoard />);

    const moveButton = await screen.findByRole('button', { name: 'Move…' });
    await userEvent.click(moveButton);

    const stageOption = await screen.findByRole('button', { name: 'Qualified' });
    await userEvent.click(stageOption);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/crm/deals/deal-1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('has no accessibility violations', async () => {
    mockFetch();
    const { container } = renderWithQuery(<PipelineBoard />);
    await screen.findByText('Root canal case');

    expect(await axe(container)).toHaveNoViolations();
  });
});
