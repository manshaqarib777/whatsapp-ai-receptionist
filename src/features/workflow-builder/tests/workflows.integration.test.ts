// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { WorkflowsService } from '@/features/workflow-builder/services/workflows.service';
import { ConflictError, UnprocessableError } from '@/lib/errors';
import type { WorkflowDefinition } from '@/features/workflow-builder/services/graph';

/**
 * Workflow integration tests — real Postgres.
 *
 * The non-negotiable: org A never sees org B's workflows. Versioned saves
 * (immutable versions, incremented numbers), the enable guard, graph
 * validation refusals, and manual runs (run + step rows, delay scheduling)
 * are exercised against the real database.
 */

type Fixture = { orgA: string; orgB: string; branchA: string; branchB: string };

let f: Fixture;
let suffix = 0;

async function makeOrg(label: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: label, slug: `workflows-${label}-${Date.now()}-${suffix}` },
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
      slug: `workflows-${label}-${Date.now()}-${suffix}`,
      timezone: 'Asia/Riyadh',
      isDefault: true,
    },
    select: { id: true },
  });
  return branch.id;
}

function serviceFor(orgId: string): WorkflowsService {
  return WorkflowsService.forOrganization(orgId);
}

function simpleGraph(): WorkflowDefinition {
  return {
    nodes: [
      { id: 'trigger-1', type: 'trigger', config: {} },
      {
        id: 'action-1',
        type: 'action',
        actionKind: 'send_message',
        config: { text: 'Hi' },
      },
    ],
    edges: [{ id: 'edge-1', from: 'trigger-1', to: 'action-1' }],
    variables: [],
  };
}

beforeEach(async () => {
  suffix += 1;
  const orgA = await makeOrg('A');
  const orgB = await makeOrg('B');
  f = {
    orgA,
    orgB,
    branchA: await makeBranch(orgA, 'main'),
    branchB: await makeBranch(orgB, 'main'),
  };
});

afterEach(async () => {
  for (const orgId of [f.orgA, f.orgB]) {
    await prisma.workflowRunStep.deleteMany({ where: { organizationId: orgId } });
    await prisma.workflowRun.deleteMany({ where: { organizationId: orgId } });
    await prisma.workflowVersion.deleteMany({ where: { organizationId: orgId } });
    await prisma.workflow.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('workflows — CRUD', () => {
  it('creates a workflow with a sequential-ish name and disabled state', async () => {
    const service = serviceFor(f.orgA);
    const workflow = await service.createWorkflow({ name: 'Welcome flow' });

    expect(workflow.name).toBe('Welcome flow');
    expect(workflow.isEnabled).toBe(false);
    expect(workflow.currentVersionId).toBeNull();
  });

  it('lists only this org workflows', async () => {
    await serviceFor(f.orgA).createWorkflow({ name: 'A flow' });
    await serviceFor(f.orgB).createWorkflow({ name: 'B flow' });

    const a = await serviceFor(f.orgA).listWorkflows();
    const b = await serviceFor(f.orgB).listWorkflows();

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0]?.name).toBe('A flow');
    expect(b[0]?.name).toBe('B flow');
  });

  it('404s a missing workflow', async () => {
    await expect(
      serviceFor(f.orgA).getWorkflow('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(/not found/i);
  });
});

describe('workflows — versions', () => {
  it('saves a version and points the workflow at it', async () => {
    const service = serviceFor(f.orgA);
    const workflow = await service.createWorkflow({ name: 'F' });

    const version = await service.saveVersion({
      workflowId: workflow.id,
      definition: simpleGraph(),
      triggerKind: 'manual',
    });

    expect(version.versionNumber).toBe(1);
    const fresh = await service.getWorkflow(workflow.id);
    expect(fresh.currentVersionId).toBe(version.id);
  });

  it('increments version numbers across saves', async () => {
    const service = serviceFor(f.orgA);
    const workflow = await service.createWorkflow({ name: 'F' });

    const v1 = await service.saveVersion({
      workflowId: workflow.id,
      definition: simpleGraph(),
      triggerKind: 'manual',
    });
    const v2 = await service.saveVersion({
      workflowId: workflow.id,
      definition: simpleGraph(),
      triggerKind: 'manual',
    });

    expect(v1.versionNumber).toBe(1);
    expect(v2.versionNumber).toBe(2);
    expect(v1.id).not.toBe(v2.id);
  });

  it('refuses an invalid graph with 409', async () => {
    const service = serviceFor(f.orgA);
    const workflow = await service.createWorkflow({ name: 'F' });

    const invalid: WorkflowDefinition = {
      nodes: [{ id: 'x', type: 'trigger', config: {} }],
      edges: [{ id: 'e', from: 'x', to: 'ghost' }],
      variables: [],
    };

    await expect(
      service.saveVersion({
        workflowId: workflow.id,
        definition: invalid,
        triggerKind: 'manual',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('refuses an unknown trigger kind', async () => {
    const service = serviceFor(f.orgA);
    const workflow = await service.createWorkflow({ name: 'F' });

    await expect(
      service.saveVersion({
        workflowId: workflow.id,
        definition: simpleGraph(),
        triggerKind: 'bogus',
      }),
    ).rejects.toThrow(UnprocessableError);
  });

  it('cannot enable a workflow with no version', async () => {
    const service = serviceFor(f.orgA);
    const workflow = await service.createWorkflow({ name: 'F' });

    await expect(
      service.updateWorkflow(workflow.id, { isEnabled: true }),
    ).rejects.toThrow(ConflictError);
  });

  it('can enable a workflow after a version is saved', async () => {
    const service = serviceFor(f.orgA);
    const workflow = await service.createWorkflow({ name: 'F' });
    await service.saveVersion({
      workflowId: workflow.id,
      definition: simpleGraph(),
      triggerKind: 'manual',
    });

    const enabled = await service.updateWorkflow(workflow.id, { isEnabled: true });
    expect(enabled.isEnabled).toBe(true);
  });
});

describe('workflows — runs', () => {
  it('refuses to run a workflow with no version', async () => {
    const service = serviceFor(f.orgA);
    const workflow = await service.createWorkflow({ name: 'F' });

    await expect(service.createRun({ workflowId: workflow.id })).rejects.toThrow(
      ConflictError,
    );
  });

  it('runs the graph and writes run + step rows', async () => {
    const service = serviceFor(f.orgA);
    const workflow = await service.createWorkflow({ name: 'F' });
    await service.saveVersion({
      workflowId: workflow.id,
      definition: simpleGraph(),
      triggerKind: 'manual',
    });

    const { run, steps } = await service.createRun({ workflowId: workflow.id });

    expect(run.status).toBe('succeeded');
    expect(steps.map((step) => step.nodeId)).toEqual(['trigger-1', 'action-1']);
    expect(steps.every((step) => step.status === 'succeeded')).toBe(true);
  });

  it('marks delay nodes pending with a scheduledFor', async () => {
    const service = serviceFor(f.orgA);
    const workflow = await service.createWorkflow({ name: 'F' });
    const graph: WorkflowDefinition = {
      nodes: [
        { id: 'trigger', type: 'trigger', config: {} },
        { id: 'delay', type: 'delay', config: { delaySeconds: 120 } },
      ],
      edges: [{ id: 'e', from: 'trigger', to: 'delay' }],
      variables: [],
    };
    await service.saveVersion({
      workflowId: workflow.id,
      definition: graph,
      triggerKind: 'manual',
    });

    const { run, steps } = await service.createRun({ workflowId: workflow.id });
    expect(run.status).toBe('succeeded');

    const delayStep = steps.find((step) => step.nodeId === 'delay');
    expect(delayStep?.status).toBe('pending');

    const row = await prisma.workflowRunStep.findFirst({
      where: { workflowRunId: run.id, nodeId: 'delay' },
      select: { scheduledFor: true },
    });
    expect(row?.scheduledFor).not.toBeNull();
  });

  it('org A never sees org B runs', async () => {
    const a = serviceFor(f.orgA);
    const workflow = await a.createWorkflow({ name: 'F' });
    await a.saveVersion({
      workflowId: workflow.id,
      definition: simpleGraph(),
      triggerKind: 'manual',
    });
    await a.createRun({ workflowId: workflow.id });

    const b = serviceFor(f.orgB);
    const bWorkflow = await b.createWorkflow({ name: 'B' });
    const bRuns = await b.listRuns(bWorkflow.id);
    expect(bRuns).toHaveLength(0);
  });
});
