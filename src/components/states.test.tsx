import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';

describe('EmptyState', () => {
  it('explains why it is empty and offers the next action', () => {
    render(
      <EmptyState
        title="No conversations yet"
        description="When a customer messages your WhatsApp number, it appears here."
        action={<Button>Connect WhatsApp</Button>}
      />,
    );

    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    expect(screen.getByText(/appears here/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect WhatsApp' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <EmptyState title="Nothing here" description="It will appear here." />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ErrorState', () => {
  it('is announced as an alert', () => {
    render(<ErrorState />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('offers a retry when one is possible', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<ErrorState onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry button when there is nothing to retry', () => {
    render(<ErrorState />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<ErrorState onRetry={() => {}} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LoadingState', () => {
  it('announces what is loading rather than nothing', () => {
    render(<LoadingState label="Loading conversations" />);

    expect(screen.getByLabelText('Loading conversations')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('renders the requested number of placeholder lines', () => {
    const { container } = render(<LoadingState rows={5} />);

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(5);
  });

  it('hides the decorative bars from assistive technology', () => {
    const { container } = render(<LoadingState rows={3} />);

    // The bars mean nothing read out one by one; the label carries the message.
    for (const bar of container.querySelectorAll('[data-slot="skeleton"]')) {
      expect(bar).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<LoadingState />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
