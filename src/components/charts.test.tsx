import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import {
  ComparisonChart,
  Sparkline,
  TrendChart,
  formatAxisNumber,
} from '@/components/charts';
import type { ChartConfig } from '@/components/ui/chart';

const DATA = [
  { date: 'Mon', conversations: 42, resolved: 30 },
  { date: 'Tue', conversations: 58, resolved: 41 },
];

const CONFIG = {
  conversations: { label: 'Conversations', color: 'var(--chart-1)' },
  resolved: { label: 'Resolved', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const SUMMARY = 'Conversations rose from 42 on Monday to 58 on Tuesday.';

describe('formatAxisNumber', () => {
  it('leaves small numbers alone', () => {
    expect(formatAxisNumber(42)).toBe('42');
  });

  it('abbreviates thousands', () => {
    // "1200.00000" on an axis is noise; "1.2k" is the number.
    expect(formatAxisNumber(1200)).toBe('1.2k');
  });

  it('abbreviates millions', () => {
    expect(formatAxisNumber(2_400_000)).toBe('2.4m');
  });

  it('handles negatives', () => {
    expect(formatAxisNumber(-1500)).toBe('-1.5k');
  });
});

describe('TrendChart', () => {
  it('describes the trend rather than announcing "chart"', () => {
    render(
      <TrendChart
        data={DATA}
        config={CONFIG}
        categoryKey="date"
        series={['conversations']}
        summary={SUMMARY}
      />,
    );

    expect(screen.getByRole('img', { name: SUMMARY })).toBeInTheDocument();
  });

  it('exposes the underlying numbers as a table', () => {
    render(
      <TrendChart
        data={DATA}
        config={CONFIG}
        categoryKey="date"
        series={['conversations', 'resolved']}
        summary={SUMMARY}
      />,
    );

    // A canvas is invisible to a screen reader; the table is the equivalent, not a
    // nice-to-have (ACCESSIBILITY_RULES.md 1.1.1).
    const table = screen.getByRole('table', { name: SUMMARY });

    expect(
      within(table).getByRole('columnheader', { name: 'Conversations' }),
    ).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Mon' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '42' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <TrendChart
        data={DATA}
        config={CONFIG}
        categoryKey="date"
        series={['conversations']}
        summary={SUMMARY}
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ComparisonChart', () => {
  it('ships the same table fallback', () => {
    render(
      <ComparisonChart
        data={DATA}
        config={CONFIG}
        categoryKey="date"
        series={['conversations']}
        summary={SUMMARY}
      />,
    );

    expect(screen.getByRole('table', { name: SUMMARY })).toBeInTheDocument();
  });
});

describe('Sparkline', () => {
  it('renders the first series with a fallback table', () => {
    render(
      <Sparkline
        data={DATA}
        config={CONFIG}
        categoryKey="date"
        series={['conversations']}
        summary={SUMMARY}
      />,
    );

    expect(screen.getByRole('table', { name: SUMMARY })).toBeInTheDocument();
  });

  it('renders nothing rather than an empty box when given no series', () => {
    const { container } = render(
      <Sparkline
        data={DATA}
        config={CONFIG}
        categoryKey="date"
        series={[]}
        summary={SUMMARY}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
