import { UnprocessableError } from '@/lib/errors';

export function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function localDateInZone(instant: Date, timezone: string): string {
  const parts = dateParts(instant, timezone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function addLocalDays(date: string, days: number): string {
  const { year, month, day } = parseLocalDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function weekdayForLocalDate(date: string): number {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

export function zonedDateTimeToUtc(date: string, time: string, timezone: string): Date {
  if (!isIanaTimezone(timezone)) throw new UnprocessableError('Invalid IANA timezone.');
  const { year, month, day } = parseLocalDate(date);
  const [hour = Number.NaN, minute = Number.NaN] = time.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new UnprocessableError('Invalid local time.');
  }
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let result = desired;

  // Offset at the guessed instant can differ from the target instant at a DST edge.
  // Two passes converge for all IANA transitions without relying on host timezone.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = dateParts(new Date(result), timezone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    result += desired - represented;
  }

  const instant = new Date(result);
  const roundTrip = dateParts(instant, timezone);
  if (
    roundTrip.year !== year ||
    roundTrip.month !== month ||
    roundTrip.day !== day ||
    roundTrip.hour !== hour ||
    roundTrip.minute !== minute
  ) {
    throw new UnprocessableError('The local time does not exist in this timezone.');
  }
  return instant;
}

function dateParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parseLocalDate(date: string) {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = date
    .split('-')
    .map(Number);
  if (![year, month, day].every(Number.isInteger)) {
    throw new UnprocessableError('Invalid local date.');
  }
  return { year, month, day };
}
