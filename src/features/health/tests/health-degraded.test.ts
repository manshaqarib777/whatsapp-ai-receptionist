// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/health/route';
import {
  checkDatabase,
  getHealthReport,
} from '@/features/health/services/health.service';
import { prisma } from '@/lib/prisma';
import { CORRELATION_ID_HEADER } from '@/server/api-handler';

/**
 * Failure-path coverage for the health check.
 *
 * MILESTONE_01_PLAN.md commits to proving that an unreachable database produces a
 * 503 with the documented envelope and no leaked internals. The happy path is
 * covered against real Postgres in health.integration.test.ts; this file forces
 * the failure branch, which cannot be exercised by simply stopping the container
 * mid-suite.
 *
 * Imports are static and deliberately NOT combined with vi.resetModules(): a
 * module reset gives the service a fresh `prisma` instance, so the spy would be
 * installed on an object the code under test no longer uses — and every
 * assertion would silently pass against the real database instead.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function mockDatabaseFailure(message: string): void {
  vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error(message) as never);
}

describe('health check when the database is unreachable', () => {
  it('reports the database as error rather than throwing', async () => {
    mockDatabaseFailure('connect ECONNREFUSED 127.0.0.1:5433');

    await expect(checkDatabase()).resolves.toBe('error');
  });

  it('marks the overall report degraded', async () => {
    mockDatabaseFailure('connection refused');

    const report = await getHealthReport();

    expect(report.status).toBe('degraded');
    expect(report.checks.database).toBe('error');
  });

  it('returns 503 with the documented error envelope', async () => {
    mockDatabaseFailure('connection refused');

    const response = await GET(new Request('http://localhost:3000/api/health'));

    expect(response.status).toBe(503);

    const payload = (await response.json()) as {
      error: { code: string; message: string; details: Array<{ path: string }> };
    };

    expect(payload.error.code).toBe('UNHEALTHY');
    expect(payload.error.message).toBe('One or more dependencies are unavailable.');
    expect(payload.error.details[0]?.path).toBe('checks.database');
  });

  it('leaks no connection string, credential, or stack trace in the 503 body', async () => {
    mockDatabaseFailure(
      'connect ECONNREFUSED postgresql://war_dev:war_dev_password@localhost:5433/war_dev',
    );

    const response = await GET(new Request('http://localhost:3000/api/health'));
    const body = JSON.stringify(await response.json());

    expect(body).not.toContain('postgresql://');
    expect(body).not.toContain('war_dev_password');
    expect(body).not.toContain('ECONNREFUSED');
    expect(body).not.toContain('5433');
    expect(body).not.toContain('stack');
  });

  it('still returns a correlation id when unhealthy', async () => {
    mockDatabaseFailure('connection refused');

    const response = await GET(
      new Request('http://localhost:3000/api/health', {
        headers: { [CORRELATION_ID_HEADER]: 'trace-unhealthy' },
      }),
    );

    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe('trace-unhealthy');
  });

  it('does not hang when the database never responds', async () => {
    // A probe that never returns is worse than one that fails: the service races
    // the query against a 2s timeout.
    vi.spyOn(prisma, '$queryRaw').mockImplementation(
      () => new Promise(() => {}) as never,
    );

    await expect(checkDatabase()).resolves.toBe('error');
  }, 10_000);
});
