// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { AiAgentsRepository } from '../repositories/agents.repository';

let organizationId = '';
let otherId = '';
let branchId = '';
let otherBranchId = '';
let agentId = '';

beforeEach(async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  organizationId = (
    await prisma.organization.create({
      data: { name: 'Agent Org', slug: `agent-${suffix}` },
    })
  ).id;
  otherId = (
    await prisma.organization.create({
      data: { name: 'Other Agent Org', slug: `other-agent-${suffix}` },
    })
  ).id;
  branchId = (
    await prisma.branch.create({
      data: { organizationId, name: 'Main', slug: 'main', isDefault: true },
    })
  ).id;
  otherBranchId = (
    await prisma.branch.create({
      data: { organizationId: otherId, name: 'Main', slug: 'main', isDefault: true },
    })
  ).id;
  agentId = (
    await prisma.aiAgent.create({
      data: {
        organizationId,
        branchId,
        kind: 'billing',
        displayName: 'Billing Agent',
        description: 'Billing help.',
      },
    })
  ).id;
  await prisma.aiAgent.create({
    data: {
      organizationId: otherId,
      branchId: otherBranchId,
      kind: 'reception',
      displayName: 'Other Reception',
      description: 'Isolation fixture.',
    },
  });
});

afterEach(async () => {
  await prisma.aiAgent.deleteMany({
    where: { organizationId: { in: [organizationId, otherId] } },
  });
  await prisma.branch.deleteMany({
    where: { organizationId: { in: [organizationId, otherId] } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: [organizationId, otherId] } },
  });
});
afterAll(() => prisma.$disconnect());

describe('AI agent persistence', () => {
  it('lists and updates only the active branch with optimistic concurrency', async () => {
    const repo = new AiAgentsRepository({ organizationId, branchId });
    expect((await repo.list()).map((agent) => agent.kind)).toEqual(['billing']);
    expect(await repo.update(agentId, { enabled: false, version: 1 })).toMatchObject({
      enabled: false,
      version: 2,
    });
    await expect(
      repo.update(agentId, { enabled: true, version: 1 }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('does not expose another tenant agent', async () => {
    expect(
      await new AiAgentsRepository({ organizationId, branchId }).list(),
    ).toHaveLength(1);
    await expect(
      new AiAgentsRepository({ organizationId: otherId, branchId: otherBranchId }).get(
        agentId,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('rejects a prompt template owned by another branch', async () => {
    const template = await prisma.promptTemplate.create({
      data: {
        organizationId: otherId,
        branchId: otherBranchId,
        key: 'other.faq',
        name: 'Other',
      },
    });
    await expect(
      new AiAgentsRepository({ organizationId, branchId }).update(agentId, {
        promptTemplateId: template.id,
        version: 1,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await prisma.promptTemplate.deleteMany({ where: { organizationId: otherId } });
  });
});
