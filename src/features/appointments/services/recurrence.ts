/**
 * Recurring appointments — Milestone 9 (AD-4).
 *
 * A supported RFC 5545 RRULE subset: FREQ=WEEKLY|DAILY with COUNT or UNTIL.
 * The parent appointment stores the rule; children link via
 * `recurrenceParentId`. Editing or cancelling one occurrence creates an
 * exception (a child with its own status) rather than materialising every
 * future instance.
 */

export type RecurrenceRule = {
  freq: 'WEEKLY' | 'DAILY';
  interval?: number;
  count?: number;
  until?: string;
};

/** Parses a compact rule string, e.g. "FREQ=WEEKLY;INTERVAL=1;COUNT=4". */
export function parseRecurrenceRule(rule: string): RecurrenceRule {
  const parts = Object.fromEntries(
    rule.split(';').map((part) => {
      const [key, ...rest] = part.split('=');
      return [key, rest.join('=')];
    }),
  );

  const freq = parts['FREQ'] === 'DAILY' ? 'DAILY' : 'WEEKLY';
  return {
    freq,
    interval: parts['INTERVAL'] ? Number(parts['INTERVAL']) : 1,
    count: parts['COUNT'] ? Number(parts['COUNT']) : undefined,
    until: parts['UNTIL'],
  };
}

/** Expands a rule from a start instant, returning occurrence start times. */
export function expandRecurrence(
  rule: RecurrenceRule,
  startsAt: Date,
  limit = 20,
): Date[] {
  const occurrences: Date[] = [];
  const intervalMs = rule.interval ?? 1;
  const stepMs = (rule.freq === 'DAILY' ? 86_400_000 : 7 * 86_400_000) * intervalMs;

  const max = rule.count ?? 10;
  const until = rule.until ? parseUntil(rule.until) : undefined;
  for (let i = 0; i < max && occurrences.length < limit; i += 1) {
    const occurrence = new Date(startsAt.getTime() + i * stepMs);
    if (until && occurrence > until) break;
    occurrences.push(occurrence);
  }

  return occurrences;
}

/**
 * Parses an RFC 5545 UNTIL value — "20260830T000000Z" (basic format) or an
 * ISO-8601 string. `new Date('20260830T000000Z')` is invalid, so the basic
 * format needs explicit handling. A midnight UNTIL bounds the whole day (the
 * codebase convention: the last occurrence on that date is included).
 */
function parseUntil(until: string): Date | undefined {
  const basic = until.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (basic) {
    const [, year, month, day, hour, minute, second] = basic;
    const date = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ),
    );
    if (Number(hour) === 0 && Number(minute) === 0 && Number(second) === 0) {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date;
  }
  const date = new Date(until);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
