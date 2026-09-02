import { describe, expect, it } from 'vitest';

import { createBranchSchema, switchBranchSchema } from './branches.validators';

describe('branch validators', () => {
  it('accepts a named branch with an IANA timezone', () => {
    expect(createBranchSchema.parse({ name: 'Jeddah', timezone: 'Asia/Riyadh' })).toEqual(
      {
        name: 'Jeddah',
        timezone: 'Asia/Riyadh',
      },
    );
  });

  it('rejects invented timezones and client-supplied tenancy fields', () => {
    expect(() =>
      createBranchSchema.parse({ name: 'West', timezone: 'Moon/Base' }),
    ).toThrow();
    expect(() =>
      createBranchSchema.parse({
        name: 'West',
        timezone: 'UTC',
        organizationId: crypto.randomUUID(),
      }),
    ).toThrow();
  });

  it('requires a UUID for the selected branch', () => {
    expect(() => switchBranchSchema.parse({ branchId: 'main' })).toThrow();
  });
});
