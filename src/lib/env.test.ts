import { describe, expect, it } from 'vitest';

import { parseEnv } from '@/lib/env';

/**
 * Env validation must fail loudly and name the offending variable — a deployment
 * that boots with half its config is far worse than one that refuses to start.
 */

const validEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5433/db?schema=public',
  LOG_LEVEL: 'info',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  AUTH_SECRET: 'a-test-secret-that-is-at-least-32-characters',
};

describe('parseEnv', () => {
  it('parses a valid configuration', () => {
    const result = parseEnv(validEnv);

    expect(result.NODE_ENV).toBe('test');
    expect(result.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(result.LOG_LEVEL).toBe('info');
  });

  it('applies defaults for optional variables', () => {
    const { NODE_ENV: _node, LOG_LEVEL: _log, ...withoutOptionals } = validEnv;

    const result = parseEnv(withoutOptionals);

    expect(result.NODE_ENV).toBe('development');
    expect(result.LOG_LEVEL).toBe('info');
  });

  it('throws naming the variable when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omitted, ...withoutDatabase } = validEnv;

    expect(() => parseEnv(withoutDatabase)).toThrowError(/DATABASE_URL/);
  });

  it('rejects a DATABASE_URL that is not a postgres connection string', () => {
    expect(() =>
      parseEnv({ ...validEnv, DATABASE_URL: 'mysql://localhost/db' }),
    ).toThrowError(/postgresql:\/\//);
  });

  it('rejects an empty DATABASE_URL', () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: '' })).toThrowError(
      /DATABASE_URL/,
    );
  });

  it('rejects an invalid NEXT_PUBLIC_APP_URL', () => {
    expect(() =>
      parseEnv({ ...validEnv, NEXT_PUBLIC_APP_URL: 'not-a-url' }),
    ).toThrowError(/NEXT_PUBLIC_APP_URL/);
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => parseEnv({ ...validEnv, LOG_LEVEL: 'verbose' })).toThrowError(
      /LOG_LEVEL/,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrowError(/NODE_ENV/);
  });

  it('reports every offending variable at once, not just the first', () => {
    expect(() =>
      parseEnv({ ...validEnv, DATABASE_URL: '', NEXT_PUBLIC_APP_URL: 'nope' }),
    ).toThrowError(/DATABASE_URL[\s\S]*NEXT_PUBLIC_APP_URL/);
  });

  it('points the operator at .env.example', () => {
    expect(() => parseEnv({})).toThrowError(/\.env\.example/);
  });
});

describe('parseEnv — auth configuration (Milestone 2)', () => {
  it('requires AUTH_SECRET', () => {
    const { AUTH_SECRET: _omitted, ...withoutSecret } = validEnv;

    expect(() => parseEnv(withoutSecret)).toThrowError(/AUTH_SECRET/);
  });

  it('rejects a short AUTH_SECRET rather than running with weak signing', () => {
    expect(() => parseEnv({ ...validEnv, AUTH_SECRET: 'too-short' })).toThrowError(
      /at least 32 characters/,
    );
  });

  it('tells the operator how to generate a secret', () => {
    expect(() => parseEnv({ ...validEnv, AUTH_SECRET: 'short' })).toThrowError(
      /openssl rand/,
    );
  });

  it('accepts a secret of exactly the minimum length', () => {
    const secret = 'x'.repeat(32);

    expect(parseEnv({ ...validEnv, AUTH_SECRET: secret }).AUTH_SECRET).toBe(secret);
  });

  it('treats OAuth credentials as optional', () => {
    const parsed = parseEnv(validEnv);

    expect(parsed.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(parsed.GITHUB_CLIENT_ID).toBeUndefined();
  });

  it('accepts OAuth credentials when supplied', () => {
    const parsed = parseEnv({
      ...validEnv,
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
    });

    expect(parsed.GOOGLE_CLIENT_ID).toBe('google-id');
    expect(parsed.GOOGLE_CLIENT_SECRET).toBe('google-secret');
  });

  it('rejects an empty OAuth value, which would otherwise look configured', () => {
    expect(() => parseEnv({ ...validEnv, GOOGLE_CLIENT_ID: '' })).toThrowError(
      /GOOGLE_CLIENT_ID/,
    );
  });

  it('defaults to the console transport', () => {
    expect(parseEnv(validEnv).EMAIL_TRANSPORT).toBe('console');
  });

  it('requires SMTP_HOST when the transport is smtp', () => {
    expect(() => parseEnv({ ...validEnv, EMAIL_TRANSPORT: 'smtp' })).toThrowError(
      /SMTP_HOST is required/,
    );
  });

  it('accepts a complete smtp configuration', () => {
    const parsed = parseEnv({
      ...validEnv,
      EMAIL_TRANSPORT: 'smtp',
      SMTP_HOST: 'smtp.example.com',
    });

    expect(parsed.EMAIL_TRANSPORT).toBe('smtp');
    // 587 (STARTTLS) is the sensible default for nearly every provider.
    expect(parsed.SMTP_PORT).toBe(587);
    expect(parsed.SMTP_SECURE).toBe(false);
  });

  it('coerces SMTP_PORT to a number and rejects an out-of-range one', () => {
    expect(
      parseEnv({ ...validEnv, EMAIL_TRANSPORT: 'smtp', SMTP_HOST: 'h', SMTP_PORT: '587' })
        .SMTP_PORT,
    ).toBe(587);

    expect(() =>
      parseEnv({
        ...validEnv,
        EMAIL_TRANSPORT: 'smtp',
        SMTP_HOST: 'h',
        SMTP_PORT: '99999',
      }),
    ).toThrowError(/SMTP_PORT/);
  });

  it('rejects a half-set credential pair in either direction', () => {
    const base = { ...validEnv, EMAIL_TRANSPORT: 'smtp', SMTP_HOST: 'h' };

    expect(() => parseEnv({ ...base, SMTP_USER: 'u' })).toThrowError(/SMTP_PASSWORD/);
    expect(() => parseEnv({ ...base, SMTP_PASSWORD: 'p' })).toThrowError(/SMTP_USER/);
  });

  it('accepts both credentials together', () => {
    const parsed = parseEnv({
      ...validEnv,
      EMAIL_TRANSPORT: 'smtp',
      SMTP_HOST: 'smtp.resend.com',
      SMTP_USER: 'resend',
      SMTP_PASSWORD: 'secret',
    });

    expect(parsed.SMTP_USER).toBe('resend');
  });

  it('parses SMTP_SECURE as a boolean', () => {
    const base = { ...validEnv, EMAIL_TRANSPORT: 'smtp', SMTP_HOST: 'h' };

    expect(parseEnv({ ...base, SMTP_SECURE: 'true' }).SMTP_SECURE).toBe(true);
    expect(parseEnv({ ...base, SMTP_SECURE: 'false' }).SMTP_SECURE).toBe(false);
  });

  it('REFUSES the console transport in production', () => {
    // Silently writing a password-reset email to a log file in production is worse
    // than refusing to boot.
    expect(() =>
      parseEnv({ ...validEnv, NODE_ENV: 'production', EMAIL_TRANSPORT: 'console' }),
    ).toThrowError(/must be "smtp" in production/);
  });

  it('allows the smtp transport in production', () => {
    const parsed = parseEnv({
      ...validEnv,
      NODE_ENV: 'production',
      EMAIL_TRANSPORT: 'smtp',
      SMTP_HOST: 'smtp.resend.com',
    });

    expect(parsed.EMAIL_TRANSPORT).toBe('smtp');
  });

  it('defaults EMAIL_FROM and rejects a malformed address', () => {
    expect(parseEnv(validEnv).EMAIL_FROM).toContain('@');
    expect(() => parseEnv({ ...validEnv, EMAIL_FROM: 'not-an-address' })).toThrowError(
      /EMAIL_FROM/,
    );
  });
});
