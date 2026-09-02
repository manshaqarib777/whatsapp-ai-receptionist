import { describe, expect, it } from 'vitest';
import { performanceBudgetViolations } from '@/lib/performance-budget';

describe('performance budgets', () => {
  it('reports oversized JavaScript and CSS assets', () => {
    expect(performanceBudgetViolations([{ path: 'ok.js', bytes: 1000 }])).toEqual([]);
    expect(
      performanceBudgetViolations([
        { path: 'large.js', bytes: 600000 },
        { path: 'large.css', bytes: 200000 },
      ]),
    ).toHaveLength(2);
  });
});
