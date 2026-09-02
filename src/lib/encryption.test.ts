import { describe, expect, it } from 'vitest';
import { credentialHint, decryptSecret, encryptSecret } from '@/lib/encryption';

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('credential encryption', () => {
  it('round-trips only with the same context and key', () => {
    const encrypted = encryptSecret('sandbox-secret-1234', 'org:provider', KEY);
    expect(encrypted).not.toContain('sandbox-secret');
    expect(decryptSecret(encrypted, 'org:provider', KEY)).toBe('sandbox-secret-1234');
    expect(() => decryptSecret(encrypted, 'other:provider', KEY)).toThrow();
  });

  it('rejects tampering and produces a safe hint', () => {
    const encrypted = encryptSecret('example-9876', 'scope', KEY);
    expect(() => decryptSecret(`${encrypted.slice(0, -1)}A`, 'scope', KEY)).toThrow();
    expect(credentialHint('example-9876')).toBe('••••9876');
  });
});
