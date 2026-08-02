'use client';

import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';

/**
 * Command palette — ⌘K / Ctrl+K.
 *
 * `UI_RULES.md` requires it as a first-class way to reach anything without the mouse.
 * Actions are passed in rather than registered globally, so each surface declares
 * what it can do and nothing appears in the palette that is not actually available
 * on the current screen.
 *
 * The dialog's focus trap, escape handling, and labelling come from Radix via
 * `CommandDialog`; the only thing this adds is the shortcut and the action list.
 */

export type CommandAction = {
  id: string;
  label: string;
  /** Extra words to match on — "billing" finding "Subscription", for instance. */
  keywords?: string[];
  icon?: LucideIcon;
  /** Displayed shortcut hint, e.g. `⌘N`. Purely a hint; bind the key yourself. */
  shortcut?: string;
  group?: string;
  onSelect: () => void;
};

export function CommandPalette({
  actions,
  emptyMessage = 'No matching commands.',
  placeholder = 'Search or jump to…',
  /** Controlled open state. Omit to let the palette own it. */
  open: controlledOpen,
  onOpenChange,
}: {
  actions: CommandAction[];
  emptyMessage?: string;
  placeholder?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // metaKey on macOS, ctrlKey elsewhere. `event.key === 'k'` rather than a
      // keyCode so it still works on non-QWERTY layouts.
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;

      // The browser binds ⌘K to the address bar — take it, since the palette is the
      // in-app equivalent and the user pressed it inside the app.
      event.preventDefault();
      setOpen(!open);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  // Preserve the caller's order within each group rather than sorting alphabetically:
  // the most-used action should be reachable without reading the list.
  const groups = actions.reduce<Map<string, CommandAction[]>>((accumulator, action) => {
    const key = action.group ?? 'Actions';
    accumulator.set(key, [...(accumulator.get(key) ?? []), action]);
    return accumulator;
  }, new Map());

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Search for a command or jump to a page"
    >
      {/* `CommandDialog` supplies the dialog, not the cmdk root — every input, list,
          and item below needs that root's context or it throws on render. */}
      <Command>
        <CommandInput placeholder={placeholder} />

        <CommandList>
          <CommandEmpty>{emptyMessage}</CommandEmpty>

          {[...groups].map(([group, groupActions]) => (
            <CommandGroup key={group} heading={group}>
              {groupActions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={[action.label, ...(action.keywords ?? [])].join(' ')}
                  onSelect={() => {
                    // Close first: leaving the palette open over the destination it
                    // just navigated to is disorientating.
                    setOpen(false);
                    action.onSelect();
                  }}
                >
                  {action.icon ? (
                    <action.icon aria-hidden="true" className="size-4" />
                  ) : null}
                  <span>{action.label}</span>
                  {action.shortcut ? (
                    <CommandShortcut>{action.shortcut}</CommandShortcut>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
