import { NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ConflictError, NotFoundError, RateLimitError } from '@/lib/errors';
import { CORRELATION_ID_HEADER, withApiHandler } from '@/server/api-handler';

/**
 * The handler wrapper is the single place errors become responses. If it leaks a
 * stack trace or drops a correlation id, every route in the application does.
 */

function request(headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/test', { headers });
}

describe('withApiHandler', () => {
  it('passes through a successful response', async () => {
    const handler = withApiHandler('GET /api/test', async () =>
      NextResponse.json({ data: { ok: true } }),
    );

    const response = await handler(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { ok: true } });
  });

  it('generates a correlation id when the caller supplies none', async () => {
    const handler = withApiHandler('GET /api/test', async () =>
      NextResponse.json({ data: null }),
    );

    const response = await handler(request());

    expect(response.headers.get(CORRELATION_ID_HEADER)).toMatch(/[0-9a-f-]{36}/);
  });

  it('preserves a caller-supplied correlation id across the response', async () => {
    const handler = withApiHandler('GET /api/test', async () =>
      NextResponse.json({ data: null }),
    );

    const response = await handler(request({ [CORRELATION_ID_HEADER]: 'trace-abc' }));

    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe('trace-abc');
  });

  it('maps a domain error to its documented status and envelope', async () => {
    const handler = withApiHandler('GET /api/test', async () => {
      throw new NotFoundError('Conversation not found.');
    });

    const response = await handler(request());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Conversation not found.' },
    });
  });

  it('maps a Zod error to a 400 with per-field details', async () => {
    const schema = z.object({ phoneNumber: z.string().min(5) });

    const handler = withApiHandler('POST /api/test', async () => {
      schema.parse({ phoneNumber: 'no' });
      return NextResponse.json({ data: null });
    });

    const response = await handler(request());
    const payload = (await response.json()) as {
      error: { code: string; details: Array<{ path: string }> };
    };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_FAILED');
    expect(payload.error.details[0]?.path).toBe('phoneNumber');
  });

  it('sets Retry-After on a rate limit error', async () => {
    const handler = withApiHandler('GET /api/test', async () => {
      throw new RateLimitError(30);
    });

    const response = await handler(request());

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('converts an unexpected error into a generic 500 without leaking internals', async () => {
    const handler = withApiHandler('GET /api/test', async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:5433 at PrismaClient._request');
    });

    const response = await handler(request());
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(body).toContain('Something went wrong.');
    // The real cause goes to the logs, never to the client.
    expect(body).not.toContain('ECONNREFUSED');
    expect(body).not.toContain('5433');
    expect(body).not.toContain('PrismaClient');
    expect(body).not.toContain('stack');
  });

  it('does not leak a thrown non-Error value', async () => {
    const handler = withApiHandler('GET /api/test', async () => {
      throw 'raw string with secret sk-live-123';
    });

    const response = await handler(request());
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(body).not.toContain('sk-live-123');
  });

  it('keeps the correlation id on an error response', async () => {
    const handler = withApiHandler('GET /api/test', async () => {
      throw new ConflictError();
    });

    const response = await handler(request({ [CORRELATION_ID_HEADER]: 'trace-err' }));

    expect(response.status).toBe(409);
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe('trace-err');
  });
});
