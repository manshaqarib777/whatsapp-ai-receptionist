import { describe, expect, it } from 'vitest';
import { tenantCacheKey } from '@/lib/cache';

describe('tenant cache keys', () => {
  it('are stable, namespaced, and do not expose organization ids', () => {
    const first = tenantCacheKey('analytics', 'organization-sensitive-id', '30d');
    expect(first).toBe(tenantCacheKey('analytics', 'organization-sensitive-id', '30d'));
    expect(first).not.toContain('organization-sensitive-id');
    expect(first).not.toBe(tenantCacheKey('analytics', 'other-organization', '30d'));
  });
});
