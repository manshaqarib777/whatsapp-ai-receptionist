// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { IntegrationsRepository } from '@/lib/db/integrations.repository';

let orgA = '';
let orgB = '';
beforeEach(async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  orgA = (
    await prisma.organization.create({
      data: { name: 'Integration A', slug: `integration-a-${suffix}` },
    })
  ).id;
  orgB = (
    await prisma.organization.create({
      data: { name: 'Integration B', slug: `integration-b-${suffix}` },
    })
  ).id;
});
afterEach(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
});
afterAll(() => prisma.$disconnect());

describe('integration persistence', () => {
  it('creates, tests, disconnects, and restores one provider', async () => {
    const repo = new IntegrationsRepository({ organizationId: orgA, branchId: null });
    const created = await repo.save('google', {
      enabled: true,
      mode: 'sandbox',
      config: { calendarId: 'demo@test.local' },
    });
    expect(created?.status).toBe('disconnected');
    expect(
      (
        await repo.recordTest('google', {
          status: 'connected',
          testedAt: new Date(),
          error: null,
        })
      )?.status,
    ).toBe('connected');
    await repo.disconnect('google');
    expect(await repo.list()).toHaveLength(0);
    expect(
      await repo.save('google', {
        enabled: true,
        mode: 'sandbox',
        config: { calendarId: 'restored@test.local' },
        version: 3,
      }),
    ).not.toBeNull();
  });
  it('enforces optimistic versions', async () => {
    const repo = new IntegrationsRepository({ organizationId: orgA, branchId: null });
    const created = await repo.save('slack', {
      enabled: true,
      mode: 'sandbox',
      config: { channelId: 'C-DEMO' },
    });
    expect(
      await repo.save('slack', {
        enabled: false,
        mode: 'sandbox',
        config: { channelId: 'C-DEMO' },
        version: (created?.version ?? 1) + 1,
      }),
    ).toBeNull();
  });
  it('never exposes another organization connection', async () => {
    const a = new IntegrationsRepository({ organizationId: orgA, branchId: null });
    const b = new IntegrationsRepository({ organizationId: orgB, branchId: null });
    await a.save('stripe', {
      enabled: true,
      mode: 'sandbox',
      config: { accountId: 'acct_a' },
    });
    expect(await b.list()).toHaveLength(0);
    expect(await b.find('stripe')).toBeNull();
  });
});
