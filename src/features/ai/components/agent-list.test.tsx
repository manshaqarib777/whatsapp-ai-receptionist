import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AgentList } from './agent-list';

const agent = {
  id: 'agent-1',
  kind: 'billing',
  displayName: 'Billing Agent',
  description: 'Invoice support.',
  purpose: 'Answers billing questions.',
  enabled: true,
  tools: ['knowledge.lookup'],
  promptTemplateId: null,
  version: 1,
};

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AgentList canManage />
    </QueryClientProvider>,
  );
}

describe('AgentList', () => {
  it('renders specialist capabilities accessibly and runs a labelled local test', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                result: {
                  routedKind: 'billing',
                  wouldHandle: true,
                  reply: '[Local demo] handled.',
                },
              },
            }),
          }
        : { ok: true, status: 200, json: async () => ({ data: { agents: [agent] } }) },
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { container } = renderList();
    expect(
      await screen.findByRole('heading', { name: 'Billing Agent' }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Test routing phrase'), 'Send my invoice');
    await user.click(screen.getByRole('button', { name: 'Run local test' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'billing: [Local demo] handled.',
    );
    expect(await axe(container)).toHaveNoViolations();
    vi.unstubAllGlobals();
  });
  it('hides management controls for read-only roles', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: { agents: [agent] } }),
      })),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AgentList canManage={false} />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Billing Agent' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
