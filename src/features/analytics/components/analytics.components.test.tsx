import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { RevenueSection } from '@/features/analytics/components/revenue-section';
import { FunnelSection } from '@/features/analytics/components/funnel-section';
import { ForecastSection } from '@/features/analytics/components/forecast-section';
import type {
  ForecastOverview,
  FunnelSection as FunnelSectionType,
  RevenueOverview,
} from '@/features/analytics/services/analytics.service';

/**
 * Analytics section component tests (M15) — populated states and axe-clean.
 *
 * The sections are presentational client components that receive their data as
 * props from the server page, so they render directly in jsdom like the
 * dashboard's chart widgets.
 */

const REVENUE: RevenueOverview = {
  invoiced: 1000,
  collected: 600,
  outstanding: 400,
  refunds: 0,
  byStatus: [],
  invoicedSeries: [{ date: new Date(), label: '1 Jul', amount: 1000 }],
  collectedSeries: [{ date: new Date(), label: '1 Jul', amount: 600 }],
};

const FUNNELS: FunnelSectionType = {
  pipeline: [
    { stageName: 'New enquiry', openDeals: 9, openValue: 9000, winProbability: 0.1 },
    { stageName: 'Won', openDeals: 3, openValue: 3000, winProbability: 1 },
  ],
  conversion: {
    quotes: 5,
    accepted: 3,
    invoiced: 2,
    paid: 1,
    acceptanceRate: 60,
    invoiceRate: 66.7,
    paymentRate: 50,
  },
};

const FORECAST: ForecastOverview = {
  weighted: 2100,
  openValue: 3000,
  deals: 2,
  byStage: [{ stageName: 'Won', deals: 1, value: 2000, weighted: 2000 }],
  projection: [{ month: '2026-09', amount: 800 }],
  projectionIsEstimate: true,
};

function renderSection(ui: ReactNode) {
  return render(ui);
}

describe('RevenueSection', () => {
  it('renders revenue metrics and the trend chart', () => {
    renderSection(<RevenueSection revenue={REVENUE} />);

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    // Testing-library normalises the Intl non-breaking space to a regular space.
    expect(screen.getByText('SAR 1,000')).toBeInTheDocument();
    expect(screen.getByText('SAR 600')).toBeInTheDocument();
    expect(screen.getByText('SAR 400')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSection(<RevenueSection revenue={REVENUE} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('FunnelSection', () => {
  it('renders the pipeline funnel with stage counts', () => {
    renderSection(<FunnelSection funnels={FUNNELS} />);

    expect(screen.getByText('Funnels')).toBeInTheDocument();
    expect(screen.getByText('New enquiry')).toBeInTheDocument();
    expect(screen.getByText('Won')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSection(<FunnelSection funnels={FUNNELS} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('ForecastSection', () => {
  it('renders the weighted forecast and projection', () => {
    renderSection(<ForecastSection forecast={FORECAST} />);

    expect(screen.getByText('Forecast')).toBeInTheDocument();
    expect(screen.getByText('SAR 2,100')).toBeInTheDocument();
    expect(screen.getByText('Past trend, not a commitment.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSection(<ForecastSection forecast={FORECAST} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
