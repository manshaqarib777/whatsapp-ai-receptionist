import { describe, expect, it } from 'vitest';

import { greetingForHour } from '@/features/dashboard/lib/greeting';

describe('greetingForHour', () => {
  it('greets mornings before noon', () => {
    expect(greetingForHour(0)).toBe('Good morning');
    expect(greetingForHour(8)).toBe('Good morning');
    expect(greetingForHour(11)).toBe('Good morning');
  });

  it('greets afternoons from noon to before 5pm', () => {
    expect(greetingForHour(12)).toBe('Good afternoon');
    expect(greetingForHour(16)).toBe('Good afternoon');
  });

  it('greets evenings from 5pm on', () => {
    expect(greetingForHour(17)).toBe('Good evening');
    expect(greetingForHour(23)).toBe('Good evening');
  });
});
