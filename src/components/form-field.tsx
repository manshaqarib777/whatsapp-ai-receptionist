'use client';

import { useId, type ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Form field chrome — label, control, hint, error.
 *
 * Every rule in COMPONENT_DESIGN.md §4 that is easy to forget lives here, so a
 * feature gets them by construction rather than by remembering:
 *
 *   - the label is always visible and above the control (never placeholder-as-label,
 *     never a floating label — both vanish exactly when the user needs them)
 *   - `aria-invalid` and `aria-describedby` are wired to the message automatically
 *   - the error slot reserves its height, so revealing an error does not shift the
 *     rest of the form down under the user's cursor
 *   - optional is marked, required is not — one convention, applied everywhere
 *
 * `FormField` takes a render prop so it works with any control (select, textarea,
 * date picker). `TextField` is the common case wired up for you.
 */

export type FieldControlProps = {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
};

type FormFieldProps = {
  label: string;
  /** Guidance shown before the user makes a mistake. Prefer it to a post-hoc error. */
  hint?: ReactNode;
  /** Describes the FIX, not the fault: "Enter a phone number including country code". */
  error?: string | undefined;
  /** Fields are assumed required; optional ones are marked. Never mark both. */
  optional?: boolean;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
};

export function FormField({
  label,
  hint,
  error,
  optional = false,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? (
          <span className="text-muted-foreground ms-1 text-xs font-normal">
            (optional)
          </span>
        ) : null}
      </Label>

      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}

      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}

      {/* Reserved height: revealing an error must not move the layout. */}
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

type TextFieldProps = {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search';
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: ReactNode;
  autoComplete?: string;
  placeholder?: string;
  /** Fields are assumed required; pass `required={false}` to mark one optional. */
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
};

export function TextField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  hint,
  autoComplete,
  placeholder,
  required = true,
  disabled = false,
  autoFocus = false,
  className,
}: TextFieldProps) {
  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      optional={!required}
      className={className}
    >
      {(field) => (
        <Input
          {...field}
          name={name}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      )}
    </FormField>
  );
}
