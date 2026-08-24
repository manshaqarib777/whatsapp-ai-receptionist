import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DashboardWidgetBoundary } from './dashboard-widget-boundary';

function BrokenWidget(): never {
  throw new Error('database unavailable');
}

describe('DashboardWidgetBoundary', () => {
  it('contains one widget failure without replacing its sibling', () => {
    const errorOutput = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <>
        <DashboardWidgetBoundary title="Revenue">
          <BrokenWidget />
        </DashboardWidgetBoundary>
        <p>Activity is still available</p>
      </>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Revenue could not be loaded');
    expect(screen.getByText('Activity is still available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    errorOutput.mockRestore();
  });
});
