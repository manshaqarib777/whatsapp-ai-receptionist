import type { PrismaClient } from '@prisma/client';

import { SEED_NOW, seedId } from './support';
import type { SeededTenants } from './tenants';

/**
 * Workflows (Milestone 13).
 *
 * Two workflows for Northwind Dental: one enabled with a saved version (a
 * manual test run against it is visible in run history), one draft with no
 * version yet — so the list shows both lifecycle states.
 */

export type SeededWorkflows = Awaited<ReturnType<typeof seedWorkflows>>;

export async function seedWorkflows(
  prisma: PrismaClient,
  tenants: SeededTenants,
): Promise<{ workflowIds: string[]; runIds: string[] }> {
  const workflowIds: string[] = [];
  const runIds: string[] = [];

  // Enabled workflow: trigger → send message action, versioned + run once.
  const welcome = await prisma.workflow.create({
    data: {
      id: seedId('workflow', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      name: 'Welcome message',
      isEnabled: true,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });
  workflowIds.push(welcome.id);

  const version = await prisma.workflowVersion.create({
    data: {
      id: seedId('workflow-version', 1),
      organizationId: tenants.northwind.id,
      workflowId: welcome.id,
      versionNumber: 1,
      triggerKind: 'new_contact',
      definition: {
        nodes: [
          { id: 'trigger-1', type: 'trigger', config: {} },
          {
            id: 'action-1',
            type: 'action',
            actionKind: 'send_message',
            config: { text: 'Welcome to Northwind Dental!' },
          },
        ],
        edges: [{ id: 'edge-1', from: 'trigger-1', to: 'action-1' }],
        variables: [],
      },
      createdAt: SEED_NOW,
    },
    select: { id: true },
  });

  await prisma.workflow.update({
    where: { id: welcome.id },
    data: { currentVersionId: version.id },
  });

  const run = await prisma.workflowRun.create({
    data: {
      id: seedId('workflow-run', 1),
      organizationId: tenants.northwind.id,
      workflowVersionId: version.id,
      triggerEntityType: 'contact',
      status: 'succeeded',
      startedAt: SEED_NOW,
      finishedAt: SEED_NOW,
    },
    select: { id: true },
  });
  runIds.push(run.id);

  await prisma.workflowRunStep.create({
    data: {
      id: seedId('workflow-run-step', 1),
      organizationId: tenants.northwind.id,
      workflowRunId: run.id,
      nodeId: 'trigger-1',
      status: 'succeeded',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  await prisma.workflowRunStep.create({
    data: {
      id: seedId('workflow-run-step', 2),
      organizationId: tenants.northwind.id,
      workflowRunId: run.id,
      nodeId: 'action-1',
      status: 'succeeded',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  // Draft workflow: no version yet.
  const draft = await prisma.workflow.create({
    data: {
      id: seedId('workflow', 2),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      name: 'High-value follow-up',
      isEnabled: false,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });
  workflowIds.push(draft.id);

  return { workflowIds, runIds };
}
