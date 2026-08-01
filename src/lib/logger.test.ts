import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { REDACTED_PATHS_FOR_TEST } from '@/lib/logger';

/**
 * Redaction is a security control, not a nicety: .claude/SECURITY_RULES.md
 * requires that a careless call site fails safe. These tests prove the configured
 * paths are actually stripped, rather than merely listed.
 */

type Captured = Record<string, unknown>;

function captureLog(payload: Record<string, unknown>): Captured {
  const lines: string[] = [];

  const logger = pino(
    {
      level: 'info',
      redact: { paths: REDACTED_PATHS_FOR_TEST, censor: '[REDACTED]' },
    },
    {
      write(line: string) {
        lines.push(line);
      },
    },
  );

  logger.info(payload, 'test');

  return JSON.parse(lines[0] ?? '{}') as Captured;
}

describe('logger redaction', () => {
  it.each([
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'authorization',
    'cookie',
  ])('redacts %s at the top level', (field) => {
    const output = captureLog({ [field]: 'super-secret-value' });

    expect(output[field]).toBe('[REDACTED]');
    expect(JSON.stringify(output)).not.toContain('super-secret-value');
  });

  it.each(['phone', 'phoneNumber'])('redacts customer PII field %s', (field) => {
    const output = captureLog({ [field]: '+441234567890' });

    expect(output[field]).toBe('[REDACTED]');
    expect(JSON.stringify(output)).not.toContain('441234567890');
  });

  it('redacts message content so customer conversations never reach logs', () => {
    const output = captureLog({
      body: 'I would like to book an appointment for Tuesday',
      message: 'my card number is 4111 1111 1111 1111',
      content: 'private',
    });

    const serialised = JSON.stringify(output);
    expect(serialised).not.toContain('book an appointment');
    expect(serialised).not.toContain('4111');
    expect(serialised).not.toContain('private');
  });

  it('redacts nested credentials one level deep', () => {
    const output = captureLog({ user: { password: 'hunter2', apiKey: 'sk-live-xyz' } });

    const serialised = JSON.stringify(output);
    expect(serialised).not.toContain('hunter2');
    expect(serialised).not.toContain('sk-live-xyz');
  });

  it('redacts request headers carrying credentials', () => {
    const output = captureLog({
      headers: { authorization: 'Bearer abc123', cookie: 'session=xyz789' },
    });

    const serialised = JSON.stringify(output);
    expect(serialised).not.toContain('abc123');
    expect(serialised).not.toContain('xyz789');
  });

  it('leaves non-sensitive diagnostic fields intact', () => {
    const output = captureLog({
      correlationId: 'abc-123',
      route: 'GET /api/health',
      status: 200,
      durationMs: 12,
    });

    expect(output['correlationId']).toBe('abc-123');
    expect(output['route']).toBe('GET /api/health');
    expect(output['status']).toBe(200);
    expect(output['durationMs']).toBe(12);
  });
});
