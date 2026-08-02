import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { Metric } from '@/components/metric';

describe('Metric', () => {
  it('shows the label and value', () => {
    render(<Metric label="Conversations" value="1,284" />);

    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('1,284')).toBeInTheDocument();
  });

  it('signs a positive delta and states the comparison period', () => {
    render(
      <Metric label="Conversations" value="1,284" delta={12} deltaLabel="vs last week" />,
    );

    // "1,284" alone is trivia; the comparison is what makes it information.
    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('vs last week')).toBeInTheDocument();
  });

  it('signs a negative delta', () => {
    render(
      <Metric label="Escalations" value="18" delta={-8} deltaLabel="vs last week" />,
    );

    expect(screen.getByText('-8%')).toBeInTheDocument();
  });

  it('treats a fall in a latency metric as good when told to', () => {
    // Down is not always bad. Colour follows sentiment, so the component cannot
    // silently tell the user a faster response time is a problem.
    const { container } = render(
      <Metric
        label="Avg response"
        value="2m 14s"
        delta={-8}
        deltaLabel="vs last week"
        sentiment="positive"
      />,
    );

    expect(container.querySelector('.text-success')).toBeInTheDocument();
    expect(container.querySelector('.text-destructive')).toBeNull();
  });

  it('treats an unqualified fall as negative', () => {
    const { container } = render(
      <Metric label="Conversations" value="1,284" delta={-8} deltaLabel="vs last week" />,
    );

    expect(container.querySelector('.text-destructive')).toBeInTheDocument();
  });

  it('renders no delta when there is nothing to compare against', () => {
    render(<Metric label="Conversations" value="1,284" />);

    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('announces its loading state', () => {
    render(<Metric label="Conversations" value="—" isLoading />);

    expect(screen.getByLabelText('Loading Conversations')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Metric label="Conversations" value="1,284" delta={12} deltaLabel="vs last week" />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
