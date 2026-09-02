'use client';

import { Clock } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * Time picker — a select over fixed slots.
 *
 * A free-text time input is a parsing problem ("9", "9pm", "٠٩:٠٠") and a native
 * `<input type="time">` renders differently in every browser and cannot be styled.
 * Appointments are booked on the slot boundaries a business actually offers, so a
 * constrained list is both easier to use and the honest model.
 *
 * The value is always 24-hour `HH:mm` — one canonical form to store and compare.
 * The *display* is localised, so an en-US user sees "9:00 AM" and an ar-SA user sees
 * their own numerals, without the stored value ever changing.
 */

type TimePickerProps = {
  id?: string;
  /** 24-hour `HH:mm`, or undefined for no selection. */
  value: string | undefined;
  onChange: (value: string) => void;
  /** Minutes between slots. 15 by default; 30 and 60 are the other common choices. */
  stepMinutes?: number;
  /** Inclusive lower bound, `HH:mm`. */
  from?: string;
  /** Exclusive upper bound, `HH:mm`. */
  to?: string;
  /** BCP 47 tag. Defaults to the browser's locale. */
  locale?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-invalid'?: true | undefined;
  'aria-describedby'?: string | undefined;
};

function toMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function toTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Formats `HH:mm` for display. Uses a fixed date because only the time matters. */
export function formatTime(time: string, locale?: string): string {
  const [hours = '0', minutes = '0'] = time.split(':');
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes));

  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function buildTimeSlots(from: string, to: string, stepMinutes: number): string[] {
  const start = toMinutes(from);
  const end = toMinutes(to);
  const slots: string[] = [];

  for (let minute = start; minute < end; minute += stepMinutes) {
    slots.push(toTimeString(minute));
  }

  return slots;
}

export function TimePicker({
  id,
  value,
  onChange,
  stepMinutes = 15,
  from = '00:00',
  to = '24:00',
  locale,
  placeholder = 'Pick a time',
  disabled = false,
  className,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: TimePickerProps) {
  const slots = buildTimeSlots(from, to, stepMinutes);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={cn('w-full', className)}
      >
        {/* Icon and value share a flex-1 group so the value sits next to the icon and
            the primitive's chevron still lands at the end. Without it the value floats
            in the middle of the trigger, which no other control in the system does. */}
        <span className="flex flex-1 items-center gap-2">
          <Clock aria-hidden="true" className="size-4 shrink-0 opacity-60" />
          <SelectValue placeholder={placeholder}>
            {value ? formatTime(value, locale) : null}
          </SelectValue>
        </span>
      </SelectTrigger>

      <SelectContent className="max-h-72">
        {slots.map((slot) => (
          <SelectItem key={slot} value={slot}>
            {formatTime(slot, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
