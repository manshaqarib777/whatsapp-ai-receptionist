import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { KpiGrid, KpiGridSkeleton } from '@/features/dashboard/components/kpi-grid';
import type { KpiItem } from '@/features/dashboard/components/kpi-grid';

/**
 * KPI row — four tiles, each a doorway.
 *
 * COMPONENT_DESIGN.md §7: four KPIs maximum, every delta carries a comparison,
 * and each KPI links to its filtered detail view. The `Metric` component enforces
 * the comparison rules; this suite checks the doorway and the loading skeleton.
 */

const KPIS: KpiItem[] = [
  {
    label: 'New conversations',
    value: '12',
    delta: 12,
    deltaLabel: 'vs previous period',
    sentiment: 'positive',
    icon: 'conversation',
    href: '/inbox',
  },
  {
    label: 'Response time',
    value: '2m 14s',
    delta: -8,
    deltaLabel: 'vs previous period',
    sentiment: 'positive',
    icon: 'clock',
    href: '/inbox',
  },
  {
    label: 'Open revenue',
    value: 'SAR 4,198',
    delta: 0,
    deltaLabel: 'since start of period',
    sentiment: 'neutral',
    icon: 'revenue',
    href: '/reports',
  },
  {
    label: 'Open leads',
    value: '29',
    delta: -3,
    deltaLabel: 'vs previous period',
    sentiment: 'negative',
    icon: 'leads',
    href: '/contacts',
  },
];

describe('KpiGrid', () => {
  it('renders all four metrics with values', () => {
    render(<KpiGrid kpis={KPIS} />);

    for (const kpi of KPIS) {
      expect(screen.getByText(kpi.label)).toBeInTheDocument();
      expect(screen.getByText(kpi.value)).toBeInTheDocument();
    }
  });

  it('renders every delta with its sign', () => {
    render(<KpiGrid kpis={KPIS} />);

    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('-8%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('-3%')).toBeInTheDocument();
  });

  it('links each KPI to its detail view', () => {
    render(<KpiGrid kpis={KPIS} />);

    for (const kpi of KPIS) {
      const link = screen.getByRole('link', { name: new RegExp(kpi.label) });
      expect(link).toHaveAttribute('href', kpi.href);
    }
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<KpiGrid kpis={KPIS} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('KpiGridSkeleton', () => {
  it('announces loading to assistive technology', () => {
    render(<KpiGridSkeleton />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Loading key metrics')).toBeInTheDocument();
  });

  it('renders four placeholder tiles', () => {
    const { container } = render(<KpiGridSkeleton />);

    expect(container.querySelectorAll('.rounded-2xl.border')).toHaveLength(4);
  });
});
