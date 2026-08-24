import { describe, expect, it } from 'vitest';
import {
  adminPageSchema,
  planUpdateSchema,
  subscriptionUpdateSchema,
} from './admin.validators';

describe('admin contracts', () => {
  it('bounds pagination', () => {
    expect(adminPageSchema.parse({ page: '2', limit: '100' })).toEqual({
      page: 2,
      limit: 100,
    });
    expect(adminPageSchema.safeParse({ page: 1, limit: 101 }).success).toBe(false);
  });
  it('requires a version and a real plan change', () => {
    expect(planUpdateSchema.safeParse({ active: false, version: 1 }).success).toBe(true);
    expect(planUpdateSchema.safeParse({ version: 1 }).success).toBe(false);
  });
  it('accepts only closed subscription states', () => {
    expect(
      subscriptionUpdateSchema.safeParse({ status: 'past_due', version: 2 }).success,
    ).toBe(true);
    expect(
      subscriptionUpdateSchema.safeParse({ status: 'suspended', version: 2 }).success,
    ).toBe(false);
  });
});
