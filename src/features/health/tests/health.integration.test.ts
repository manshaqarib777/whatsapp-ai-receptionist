// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';

import { GET } from '@/app/api/health/route';
import {
  checkDatabase,
  getHealthReport,
} from '@/features/health/services/health.service';
import { prisma } from '@/lib/prisma';
import { CORRELATION_ID_HEADER } from '@/server/api-handler';

/**
 * Integration tests — real Postgres, no mocked repository.
 *
 * Risk 1 in MILESTONE_01_PLAN.md: if the database is unreachable, these must FAIL
 * rather than skip. A skipped integration suite reports green while proving
 * nothing, which is worse than a red build.
 */

afterAll(async () => {
  await prisma.$disconnect();
});

describe('database connectivity', () => {
  it('reaches the database (fails, never skips, when it cannot)', async () => {
    await expect(prisma.$queryRaw`SELECT 1 as one`).resolves.toBeDefined();
  });

  it('round-trips a row through Prisma against real Postgres', async () => {
    const created = await prisma.healthCheck.create({ data: {} });

    const found = await prisma.healthCheck.findUnique({ where: { id: created.id } });

    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.checkedAt).toBeInstanceOf(Date);

    // Each test cleans up after itself — tests are independent and order-agnostic.
    await prisma.healthCheck.delete({ where: { id: created.id } });
  });

  it('applied the initial migration', async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'health_checks'
    `;

    expect(rows).toHaveLength(1);
  });
});

describe('health service', () => {
  it('reports the database as ok when it is reachable', async () => {
    await expect(checkDatabase()).resolves.toBe('ok');
  });

  it('produces a complete health report', async () => {
    const report = await getHealthReport();

    expect(report.status).toBe('ok');
    expect(report.checks.database).toBe('ok');
    expect(report.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(() => new Date(report.timestamp)).not.toThrow();
  });
});

describe('GET /api/health', () => {
  it('returns 200 with the documented envelope', async () => {
    const response = await GET(new Request('http://localhost:3000/api/health'));

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      data: { status: string; checks: { database: string } };
    };

    expect(payload.data.status).toBe('ok');
    expect(payload.data.checks.database).toBe('ok');
  });

  it('returns a correlation id header', async () => {
    const response = await GET(new Request('http://localhost:3000/api/health'));

    expect(response.headers.get(CORRELATION_ID_HEADER)).toBeTruthy();
  });

  it('echoes a caller-supplied correlation id so traces join up', async () => {
    const response = await GET(
      new Request('http://localhost:3000/api/health', {
        headers: { [CORRELATION_ID_HEADER]: 'caller-supplied-id' },
      }),
    );

    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe('caller-supplied-id');
  });

  it('never leaks infrastructure detail in the response body', async () => {
    const response = await GET(new Request('http://localhost:3000/api/health'));
    const body = JSON.stringify(await response.json());

    // Reconnaissance surface: connection strings, credentials, hostnames, versions.
    expect(body).not.toContain('postgresql://');
    expect(body).not.toContain('war_dev_password');
    expect(body).not.toContain('5433');
    expect(body.toLowerCase()).not.toContain('prisma');
    expect(body).not.toContain('stack');
  });
});
