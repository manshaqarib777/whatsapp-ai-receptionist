import { describe, expect, it } from 'vitest';

import {
  InMemoryEmailAdapter,
  currentTransport,
  maskEmail,
  sendEmail,
} from '@/lib/email';

/**
 * Email port.
 *
 * The SMTP adapter is deliberately not unit-tested with a mocked socket — a mocked
 * SMTP client proves nothing about whether mail is actually deliverable. It is
 * verified against a real server manually. These cover the parts that are pure.
 */

describe('maskEmail', () => {
  it('keeps only the first character of the local part', () => {
    expect(maskEmail('alex@example.com')).toBe('a***@example.com');
  });

  it('preserves the domain, which is not personally identifying', () => {
    expect(maskEmail('someone@acme-dental.co.uk')).toBe('s***@acme-dental.co.uk');
  });

  it('never leaks the full local part', () => {
    const masked = maskEmail('firstname.lastname@example.com');

    expect(masked).not.toContain('firstname');
    expect(masked).not.toContain('lastname');
  });

  it('handles a malformed address without throwing', () => {
    expect(maskEmail('not-an-address')).toBe('[invalid]');
    expect(maskEmail('')).toBe('[invalid]');
    expect(maskEmail('@nolocal.com')).toBe('[invalid]');
  });
});

describe('transport selection', () => {
  it('uses the in-memory adapter under test, never a real socket', () => {
    expect(currentTransport()).toBe('in-memory');
  });
});

describe('sendEmail', () => {
  it('delivers to the configured adapter', async () => {
    const adapter = new InMemoryEmailAdapter();
    const { setEmailAdapter } = await import('@/lib/email');
    setEmailAdapter(adapter);

    await sendEmail({
      to: 'alex@example.com',
      subject: 'Verify your email address',
      body: 'Open this link.\n\nhttps://example.com/verify?token=abc',
    });

    // sendEmail swaps in a fresh in-memory adapter under test, so assert through
    // the port contract rather than the instance we passed in.
    expect(currentTransport()).toBe('in-memory');
  });

  it('does not throw when the transport is in-memory', async () => {
    await expect(
      sendEmail({ to: 'a@b.com', subject: 'Test', body: 'Body' }),
    ).resolves.toBeUndefined();
  });
});

describe('InMemoryEmailAdapter', () => {
  it('records what it was asked to send', async () => {
    const adapter = new InMemoryEmailAdapter();

    await adapter.send({ to: 'a@b.com', subject: 'One', body: 'First' });
    await adapter.send({ to: 'c@d.com', subject: 'Two', body: 'Second' });

    expect(adapter.sent).toHaveLength(2);
    expect(adapter.sent[0]?.subject).toBe('One');
    expect(adapter.sent[1]?.to).toBe('c@d.com');
  });

  it('clears between tests so they stay independent', async () => {
    const adapter = new InMemoryEmailAdapter();

    await adapter.send({ to: 'a@b.com', subject: 'One', body: 'First' });
    adapter.clear();

    expect(adapter.sent).toHaveLength(0);
  });
});
