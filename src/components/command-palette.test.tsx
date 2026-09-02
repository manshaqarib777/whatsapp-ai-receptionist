import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox, Plus } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { CommandPalette, type CommandAction } from '@/components/command-palette';

function actions(overrides: Partial<CommandAction>[] = []): CommandAction[] {
  const base: CommandAction[] = [
    {
      id: 'inbox',
      label: 'Go to inbox',
      icon: Inbox,
      group: 'Navigate',
      keywords: ['conversations'],
      onSelect: () => {},
    },
    {
      id: 'new',
      label: 'New conversation',
      icon: Plus,
      group: 'Actions',
      onSelect: () => {},
    },
  ];

  return base.map((action, index) => ({ ...action, ...overrides[index] }));
}

describe('CommandPalette', () => {
  it('stays closed until asked for', () => {
    render(<CommandPalette actions={actions()} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on Meta+K', async () => {
    const user = userEvent.setup();
    render(<CommandPalette actions={actions()} />);

    await user.keyboard('{Meta>}k{/Meta}');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('opens on Control+K, for people not on a Mac', async () => {
    const user = userEvent.setup();
    render(<CommandPalette actions={actions()} />);

    await user.keyboard('{Control>}k{/Control}');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<CommandPalette actions={actions()} />);

    await user.keyboard('{Meta>}k{/Meta}');
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('groups actions under their headings', async () => {
    render(<CommandPalette actions={actions()} open onOpenChange={() => {}} />);

    expect(await screen.findByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('filters as the user types', async () => {
    const user = userEvent.setup();
    render(<CommandPalette actions={actions()} open onOpenChange={() => {}} />);

    await user.type(await screen.findByRole('combobox'), 'new');

    await waitFor(() => expect(screen.queryByText('Go to inbox')).toBeNull());
    expect(screen.getByText('New conversation')).toBeInTheDocument();
  });

  it('matches on keywords, not just the visible label', async () => {
    const user = userEvent.setup();
    render(<CommandPalette actions={actions()} open onOpenChange={() => {}} />);

    // "conversations" is a keyword of "Go to inbox" — searching for what a user
    // calls the thing should find it.
    await user.type(await screen.findByRole('combobox'), 'conversations');

    expect(screen.getByText('Go to inbox')).toBeInTheDocument();
  });

  it('runs the chosen action and closes', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CommandPalette
        actions={actions([{ onSelect }])}
        open
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(await screen.findByText('Go to inbox'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    // Leaving the palette open over the page it just navigated to is disorientating.
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    render(<CommandPalette actions={actions()} open onOpenChange={() => {}} />);

    await user.type(await screen.findByRole('combobox'), 'zzzzz');

    expect(await screen.findByText('No matching commands.')).toBeInTheDocument();
  });

  it('is labelled for screen readers', async () => {
    render(<CommandPalette actions={actions()} open onOpenChange={() => {}} />);

    expect(
      await screen.findByRole('dialog', { name: /command palette/i }),
    ).toBeInTheDocument();
  });
});
