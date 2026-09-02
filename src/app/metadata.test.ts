import { describe, expect, it, vi } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

vi.mock('next/server', () => ({
  connection: vi.fn(async () => undefined),
}));

describe('production crawler metadata', () => {
  it('keeps private and API surfaces out of search indexes', async () => {
    const rules = (await robots()).rules;
    expect(Array.isArray(rules)).toBe(false);
    if (Array.isArray(rules)) throw new Error('Expected one crawler rule.');
    expect(rules.allow).toBe('/');
    expect(rules.disallow).toContain('/api/');
    expect(rules.disallow).toContain('/inbox/');
    expect(rules.disallow).toContain('/admin/');
  });

  it('publishes only the public root in the sitemap', async () => {
    const entries = await sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toMatch(/^https?:\/\//);
  });
});
