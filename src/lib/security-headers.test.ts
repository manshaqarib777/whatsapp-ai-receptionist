import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '@/lib/security-headers';

describe('strict content security policy', () => {
  it('uses a nonce and strict-dynamic without production unsafe script directives', () => {
    const policy = contentSecurityPolicy('one-time-value', false);
    expect(policy).toContain("script-src 'self' 'nonce-one-time-value' 'strict-dynamic'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).toContain("object-src 'none'");
  });
});
