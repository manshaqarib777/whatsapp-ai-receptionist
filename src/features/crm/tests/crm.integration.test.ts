// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { CrmRepository } from '@/features/crm/repositories/crm.repository';
import { CrmService } from '@/features/crm/services/crm.service';
import {
  applyAction,
  evaluateRules,
  DEFAULT_RULES,
  type CrmAutomationRules,
} from '@/features/crm/services/automation';
import { ConflictError } from '@/lib/errors';

/**
 * CRM integration tests — real Postgres.
 *
 * The non-negotiable: org A never sees org B's deals/companies/tasks. Deal
 * lifecycle writes activities to the timeline, tag assignment is idempotent,
 * and automation rules apply once.
 */

type Fixture = {
  orgA: string;
  orgB: string;
  branchA: string;
  stageIds: string[];
  pipelineId: string;
};

let f: Fixture;
let suffix = 0;

async function makeOrg(label: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: label, slug: `crm-${label}-${Date.now()}-${suffix}` },
    select: { id: true },
  });
  return org.id;
}

async function makeBranch(orgId: string, label: string): Promise<string> {
  suffix += 1;
  const branch = await prisma.branch.create({
    data: {
      organizationId: orgId,
      name: label,
      slug: `crm-${label}-${Date.now()}-${suffix}`,
      timezone: 'Asia/Riyadh',
      isDefault: true,
    },
    select: { id: true },
  });
  return branch.id;
}

async function seedPipeline(orgId: string): Promise<{ pipelineId: string; stageIds: string[] }> {
  const service = CrmService.forOrganization(orgId);
  const pipeline = await service.createPipeline({
    name: 'Sales',
    stages: [
      { name: 'New enquiry', winProbability: 0.1 },
      { name: 'Qualified', winProbability: 0.4 },
      { name: 'Won', winProbability: 1 },
    ],
  });
  return { pipelineId: pipeline.id, stageIds: pipeline.stages.map((s) => s.id) };
}

beforeEach(async () => {
  suffix += 1;
  f = {
    orgA: await makeOrg('A'),
    orgB: await makeOrg('B'),
    branchA: '',
    stageIds: [],
    pipelineId: '',
  };
  f.branchA = await makeBranch(f.orgA, 'Main');
  await makeBranch(f.orgB, 'Main');
  const seeded = await seedPipeline(f.orgA);
  f.pipelineId = seeded.pipelineId;
  f.stageIds = seeded.stageIds;
});

afterEach(async () => {
  const orgIds = [f.orgA, f.orgB];
  for (const orgId of orgIds) {
    await prisma.taggable.deleteMany({ where: { organizationId: orgId } });
    await prisma.activity.deleteMany({ where: { organizationId: orgId } });
    await prisma.deal.deleteMany({ where: { organizationId: orgId } });
    await prisma.task.deleteMany({ where: { organizationId: orgId } });
    await prisma.tag.deleteMany({ where: { organizationId: orgId } });
    await prisma.company.deleteMany({ where: { organizationId: orgId } });
    await prisma.pipelineStage.deleteMany({ where: { organizationId: orgId } });
    await prisma.pipeline.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('pipelines (AD-1/AD-2)', () => {
  it('creates a pipeline with ordered stages', async () => {
    const service = CrmService.forOrganization(f.orgA);
    const pipelines = await service.listPipelines();

    expect(pipelines).toHaveLength(1);
    const [pipeline] = pipelines as [typeof pipelines[number]];
    expect(pipeline?.stages.map((s) => s.name)).toEqual([
      'New enquiry',
      'Qualified',
      'Won',
    ]);
  });
});

describe('deal lifecycle (AD-2/AD-3)', () => {
  it('creates a deal and records a timeline activity', async () => {
    const service = CrmService.forOrganization(f.orgA);
    const deal = await service.createDeal({
      title: 'Root canal case',
      stageId: f.stageIds[0] as string,
      valueAmount: 1_450,
    });

    expect(deal.status).toBe('open');
    expect(deal.stageName).toBe('New enquiry');

    const activities = await service.listActivities('deal', deal.id);
    expect(activities.some((a) => a.kind === 'note')).toBe(true);
  });

  it('moves a deal between stages and records a stage_change', async () => {
    const service = CrmService.forOrganization(f.orgA);
    const deal = await service.createDeal({
      title: 'Quote follow-up',
      stageId: f.stageIds[0] as string,
    });

    const moved = await service.moveDealToStage(deal.id, f.stageIds[1] as string);
    expect(moved.stageName).toBe('Qualified');

    const activities = await service.listActivities('deal', deal.id);
    expect(activities.some((a) => a.kind === 'stage_change')).toBe(true);
  });

  it('closes a deal and refuses to move a closed deal', async () => {
    const service = CrmService.forOrganization(f.orgA);
    const deal = await service.createDeal({
      title: 'Won case',
      stageId: f.stageIds[0] as string,
    });

    const won = await service.closeDeal(deal.id, 'won');
    expect(won.status).toBe('won');
    expect(won.closedAt).not.toBeNull();

    await expect(service.moveDealToStage(deal.id, f.stageIds[1] as string)).rejects.toThrow(
      ConflictError,
    );
  });

  it('refuses to close an already-closed deal', async () => {
    const service = CrmService.forOrganization(f.orgA);
    const deal = await service.createDeal({
      title: 'Lost case',
      stageId: f.stageIds[0] as string,
    });

    await service.closeDeal(deal.id, 'lost');
    await expect(service.closeDeal(deal.id, 'won')).rejects.toThrow(ConflictError);
  });
});

describe('tags (AD-4)', () => {
  it('tagging is idempotent', async () => {
    const service = CrmService.forOrganization(f.orgA);
    const deal = await service.createDeal({
      title: 'Tagged deal',
      stageId: f.stageIds[0] as string,
    });
    const tag = await service.createTag({ name: 'VIP', color: 'warning' });

    await service.assignTag(tag.id, 'deal', deal.id);
    await service.assignTag(tag.id, 'deal', deal.id);

    const tags = await prisma.taggable.count({
      where: { tagId: tag.id, taggableId: deal.id },
    });
    expect(tags).toBe(1);
  });

  it('removes a tag', async () => {
    const service = CrmService.forOrganization(f.orgA);
    const deal = await service.createDeal({
      title: 'Untag me',
      stageId: f.stageIds[0] as string,
    });
    const tag = await service.createTag({ name: 'Temp', color: 'info' });

    await service.assignTag(tag.id, 'deal', deal.id);
    await service.removeTag(tag.id, 'deal', deal.id);

    const tags = await prisma.taggable.count({
      where: { tagId: tag.id, taggableId: deal.id },
    });
    expect(tags).toBe(0);
  });
});

describe('tasks (AD-6)', () => {
  it('creates and completes a task', async () => {
    const service = CrmService.forOrganization(f.orgA);
    const task = await service.createTask({
      title: 'Call the client',
      description: 'Discuss the quote',
    });

    expect(task.status).toBe('open');

    const done = await service.updateTaskStatus(task.id, 'done');
    expect(done.status).toBe('done');
  });
});

describe('automation (AD-5)', () => {
  it('applies a tag rule exactly once (idempotency marker)', async () => {
    const service = CrmService.forOrganization(f.orgA);
    const repo = CrmRepository.forOrganization(f.orgA);
    const rules: CrmAutomationRules = {
      ...DEFAULT_RULES,
      autoAssignNewDealTo: null,
      highValueDealThreshold: 1_000,
      highValueDealTagName: 'High value',
      companyDefaultTagName: '',
    };

    const deal = await service.createDeal({
      title: 'Big deal',
      stageId: f.stageIds[0] as string,
      valueAmount: 50_000,
    });

    const actions = evaluateRules({ type: 'deal.created', deal }, rules);
    await applyAction(service, repo, actions[0] as { kind: 'tag'; taggableType: 'deal'; taggableId: string; tagName: string });

    const tags = await prisma.taggable.count({
      where: { taggableType: 'deal', taggableId: deal.id },
    });
    expect(tags).toBe(1);

    // Re-running the same action must not double-apply.
    await applyAction(service, repo, actions[0] as { kind: 'tag'; taggableType: 'deal'; taggableId: string; tagName: string });
    const tagsAfter = await prisma.taggable.count({
      where: { taggableType: 'deal', taggableId: deal.id },
    });
    expect(tagsAfter).toBe(1);
  });
});

describe('org isolation (the non-negotiable)', () => {
  it('org A never sees org B deals, companies, or tasks', async () => {
    const a = CrmService.forOrganization(f.orgA);
    const b = CrmService.forOrganization(f.orgB);

    // Org A creates a deal + company + task.
    await a.createDeal({ title: 'Org A deal', stageId: f.stageIds[0] as string });
    await a.createCompany({ name: 'Org A company' });
    await a.createTask({ title: 'Org A task' });

    // Org B creates its own.
    const bPipeline = await b.createPipeline({
      name: 'Org B pipeline',
      stages: [{ name: 'First' }, { name: 'Second' }],
    });
    await b.createDeal({
      title: 'Org B deal',
      stageId: bPipeline.stages[0]?.id ?? '',
    });

    // Org B's view never includes org A's rows.
    const bDeals = await b.listDeals();
    expect(bDeals.some((d) => d.title === 'Org A deal')).toBe(false);
    expect(bDeals.some((d) => d.title === 'Org B deal')).toBe(true);

    const bCompanies = await b.listCompanies();
    expect(bCompanies.some((c) => c.name === 'Org A company')).toBe(false);

    const bTasks = await b.listTasks();
    expect(bTasks.some((t) => t.title === 'Org A task')).toBe(false);
  });
});
