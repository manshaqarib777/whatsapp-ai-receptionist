'use client';

import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Date picker — a popover calendar behind a labelled trigger.
 *
 * Formatting goes through `Intl.DateTimeFormat` rather than a hardcoded pattern:
 * `01/08/2026` means August in the UK and January in the US, and the product ships
 * in Arabic (RTL_I18N_RULES.md). A localised long-ish format is unambiguous in every
 * locale we support.
 *
 * The trigger is a real button carrying the field's id and aria wiring, so it can be
 * dropped inside `FormField` and stay labelled and described like any input.
 */

type DatePickerProps = {
  id?: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  /** BCP 47 tag. Defaults to the browser's locale. */
  locale?: string;
  disabled?: boolean;
  /** Days the user may not choose — e.g. the past, for a booking. */
  isDateDisabled?: (date: Date) => boolean;
  className?: string;
  'aria-invalid'?: true | undefined;
  'aria-describedby'?: string | undefined;
};

export function formatDate(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Pick a date',
  locale,
  disabled = false,
  isDateDisabled,
  className,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'w-full justify-start font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon aria-hidden="true" className="size-4" />
          {value ? formatDate(value, locale) : placeholder}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date);
            // Close on choose: leaving it open makes the user hunt for a way out.
            if (date) setOpen(false);
          }}
          disabled={isDateDisabled}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
