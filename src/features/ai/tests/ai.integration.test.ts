// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { AiRepository } from '@/features/ai/repositories/ai.repository';
import { AiEngineService } from '@/features/ai/services/ai-engine.service';
import { classifyLocal } from '@/lib/llm-gateway';

/**
 * AI Engine integration tests — real Postgres.
 *
 * The non-negotiable: org A never sees org B's runs or templates. Template
 * lifecycle (create → add version → activate), run recording, and the engine's
 * turn are exercised against the real database.
 */

type Fixture = {
  orgA: string;
  orgB: string;
  branchA: string;
  branchB: string;
};

let f: Fixture;
let suffix = 0;

async function makeOrg(orgLabel: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: orgLabel, slug: `ai-${orgLabel}-${Date.now()}-${suffix}` },
    select: { id: true },
  });
  return org.id;
}

async function makeBranch(
  orgId: string,
  label: string,
  isDefault: boolean,
): Promise<string> {
  suffix += 1;
  const branch = await prisma.branch.create({
    data: {
      organizationId: orgId,
      name: label,
      slug: `ai-${label}-${Date.now()}-${suffix}`,
      timezone: 'Asia/Riyadh',
      isDefault,
    },
    select: { id: true },
  });
  return branch.id;
}

/** Creates a minimal conversation in an org for the engine to run against. */
async function makeConversation(orgId: string, branchId: string): Promise<string> {
  suffix += 1;
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumber: `+9665000${String(Math.floor(Math.random() * 100_000)).padStart(5, '0')}`,
      displayName: `AI Contact ${suffix}`,
      hasConsent: true,
    },
    select: { id: true },
  });
  const wa = await prisma.whatsappAccount.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumberId: `ai-pnid-${Date.now()}-${suffix}`,
      wabaId: 'ai-waba',
      displayPhoneNumber: '+966500000000',
      accessTokenRef: 'secret://ai',
    },
    select: { id: true },
  });
  const conversation = await prisma.conversation.create({
    data: {
      organizationId: orgId,
      branchId,
      contactId: contact.id,
      whatsappAccountId: wa.id,
      status: 'open',
      unreadCount: 1,
      lastMessageAt: new Date(),
    },
    select: { id: true },
  });
  await prisma.message.create({
    data: {
      organizationId: orgId,
      conversationId: conversation.id,
      direction: 'inbound',
      authorType: 'contact',
      contentType: 'text',
      body: 'Do you have any appointments tomorrow?',
      createdAt: new Date(),
    },
  });
  return conversation.id;
}

function repoFor(orgId: string): AiRepository {
  return AiRepository.forOrganization(orgId);
}

beforeEach(async () => {
  const orgA = await makeOrg('A');
  const orgB = await makeOrg('B');
  f = {
    orgA,
    orgB,
    branchA: await makeBranch(orgA, 'Main', true),
    branchB: await makeBranch(orgB, 'Main', true),
  };
});

afterEach(async () => {
  const orgIds = [f.orgA, f.orgB];
  for (const orgId of orgIds) {
    await prisma.aiRunCitation.deleteMany({ where: { organizationId: orgId } });
    await prisma.aiRun.deleteMany({ where: { organizationId: orgId } });
    await prisma.promptTemplateVersion.deleteMany({ where: { organizationId: orgId } });
    await prisma.promptTemplate.deleteMany({ where: { organizationId: orgId } });
    await prisma.message.deleteMany({ where: { organizationId: orgId } });
    await prisma.conversation.deleteMany({ where: { organizationId: orgId } });
    await prisma.whatsappAccount.deleteMany({ where: { organizationId: orgId } });
    await prisma.contact.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('prompt templates (AD-6)', () => {
  it('creates a template with its first draft version', async () => {
    const repo = repoFor(f.orgA);
    const result = await repo.createTemplate({
      key: 'receptionist.faq',
      name: 'FAQ',
      body: 'You are the receptionist.',
      branchId: f.branchA,
    });

    const template = await repo.getTemplate(result.id);
    expect(template.versions).toHaveLength(1);
    expect(template.versions[0]?.status).toBe('draft');
  });

  it('activates a version and sets currentVersionId', async () => {
    const repo = repoFor(f.orgA);
    const created = await repo.createTemplate({
      key: 'receptionist.booking',
      name: 'Booking',
      body: 'Help the customer book.',
      branchId: f.branchA,
    });
    const added = await repo.addVersion(created.id, 'v2 body');
    expect(added.versionNumber).toBe(2);

    await repo.activateVersion(created.id, added.versionId);

    const template = await repo.getTemplate(created.id);
    expect(template.currentVersionId).toBe(added.versionId);
    expect(template.versions.find((v) => v.id === added.versionId)?.status).toBe(
      'active',
    );

    const activeBody = await repo.resolveActiveBody('receptionist.booking');
    expect(activeBody).toBe('v2 body');
  });

  it('org A never sees org B templates', async () => {
    await repoFor(f.orgA).createTemplate({
      key: 'receptionist.faq',
      name: 'A FAQ',
      body: 'A',
      branchId: f.branchA,
    });
    const bTemplates = await repoFor(f.orgB).listTemplates();
    expect(bTemplates).toHaveLength(0);
  });
});

describe('AI runs', () => {
  it('records a run with intent, confidence, outcome, and tokens', async () => {
    const conversationId = await makeConversation(f.orgA, f.branchA);

    const engine = AiEngineService.forOrganization(f.orgA);
    const result = await engine.runTurn({
      conversationId,
      messageText: 'How much does a check-up cost?',
    });

    expect(result.intent.label).toBeTruthy();
    expect(result.outcome).toMatch(/answered|escalated|refused/);
    expect(result.runId).toBeTruthy();

    const run = await repoFor(f.orgA).getRun(result.runId);
    expect(run.conversationId).toBe(conversationId);
    expect(run.intent).toBeTruthy();
    expect(run.inputTokens).toBeGreaterThan(0);
  });

  it('lists runs newest first, org-scoped', async () => {
    const conversationA = await makeConversation(f.orgA, f.branchA);
    const conversationB = await makeConversation(f.orgB, f.branchB);

    await AiEngineService.forOrganization(f.orgA).runTurn({
      conversationId: conversationA,
      messageText: 'What are your opening hours?',
    });

    const aRuns = await repoFor(f.orgA).listRuns();
    const bRuns = await repoFor(f.orgB).listRuns();
    expect(aRuns.length).toBeGreaterThan(0);
    expect(bRuns).toHaveLength(0);

    const scoped = await repoFor(f.orgA).listRuns(conversationA);
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.some((r) => r.conversationId === conversationB)).toBe(false);
  });
});

describe('classifier (AD-2)', () => {
  it('is deterministic and detects booking intent', () => {
    const result = classifyLocal('Can I book an appointment for Saturday?', [
      'booking',
      'faq',
      'general',
    ]);
    expect(result.label).toBe('booking');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('returns general with low confidence for unknown text', () => {
    const result = classifyLocal('hello', ['booking', 'faq', 'general']);
    expect(result.label).toBe('general');
    expect(result.confidence).toBeLessThan(0.5);
  });
});
