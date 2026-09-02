// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  MAX_UPLOAD_BYTES,
  fetchWebsiteText,
  parseUpload,
} from '@/features/knowledge/services/parsers';
import { UnprocessableError } from '@/lib/errors';

// Mock DNS so `example.com` resolves to a public address and the SSRF guard
// passes. vi.mock is hoisted, so this replaces the module before parsers loads.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

/**
 * Parser unit tests (AD-5).
 *
 * CSV and the SSRF guard are pure enough to unit test. PDF/DOCX are exercised via
 * the integration tests (they need real fixtures); here we cover the contract:
 * CSV → tab-separated rows, private-address refusal, size caps.
 */

describe('parseUpload — CSV', () => {
  it('renders CSV rows as tab-separated lines', async () => {
    const result = await parseUpload(
      Buffer.from('name,price\nwidget,10\n'),
      'text/csv',
      'prices.csv',
    );
    expect(result.needsOcr).toBe(false);
    expect(result.text).toBe('name\tprice\nwidget\t10');
  });

  it('handles quoted cells and empty lines', async () => {
    const result = await parseUpload(
      Buffer.from('"a, b",c\n\n"d",e\n'),
      'text/csv',
      'x.csv',
    );
    expect(result.text).toBe('a, b\tc\nd\te');
  });

  it('accepts a .txt file as CSV-shaped text', async () => {
    const result = await parseUpload(
      Buffer.from('plain text'),
      'text/plain',
      'notes.txt',
    );
    expect(result.text).toBe('plain text');
  });

  it('rejects unsupported types', async () => {
    await expect(
      parseUpload(Buffer.from('x'), 'application/zip', 'x.zip'),
    ).rejects.toThrow(UnprocessableError);
  });

  it('rejects files over the upload cap', async () => {
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
    await expect(parseUpload(big, 'text/csv', 'big.csv')).rejects.toThrow(
      'exceeds the 20 MB upload limit',
    );
  });
});

describe('fetchWebsiteText — SSRF guard', () => {
  it('refuses non-http(s) protocols', async () => {
    await expect(fetchWebsiteText('file:///etc/passwd')).rejects.toThrow('Only http(s)');
  });

  it('refuses a loopback host', async () => {
    await expect(fetchWebsiteText('http://127.0.0.1/admin')).rejects.toThrow(
      'private network',
    );
  });

  it('refuses a private-range host', async () => {
    await expect(fetchWebsiteText('http://192.168.1.1/')).rejects.toThrow(
      'private network',
    );
  });

  it('revalidates a redirect target before following it', async () => {
    const request = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } }),
    );
    vi.stubGlobal('fetch', request);

    await expect(fetchWebsiteText('https://example.com/')).rejects.toThrow(
      'private network',
    );
    expect(request).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('extracts readable text and strips markup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const body = new Response(
          '<html><head><script>var x=1;</script></head><body><nav>Menu</nav><h1>Hello</h1><p>World</p></body></html>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        );
        return body;
      }),
    );

    const text = await fetchWebsiteText('https://example.com/');
    expect(text).toContain('Hello');
    expect(text).toContain('World');
    // Scripts and navs are stripped.
    expect(text).not.toContain('var x=1');
    expect(text).not.toContain('Menu');

    vi.unstubAllGlobals();
  });
});
