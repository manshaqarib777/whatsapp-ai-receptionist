// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { adminRepository } from '@/lib/db/admin.repository';

let organizationId = '';
let branchId = '';
let planId = '';
let subscriptionId = '';
beforeEach(async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  organizationId = (
    await prisma.organization.create({
      data: { name: 'Admin Fixture', slug: `admin-${suffix}` },
    })
  ).id;
  branchId = (
    await prisma.branch.create({
      data: { organizationId, name: 'Main', slug: 'main', isDefault: true },
    })
  ).id;
  planId = (
    await prisma.plan.create({
      data: {
        slug: `fixture-${suffix}`,
        name: 'Fixture',
        description: 'Fixture plan.',
        amount: 10,
        currency: 'USD',
        interval: 'month',
      },
    })
  ).id;
  subscriptionId = (
    await prisma.subscription.create({
      data: {
        organizationId,
        planId,
        status: 'active',
        amount: 10,
        currency: 'USD',
        interval: 'month',
        periodStartsAt: new Date(),
        periodEndsAt: new Date(Date.now() + 86_400_000),
      },
    })
  ).id;
  await prisma.aiRun.create({
    data: {
      organizationId,
      branchId,
      model: 'local/rule',
      intent: 'general',
      latencyMs: 12,
      outcome: 'answered',
      inputTokens: 10,
      outputTokens: 5,
    },
  });
  await prisma.auditLog.create({
    data: {
      organizationId,
      action: 'fixture.event',
      metadata: { email: 'must-not-leak@example.test', token: 'must-not-leak' },
    },
  });
});
afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { organizationId } });
  await prisma.aiRun.deleteMany({ where: { organizationId } });
  await prisma.subscription.deleteMany({ where: { organizationId } });
  await prisma.plan.deleteMany({ where: { id: planId } });
  await prisma.branch.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
});
afterAll(() => prisma.$disconnect());

describe('platform admin repository', () => {
  it('returns bounded PII-minimized global views', async () => {
    const tenants = await adminRepository.tenants({ page: 1, limit: 100 });
    expect(tenants.items.find((item) => item.id === organizationId)).toMatchObject({
      members: 0,
      branches: 1,
    });
    const logs = await adminRepository.logs({ page: 1, limit: 100 });
    const event = logs.items.find((item) => item.organizationId === organizationId);
    expect(event).toBeDefined();
    expect(event).not.toHaveProperty('metadata');
    expect(JSON.stringify(event)).not.toContain('must-not-leak');
    expect(
      (await adminRepository.aiUsage()).find(
        (item) => item.organizationId === organizationId,
      ),
    ).toMatchObject({ runs: 1, inputTokens: 10, outputTokens: 5 });
  });
  it('uses optimistic concurrency for commercial changes', async () => {
    expect(
      await adminRepository.updatePlan(planId, { active: false, version: 1 }),
    ).toMatchObject({ active: false, version: 2 });
    await expect(
      adminRepository.updatePlan(planId, { active: true, version: 1 }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(
      await adminRepository.updateSubscription(subscriptionId, {
        cancelAtPeriodEnd: true,
        version: 1,
      }),
    ).toMatchObject({ cancelAtPeriodEnd: true, version: 2, organizationId });
  });
  it('reports analytics and live monitoring without customer content', async () => {
    expect(await adminRepository.analytics()).toHaveProperty('conversations');
    expect(await adminRepository.monitoring()).toMatchObject({
      status: 'operational',
      queues: expect.any(Object),
    });
  });
});
