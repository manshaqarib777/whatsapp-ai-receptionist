/**
 * Determinism primitives for the seed.
 *
 * DATABASE_RULES.md → Seed Data: "Deterministic — a fixed seed, so screenshots and
 * E2E tests are reproducible."
 *
 * MILESTONE_04_PLAN.md proposed `@faker-js/faker` for this. It is not used, and the
 * reason matters: faker does not guarantee stable output across versions, so a routine
 * dependency bump would silently change every name, every phone number, and every
 * screenshot baseline — breaking exactly the reproducibility the seed exists to
 * provide. A small seeded PRNG over hand-written pools is version-proof and has no
 * dependency to bump.
 */

/** Mulberry32. Small, fast, and stable forever because it is right here. */
export function createRandom(seed: number) {
  let state = seed >>> 0;

  return {
    /** [0, 1) */
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** [min, max] inclusive. */
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick() needs a non-empty list');
      return items[Math.floor(this.next() * items.length)] as T;
    },
    bool(trueChance = 0.5): boolean {
      return this.next() < trueChance;
    },
  };
}

export type Random = ReturnType<typeof createRandom>;

/**
 * The seed's "now".
 *
 * Fixed rather than `new Date()`, so a run in August and a run in December produce
 * identical data. Every other timestamp is an offset from this instant, which is what
 * lets the dashboard show "last 30 days" against stable numbers.
 */
export const SEED_NOW = new Date('2026-08-01T09:00:00.000Z');

export function daysFromNow(days: number, hour = 9, minute = 0): Date {
  const d = new Date(SEED_NOW);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

export function minutesFromNow(minutes: number): Date {
  return new Date(SEED_NOW.getTime() + minutes * 60_000);
}

/**
 * Deterministic UUIDs.
 *
 * Stable ids let E2E tests deep-link to a known conversation rather than scraping one
 * out of a list, and make a failing screenshot diff traceable to a specific row.
 */
export function seedId(namespace: string, n: number): string {
  const hex = [...`${namespace}:${n}`].reduce(
    (acc, ch) => Math.imul(acc ^ ch.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  );
  const a = hex.toString(16).padStart(8, '0');
  const b = (Math.imul(hex, 31) >>> 0).toString(16).padStart(8, '0');
  return `${a}-${b.slice(0, 4)}-4${b.slice(4, 7)}-8${a.slice(0, 3)}-${b}${a.slice(0, 4)}`;
}

// ---------------------------------------------------------------------------
// Synthetic pools. No real people, no real numbers, no real customer text.
// ---------------------------------------------------------------------------

/**
 * `+966 5xx` is the Saudi mobile range, but 0000 0xxx is not an allocated subscriber
 * block — these cannot dial a real handset.
 */
export function syntheticPhone(index: number): string {
  return `+9665000${String(index).padStart(5, '0')}`;
}

export const ARABIC_NAMES = [
  'ليلى العتيبي',
  'محمد الشمري',
  'فاطمة القحطاني',
  'عبدالله الدوسري',
  'نورة الحربي',
] as const;

export const LATIN_NAMES = [
  'Sarah Whitfield',
  'Tom Okafor',
  'Priya Raman',
  'Daniel Brennan',
  'Mei Lin Chow',
  'Omar Haddad',
  'Elena Vasquez',
  'Jonas Weber',
] as const;

export const COMPANY_NAMES = [
  'Northwind Dental',
  'Alrajhi Logistics',
  // Exactly 60 characters — the edge case DATABASE_RULES.md asks for, to prove
  // layouts truncate rather than blow out.
  'Gulf Advanced Orthodontic and Maxillofacial Surgery Centre L',
  'Beacon Auto Care',
] as const;

export const INBOUND_TEXTS = [
  'Hi, do you have any openings this week?',
  'What are your prices for a full service?',
  'Can I move my appointment to Thursday?',
  'Do you take walk-ins on weekends?',
  'Is parking available at the branch?',
  'How long does the treatment usually take?',
  'Do you offer a warranty on the work?',
] as const;

export const OUTBOUND_TEXTS = [
  'Yes, we have Tuesday at 10:00 or Wednesday at 14:30. Which suits you?',
  'A full service starts at 450 SAR and takes about 90 minutes.',
  'Of course — I have moved you to Thursday at 11:00.',
  'We do, though weekends fill up quickly. I would recommend booking ahead.',
  'Yes, there is free parking directly behind the building.',
] as const;

/** The very long message DATABASE_RULES.md asks for — proves wrapping and truncation. */
export const LONG_MESSAGE = [
  'Hello, I wanted to explain my situation in full because I think the detail matters.',
  'I booked an appointment three weeks ago for a full inspection, and at that visit the',
  'technician mentioned that a follow-up would probably be needed once the parts came in.',
  'I have not heard anything since, and I am not sure whether I am supposed to call you',
  'or wait to be contacted. I am generally free on weekday mornings before eleven, and I',
  'can come to either branch, though the one near the airport is considerably easier for',
  'me to reach on public transport. If the parts have not arrived yet that is completely',
  'fine, I would just appreciate knowing roughly how long the wait is likely to be so I',
  'can plan around it. Thank you for your patience with such a long message.',
].join(' ');

export const EMOJI_ONLY_MESSAGE = '🙏🏼✨👍';
