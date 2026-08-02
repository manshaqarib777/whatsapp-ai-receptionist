'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Theme switcher: light, dark, or follow the system.
 *
 * Renders a placeholder until mounted. The server cannot know the stored theme, so
 * rendering the resolved icon immediately would produce a hydration mismatch and a
 * visible icon flip.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  /**
   * True only after hydration. The server cannot know the stored theme, so rendering
   * the resolved icon immediately would produce a hydration mismatch and a visible
   * icon flip. useSyncExternalStore expresses "server says false, client says true"
   * directly, without a setState-in-effect cascade.
   */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const;

  const active = options.find((option) => option.value === theme) ?? options[2];
  const ActiveIcon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Theme: ${active.label}`}>
          {mounted ? (
            <ActiveIcon aria-hidden="true" className="size-4" />
          ) : (
            <span aria-hidden="true" className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => setTheme(option.value)}>
            <option.icon aria-hidden="true" className="size-4" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
