import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

describe('PageHeader', () => {
  it('renders the title as the page heading', () => {
    render(<PageHeader title="Members" />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Members' }),
    ).toBeInTheDocument();
  });

  it('renders page-level actions', () => {
    render(<PageHeader title="Members" actions={<Button>Invite</Button>} />);

    expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument();
  });

  it('hides breadcrumbs at two levels, where the title already says it', () => {
    render(
      <PageHeader
        title="Members"
        breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Members' }]}
      />,
    );

    expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).toBeNull();
  });

  it('shows breadcrumbs past two levels', () => {
    render(
      <PageHeader
        title="Members"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Settings', href: '/settings' },
          { label: 'Members' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('does not link the current page', () => {
    render(
      <PageHeader
        title="Members"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Settings', href: '/settings' },
          { label: 'Members' },
        ]}
      />,
    );

    // A link to where you already are is noise. The crumb keeps the link role for
    // the breadcrumb pattern but is marked as the current page and not navigable —
    // what must never happen is a real anchor pointing at this page.
    const current = screen.getByRole('link', { name: 'Members' });

    expect(current.tagName).not.toBe('A');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveAttribute('aria-disabled', 'true');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <PageHeader
        title="Members"
        description="Who can see and reply to conversations."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Settings', href: '/settings' },
          { label: 'Members' },
        ]}
        actions={<Button>Invite</Button>}
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
