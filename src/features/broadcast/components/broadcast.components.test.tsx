import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { CampaignList } from '@/features/broadcast/components/campaign-list';
import { CampaignDetail } from '@/features/broadcast/components/campaign-detail';
import { SegmentManager } from '@/features/broadcast/components/segment-manager';
import { TemplateManager } from '@/features/broadcast/components/template-manager';

/**
 * Broadcast component tests (M14) — list/detail/segment/template states,
 * lifecycle actions, axe-clean.
 */

const CAMPAIGN = {
  id: 'campaign-1',
  name: 'June checkup reminder',
  segmentId: 'segment-1',
  segmentName: 'Riyadh English speakers',
  templateId: 'template-1',
  templateName: 'Checkup reminder',
  status: 'scheduled' as const,
  scheduledFor: '2026-08-20T10:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  createdAt: '2026-08-14T09:00:00.000Z',
  updatedAt: '2026-08-14T09:00:00.000Z',
};

const SEGMENT = {
  id: 'segment-1',
  name: 'Riyadh English speakers',
  definition: { locale: 'en' },
  createdAt: '2026-08-14T09:00:00.000Z',
};

const TEMPLATE = {
  id: 'template-1',
  name: 'Checkup reminder',
  language: 'en',
  metaStatus: 'approved',
  rejectionReason: null,
  body: { body: 'Hi {{1}}, your appointment is coming up.' },
  createdAt: '2026-08-14T09:00:00.000Z',
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

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CampaignList', () => {
  it('renders campaigns with status badges', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { campaigns: [CAMPAIGN] } })),
    );
    renderWithQuery(<CampaignList />);

    expect(await screen.findByText('June checkup reminder')).toBeInTheDocument();
    expect(screen.getByText('scheduled')).toBeInTheDocument();
    expect(
      screen.getByText('Riyadh English speakers · Checkup reminder'),
    ).toBeInTheDocument();
  });

  it('renders an empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { campaigns: [] } })),
    );
    renderWithQuery(<CampaignList />);

    expect(await screen.findByText('No campaigns yet')).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ({ ok: false, status: 500 })),
    );
    renderWithQuery(<CampaignList />);

    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { campaigns: [CAMPAIGN] } })),
    );
    const { container } = renderWithQuery(<CampaignList />);
    await screen.findByText('June checkup reminder');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('CampaignDetail', () => {
  const DETAIL = {
    campaign: CAMPAIGN,
    analytics: {
      total: 24,
      sent: 24,
      delivered: 22,
      read: 19,
      failed: 1,
      deliveredRate: 22 / 24,
    },
    recipients: [
      {
        id: 'recipient-1',
        contactId: 'contact-1',
        contactDisplayName: 'Aisha Khan',
        phoneNumber: '+96650000001',
        status: 'delivered',
        failureReason: null,
      },
    ],
  };

  it('shows segment, template, schedule, and analytics', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: DETAIL })),
    );
    renderWithQuery(<CampaignDetail campaignId="campaign-1" />);

    expect(await screen.findByText('June checkup reminder')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getAllByText('24').length).toBeGreaterThan(0);
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Aisha Khan')).toBeInTheDocument();
  });

  it('offers lifecycle actions for a scheduled campaign', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: DETAIL })),
    );
    renderWithQuery(<CampaignDetail campaignId="campaign-1" />);

    expect(await screen.findByRole('button', { name: 'Send now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: DETAIL })),
    );
    const { container } = renderWithQuery(<CampaignDetail campaignId="campaign-1" />);
    await screen.findByText('June checkup reminder');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('SegmentManager', () => {
  it('lists segments with a preview button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { segments: [SEGMENT] } })),
    );
    renderWithQuery(<SegmentManager />);

    expect(await screen.findByText('Riyadh English speakers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
  });

  it('renders an empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { segments: [] } })),
    );
    renderWithQuery(<SegmentManager />);

    expect(await screen.findByText('No segments yet')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { segments: [SEGMENT] } })),
    );
    const { container } = renderWithQuery(<SegmentManager />);
    await screen.findByText('Riyadh English speakers');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('TemplateManager', () => {
  it('lists templates with approval status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { templates: [TEMPLATE] } })),
    );
    renderWithQuery(<TemplateManager />);

    expect(await screen.findByText('Checkup reminder')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  it('renders an empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { templates: [] } })),
    );
    renderWithQuery(<TemplateManager />);

    expect(await screen.findByText('No templates yet')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { templates: [TEMPLATE] } })),
    );
    const { container } = renderWithQuery(<TemplateManager />);
    await screen.findByText('Checkup reminder');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
