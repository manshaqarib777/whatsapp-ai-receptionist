import { NotFoundError } from '@/lib/errors';
import { forScope } from '@/lib/db/scoped-prisma';
import type { BranchScope, Scope } from '@/lib/db/scope';
import { resolveScope } from '@/server/scope';

import type { WorkflowTriggerKind } from '../services/graph';

/**
 * Workflow data access — Milestone 13.
 *
 * The only layer that touches the database for workflow reads and writes. Every
 * query runs through `forScope(scope)` — the tenant isolation control — with
 * the scope built by `resolveScope` from the session-derived organization id.
 *
 * `Workflow`, `WorkflowVersion`, `WorkflowRun`, and `WorkflowRunStep` are
 * BRANCH-scoped, so writes need a branch scope. The repository holds the
 * org-level scope for reads and derives a branch scope (`writeScope`) for
 * writes.
 *
 * Scoped-model rule: never `findUnique` on a scoped model — use `findFirst` +
 * the count-check helpers. Cross-tenant reads/writes are 404, never 403.
 */

export type WorkflowRow = {
  id: string;
  name: string;
  isEnabled: boolean;
  currentVersionId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowVersionRow = {
  id: string;
  versionNumber: number;
  definition: unknown;
  triggerKind: string;
  createdAt: Date;
};

export type WorkflowRunRow = {
  id: string;
  workflowVersionId: string;
  triggerEntityType: string | null;
  triggerEntityId: string | null;
  status: string;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};

export type WorkflowRunStepRow = {
  id: string;
  workflowRunId: string;
  nodeId: string;
  status: string;
  output: unknown;
  scheduledFor: Date | null;
  createdAt: Date;
};

const WORKFLOW_SELECT = {
  id: true,
  name: true,
  isEnabled: true,
  currentVersionId: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class WorkflowsRepository {
  private readonly db: ReturnType<typeof forScope>;
  readonly organizationId: string;

  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.organizationId = scope.organizationId;
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): WorkflowsRepository {
    return new WorkflowsRepository(resolveScope(organizationId));
  }

  private writeScope(branchId: string): ReturnType<typeof forScope> {
    const branchScope: BranchScope = { organizationId: this.organizationId, branchId };
    return forScope(branchScope);
  }

  async resolveDefaultBranch(): Promise<string> {
    const branch = await this.db.branch.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (!branch) throw new NotFoundError('No default branch for this organization.');
    return branch.id;
  }

  // -------------------------------------------------------------------------
  // Workflows
  // -------------------------------------------------------------------------

  async listWorkflows(): Promise<WorkflowRow[]> {
    return this.db.workflow.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: WORKFLOW_SELECT,
    });
  }

  async getWorkflow(id: string): Promise<WorkflowRow> {
    const row = await this.db.workflow.findFirst({
      where: { id, deletedAt: null },
      select: WORKFLOW_SELECT,
    });
    if (!row) throw new NotFoundError('Workflow not found.');
    return row;
  }

  async createWorkflow(input: { branchId: string; name: string }): Promise<WorkflowRow> {
    const db = this.writeScope(input.branchId);
    return db.workflow.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        isEnabled: false,
      },
      select: WORKFLOW_SELECT,
    });
  }

  async updateWorkflow(
    id: string,
    data: { name?: string; isEnabled?: boolean },
  ): Promise<WorkflowRow> {
    await this.getWorkflow(id);
    await this.db.workflow.updateMany({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
        version: { increment: 1 },
      },
    });
    return this.getWorkflow(id);
  }

  // -------------------------------------------------------------------------
  // Versions
  // -------------------------------------------------------------------------

  async listVersions(workflowId: string): Promise<WorkflowVersionRow[]> {
    return this.db.workflowVersion.findMany({
      where: { workflowId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        definition: true,
        triggerKind: true,
        createdAt: true,
      },
    });
  }

  async getVersion(versionId: string): Promise<WorkflowVersionRow> {
    const row = await this.db.workflowVersion.findFirst({
      where: { id: versionId },
      select: {
        id: true,
        versionNumber: true,
        definition: true,
        triggerKind: true,
        createdAt: true,
      },
    });
    if (!row) throw new NotFoundError('Version not found.');
    return row;
  }

  /** Next version number for a workflow — sequential per workflow. */
  async nextVersionNumber(workflowId: string): Promise<number> {
    const last = await this.db.workflowVersion.findFirst({
      where: { workflowId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return (last?.versionNumber ?? 0) + 1;
  }

  async createVersion(input: {
    workflowId: string;
    versionNumber: number;
    definition: unknown;
    triggerKind: WorkflowTriggerKind;
  }): Promise<{ id: string }> {
    const branchId = await this.resolveDefaultBranch();
    const db = this.writeScope(branchId);
    const row = await db.workflowVersion.create({
      data: {
        organizationId: this.organizationId,
        workflowId: input.workflowId,
        versionNumber: input.versionNumber,
        definition: input.definition as never,
        triggerKind: input.triggerKind,
      },
      select: { id: true },
    });
    // Point the workflow at the new current version.
    await this.db.workflow.updateMany({
      where: { id: input.workflowId },
      data: { currentVersionId: row.id, version: { increment: 1 } },
    });
    return row;
  }

  // -------------------------------------------------------------------------
  // Runs
  // -------------------------------------------------------------------------

  async createRun(input: {
    workflowVersionId: string;
    triggerEntityType?: string;
    triggerEntityId?: string;
  }): Promise<{ id: string }> {
    const branchId = await this.resolveDefaultBranch();
    const db = this.writeScope(branchId);
    const row = await db.workflowRun.create({
      data: {
        organizationId: this.organizationId,
        workflowVersionId: input.workflowVersionId,
        triggerEntityType: input.triggerEntityType ?? null,
        triggerEntityId: input.triggerEntityId ?? null,
        status: 'running',
      },
      select: { id: true },
    });
    return row;
  }

  async createRunSteps(
    runId: string,
    steps: {
      nodeId: string;
      status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
      scheduledFor?: Date;
    }[],
  ): Promise<void> {
    const branchId = await this.resolveDefaultBranch();
    const db = this.writeScope(branchId);
    await db.workflowRunStep.createMany({
      data: steps.map((step) => ({
        organizationId: this.organizationId,
        workflowRunId: runId,
        nodeId: step.nodeId,
        status: step.status as never,
        scheduledFor: step.scheduledFor ?? null,
      })),
    });
  }

  async finishRun(
    runId: string,
    status: 'succeeded' | 'failed',
    error?: string,
  ): Promise<void> {
    await this.db.workflowRun.updateMany({
      where: { id: runId },
      data: { status, error: error ?? null, finishedAt: new Date() },
    });
  }

  async listRuns(workflowId: string): Promise<WorkflowRunRow[]> {
    return this.db.workflowRun.findMany({
      where: { workflowVersion: { workflowId } },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        workflowVersionId: true,
        triggerEntityType: true,
        triggerEntityId: true,
        status: true,
        error: true,
        startedAt: true,
        finishedAt: true,
      },
    });
  }

  async getRun(runId: string): Promise<WorkflowRunRow> {
    const row = await this.db.workflowRun.findFirst({
      where: { id: runId },
      select: {
        id: true,
        workflowVersionId: true,
        triggerEntityType: true,
        triggerEntityId: true,
        status: true,
        error: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    if (!row) throw new NotFoundError('Run not found.');
    return row;
  }
}
