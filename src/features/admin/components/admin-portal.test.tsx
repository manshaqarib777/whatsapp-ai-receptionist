import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AdminPortal } from './admin-portal';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const data = {
  overview: {
    tenants: 2,
    users: 6,
    activeSubscriptions: 2,
    aiRuns: 2,
    failedJobs: 0,
    auditEvents: 3,
  },
  tenants: {
    items: [
      {
        id: 'org-1',
        name: 'Northwind Dental',
        slug: 'northwind',
        members: 4,
        branches: 2,
        subscription: { status: 'active', plan: { name: 'Growth' } },
      },
    ],
  },
  plans: [
    {
      id: 'plan-1',
      name: 'Growth',
      description: 'Growing teams.',
      amount: 149,
      currency: 'USD',
      interval: 'month',
      active: true,
      version: 1,
      subscriptions: 1,
    },
  ],
  billing: {
    items: [
      {
        id: 'sub-1',
        status: 'active',
        amount: 149,
        currency: 'USD',
        interval: 'month',
        periodEndsAt: '2026-09-24T00:00:00Z',
        cancelAtPeriodEnd: false,
        version: 1,
        organization: { name: 'Northwind Dental' },
        plan: { name: 'Growth' },
      },
    ],
  },
  logs: {
    items: [
      {
        id: 'log-1',
        action: 'organization.created',
        organizationId: 'org-1',
        entityType: 'organization',
        createdAt: '2026-08-24T00:00:00Z',
      },
    ],
  },
  usage: [
    {
      organizationId: 'org-1',
      organizationName: 'Northwind Dental',
      runs: 2,
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.01,
      averageLatencyMs: 12,
    },
  ],
  analytics: {
    conversations: 17,
    appointments: [{ status: 'confirmed', count: 4 }],
    campaigns: [{ status: 'sent', count: 1 }],
    invoices: [{ currency: 'SAR', count: 2, total: 100, paid: 50 }],
  },
  monitoring: {
    status: 'operational',
    databaseLatencyMs: 2,
    integrationErrors: 0,
    queues: { failedAiJobs: 0 },
    checkedAt: '2026-08-24T00:00:00Z',
  },
};

describe('AdminPortal', () => {
  it('renders every required surface accessibly', async () => {
    const user = userEvent.setup();
    const { container } = render(<AdminPortal data={data} />);
    expect(screen.getByText(/active subscriptions/i)).toBeInTheDocument();
    for (const [tab, expected] of [
      ['Tenants', 'Northwind Dental'],
      ['Plans', 'Growing teams.'],
      ['Billing', 'Cancel at period end'],
      ['Logs', 'organization.created'],
      ['AI usage', '15'],
      ['Analytics', 'Conversations'],
      ['Monitoring', 'Database latency'],
    ] as const) {
      await user.click(screen.getByRole('tab', { name: tab }));
      expect(screen.getByText(expected, { exact: false })).toBeInTheDocument();
    }
    expect(await axe(container)).toHaveNoViolations();
  });
});
