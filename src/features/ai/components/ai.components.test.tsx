import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { RunLog } from '@/features/ai/components/run-log';
import { RunTurnForm } from '@/features/ai/components/run-turn-form';
import { TemplateList } from '@/features/ai/components/template-list';

function renderWithQuery(ui: ReactNode, direction: 'ltr' | 'rtl' = 'ltr') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <div dir={direction}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </div>,
  );
}

function response(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(payload),
  };
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('RunLog', () => {
  it('renders the loading, empty, and error states', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    const loading = renderWithQuery(<RunLog />);
    expect(screen.getByRole('status', { name: 'Loading AI runs' })).toBeInTheDocument();
    loading.unmount();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ data: { runs: [] } })),
    );
    const empty = renderWithQuery(<RunLog />);
    expect(await screen.findByText('No AI runs yet')).toBeInTheDocument();
    empty.unmount();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({}, false)),
    );
    renderWithQuery(<RunLog />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('renders a run accessibly in RTL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({
          data: {
            runs: [
              {
                id: 'run-1',
                conversationId: 'conversation-1',
                model: 'local/rule',
                intent: 'booking',
                confidence: 0.8,
                inputTokens: 12,
                outputTokens: 8,
                costAmount: 0,
                costCurrency: 'USD',
                latencyMs: 20,
                outcome: 'answered',
                createdAt: '2026-08-22T12:00:00.000Z',
              },
            ],
          },
        }),
      ),
    );
    const { container } = renderWithQuery(<RunLog />, 'rtl');

    expect(await screen.findByText('booking')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('TemplateList', () => {
  it('renders active template state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({
          data: {
            templates: [
              {
                id: 'template-1',
                key: 'receptionist.faq',
                name: 'FAQ',
                currentVersionId: 'version-1',
                version: 2,
                createdAt: '2026-08-22T12:00:00.000Z',
              },
            ],
          },
        }),
      ),
    );
    renderWithQuery(<TemplateList />);

    expect(await screen.findByText('receptionist.faq')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });
});

describe('RunTurnForm', () => {
  it('queues a trimmed persisted inbound message id', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/ai/runs' && init?.method === 'POST') {
        return response({
          data: {
            job: { id: 'job-1', status: 'queued', runId: null },
          },
        });
      }
      return response({ data: { runs: [] } });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithQuery(<RunTurnForm />);

    await user.type(
      screen.getByLabelText('Inbound message id'),
      '123e4567-e89b-12d3-a456-426614174000',
    );
    await user.click(screen.getByRole('button', { name: 'Queue turn' }));

    expect(await screen.findByText('queued')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/runs',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
