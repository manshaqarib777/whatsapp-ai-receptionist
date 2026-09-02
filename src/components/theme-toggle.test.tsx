import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { ThemeToggle } from '@/components/theme-toggle';
import { ThemeProvider } from '@/providers/theme-provider';

/**
 * Theme integration.
 *
 * Covers the two things that make dark mode feel finished rather than bolted on: the
 * choice actually lands on the document, and it survives a reload.
 */

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.className = '';
});

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe('ThemeToggle', () => {
  it('offers light, dark, and following the system', async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole('button', { name: /theme/i }));

    // "System" is not optional: overriding the OS preference must be a choice, not
    // a one-way door.
    expect(await screen.findByRole('menuitem', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'System' })).toBeInTheDocument();
  });

  it('applies the chosen theme to the document', async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole('button', { name: /theme/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Dark' }));

    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  });

  it('persists the choice, so a reload does not undo it', async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole('button', { name: /theme/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Dark' }));

    // The same key the pre-paint script reads, which is what removes the flash of
    // the wrong theme on the next load.
    await waitFor(() => expect(window.localStorage.getItem('theme')).toBe('dark'));
  });

  it('switches back to light', async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole('button', { name: /theme/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Dark' }));
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));

    await user.click(screen.getByRole('button', { name: /theme/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Light' }));

    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'));
  });

  it('names the trigger by its current state', () => {
    renderToggle();

    expect(screen.getByRole('button', { name: /^theme:/i })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderToggle();

    expect(await axe(container)).toHaveNoViolations();
  });
});
