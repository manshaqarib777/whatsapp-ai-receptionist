import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { TimePicker, buildTimeSlots, formatTime } from '@/components/time-picker';

describe('buildTimeSlots', () => {
  it('covers the range at the requested step', () => {
    expect(buildTimeSlots('09:00', '11:00', 30)).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
    ]);
  });

  it('excludes the upper bound, so 09:00–17:00 does not offer 17:00', () => {
    const slots = buildTimeSlots('09:00', '17:00', 60);

    expect(slots.at(-1)).toBe('16:00');
  });

  it('pads to a stable HH:mm, so values sort and compare as strings', () => {
    expect(buildTimeSlots('08:00', '09:00', 15)).toEqual([
      '08:00',
      '08:15',
      '08:30',
      '08:45',
    ]);
  });

  it('covers a full day', () => {
    expect(buildTimeSlots('00:00', '24:00', 60)).toHaveLength(24);
  });
});

describe('formatTime', () => {
  it('formats for a 12-hour locale', () => {
    // Normalised because ICU uses a narrow no-break space before AM/PM.
    expect(formatTime('09:30', 'en-US').replace(/\s/g, ' ')).toBe('9:30 AM');
  });

  it('formats for a 24-hour locale', () => {
    expect(formatTime('21:30', 'en-GB')).toBe('21:30');
  });

  it('does not pad the hour, so the list reads as times rather than codes', () => {
    expect(formatTime('09:30', 'en-GB')).toBe('9:30');
  });

  it('leaves the stored value alone regardless of locale', () => {
    // The point of the component: display is localised, storage is one canonical
    // 24-hour string.
    expect(formatTime('13:00', 'en-US')).not.toBe(formatTime('13:00', 'en-GB'));
  });
});

describe('TimePicker', () => {
  it('shows the placeholder when nothing is chosen', () => {
    render(
      <TimePicker value={undefined} onChange={() => {}} placeholder="Pick a time" />,
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('Pick a time');
  });

  it('displays the selected time in the locale format', () => {
    render(<TimePicker value="09:30" onChange={() => {}} locale="en-GB" />);

    expect(screen.getByRole('combobox')).toHaveTextContent('9:30');
  });

  it('can be disabled', () => {
    render(<TimePicker value="09:30" onChange={() => {}} disabled />);

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <>
        <label htmlFor="time">Appointment time</label>
        <TimePicker id="time" value="09:30" onChange={() => {}} />
      </>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
