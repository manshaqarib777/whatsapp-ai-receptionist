'use client';

import { useId, type ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Labelled form field.
 *
 * Enforces the rules in COMPONENT_DESIGN.md → Forms in one place rather than relying
 * on every screen remembering them:
 *   - the label is always visible and above the field (never placeholder-as-label)
 *   - the error is wired with aria-describedby and aria-invalid
 *   - error text does not shift layout
 *
 * Milestone 1/2 styling. Restyled in Milestone 3 against the design system.
 */

type FormFieldProps = {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: ReactNode;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
};

export function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  hint,
  autoComplete,
  placeholder,
  required = false,
  disabled = false,
  autoFocus = false,
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {!required ? (
          <span className="text-muted-foreground ms-1 text-xs font-normal">
            (optional)
          </span>
        ) : null}
      </Label>

      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(error && 'border-destructive focus-visible:ring-destructive')}
      />

      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}

      {/* Reserved height so revealing an error does not shift the layout. */}
      <p
        id={errorId}
        className={cn('text-destructive min-h-4 text-xs', !error && 'sr-only')}
        role={error ? 'alert' : undefined}
      >
        {error ?? ''}
      </p>
    </div>
  );
}
