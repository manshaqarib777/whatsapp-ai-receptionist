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
