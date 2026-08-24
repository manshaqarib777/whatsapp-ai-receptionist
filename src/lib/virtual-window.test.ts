import { describe, expect, it } from 'vitest';
import { virtualWindow } from '@/lib/virtual-window';

describe('virtual window math', () => {
  it('bounds the visible range with overscan at the start and end', () => {
    expect(
      virtualWindow({ count: 1000, scrollTop: 0, viewportHeight: 440, rowHeight: 88 }),
    ).toEqual({
      start: 0,
      end: 8,
      offset: 0,
      totalHeight: 88000,
    });
    const end = virtualWindow({
      count: 1000,
      scrollTop: 87900,
      viewportHeight: 440,
      rowHeight: 88,
    });
    expect(end.end).toBe(1000);
    expect(end.start).toBeGreaterThan(990);
  });
});
