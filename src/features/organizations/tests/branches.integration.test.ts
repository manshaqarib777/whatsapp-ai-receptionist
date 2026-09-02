// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AiRepository } from '@/features/ai/repositories/ai.repository';
import { AppointmentsRepository } from '@/features/appointments/repositories/appointments.repository';
import { KnowledgeRepository } from '@/features/knowledge/repositories/knowledge.repository';
import { branchesRepository } from '@/lib/db/auth/branches.repository';
import { prisma } from '@/lib/prisma';

let organizationId = '';
let userId = '';
let sessionId = '';
let branchA = '';
let branchB = '';

beforeEach(async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const user = await prisma.user.create({
    data: {
      name: 'Branch Test',
      email: `branch-${suffix}@test.local`,
      emailVerified: true,
    },
  });
  userId = user.id;
  const organization = await prisma.organization.create({
    data: { name: 'Branch Org', slug: `branch-${suffix}` },
  });
  organizationId = organization.id;
  const first = await prisma.branch.create({
    data: {
      organizationId,
      name: 'Main',
      slug: 'main',
      timezone: 'UTC',
      isDefault: true,
    },
  });
  const second = await prisma.branch.create({
    data: { organizationId, name: 'West', slug: 'west', timezone: 'UTC' },
  });
  branchA = first.id;
  branchB = second.id;
  const session = await prisma.session.create({
    data: {
      token: `branch-${suffix}`,
      userId,
      expiresAt: new Date(Date.now() + 60_000),
      activeOrganizationId: organizationId,
    },
  });
  sessionId = session.id;
});

afterEach(async () => {
  await prisma.promptTemplateVersion.deleteMany({ where: { organizationId } });
  await prisma.promptTemplate.deleteMany({ where: { organizationId } });
  await prisma.knowledgeSource.deleteMany({ where: { organizationId } });
  await prisma.service.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});
afterAll(() => prisma.$disconnect());

describe('active branch sessions', () => {
  it('backfills a missing selection and persists an authorized switch', async () => {
    expect(
      (await branchesRepository.resolveForSession(sessionId, organizationId))?.id,
    ).toBe(branchA);
    expect(
      (await branchesRepository.switchSession(sessionId, organizationId, branchB))?.id,
    ).toBe(branchB);
    expect(
      (await prisma.session.findFirst({ where: { id: sessionId } }))?.activeBranchId,
    ).toBe(branchB);
  });

  it('rejects a branch from another organization', async () => {
    const other = await prisma.organization.create({
      data: { name: 'Other', slug: `other-${Date.now()}-${Math.random()}` },
    });
    const foreign = await prisma.branch.create({
      data: { organizationId: other.id, name: 'Main', slug: 'main', isDefault: true },
    });
    expect(
      await branchesRepository.switchSession(sessionId, organizationId, foreign.id),
    ).toBeNull();
    await prisma.organization.delete({ where: { id: other.id } });
  });

  it('isolates appointments, knowledge, and AI within one organization', async () => {
    const scopeA = { organizationId, branchId: branchA };
    const scopeB = { organizationId, branchId: branchB };
    await AppointmentsRepository.forScope(scopeA).createService({
      branchId: branchA,
      name: 'A service',
      durationMinutes: 30,
      priceAmount: 10,
    });
    await KnowledgeRepository.forScope(scopeA).createSource({
      branchId: branchA,
      kind: 'faq',
      name: 'A knowledge',
    });
    await AiRepository.forScope(scopeA).createTemplate({
      branchId: branchA,
      key: 'branch.a',
      name: 'A prompt',
      body: 'Answer for A.',
    });
    expect(await AppointmentsRepository.forScope(scopeB).listServices()).toHaveLength(0);
    expect(await KnowledgeRepository.forScope(scopeB).listSources()).toHaveLength(0);
    expect(await AiRepository.forScope(scopeB).listTemplates()).toHaveLength(0);
  });
});
