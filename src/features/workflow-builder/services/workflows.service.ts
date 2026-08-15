import { ConflictError, UnprocessableError } from '@/lib/errors';

import {
  WorkflowsRepository,
  type WorkflowRow,
  type WorkflowRunRow,
  type WorkflowVersionRow,
} from '@/features/workflow-builder/repositories/workflows.repository';
import {
  TRIGGER_KINDS,
  validateGraph,
  type WorkflowDefinition,
  type WorkflowTriggerKind,
} from '@/features/workflow-builder/services/graph';

/**
 * Workflow orchestration — Milestone 13.
 *
 * Pure orchestration over the repository: workflow CRUD, versioned saves (an
 * immutable graph per version), enable/disable guards, and manual test runs.
 *
 * The graph is validated by `validateGraph` BEFORE any version row is written —
 * the server is the authority, and an invalid graph is a 409, never a saved
 * half-graph.
 */

export class WorkflowsService {
  private readonly repo: WorkflowsRepository;
  readonly organizationId: string;

  constructor(repo: WorkflowsRepository) {
    this.repo = repo;
    this.organizationId = repo.organizationId;
  }

  static forOrganization(organizationId: string): WorkflowsService {
    return new WorkflowsService(WorkflowsRepository.forOrganization(organizationId));
  }

  // -------------------------------------------------------------------------
  // Workflows
  // -------------------------------------------------------------------------

  async listWorkflows(): Promise<WorkflowRow[]> {
    return this.repo.listWorkflows();
  }

  async getWorkflow(id: string): Promise<WorkflowRow> {
    return this.repo.getWorkflow(id);
  }

  async createWorkflow(input: { name: string }): Promise<WorkflowRow> {
    const branchId = await this.repo.resolveDefaultBranch();
    return this.repo.createWorkflow({ branchId, name: input.name });
  }

  async updateWorkflow(
    id: string,
    input: { name?: string; isEnabled?: boolean },
  ): Promise<WorkflowRow> {
    const workflow = await this.repo.getWorkflow(id);

    // Enabling requires at least one saved version — an empty workflow is not
    // runnable, and enabling it would be a foot-gun.
    if (input.isEnabled === true && !workflow.currentVersionId) {
      throw new ConflictError('Save a version before enabling a workflow.');
    }

    return this.repo.updateWorkflow(id, input);
  }

  // -------------------------------------------------------------------------
  // Versions
  // -------------------------------------------------------------------------

  async listVersions(workflowId: string): Promise<WorkflowVersionRow[]> {
    await this.repo.getWorkflow(workflowId);
    return this.repo.listVersions(workflowId);
  }

  /**
   * Saves a new immutable version of the workflow graph. The definition is
   * validated first; an invalid graph is refused (409) rather than saved.
   */
  async saveVersion(input: {
    workflowId: string;
    definition: unknown;
    triggerKind: string;
  }): Promise<WorkflowVersionRow> {
    const workflow = await this.repo.getWorkflow(input.workflowId);

    if (!TRIGGER_KINDS.includes(input.triggerKind as WorkflowTriggerKind)) {
      throw new UnprocessableError('Unknown trigger kind.');
    }

    const result = validateGraph(input.definition);
    if (!result.ok) {
      throw new ConflictError(
        `The workflow graph is invalid: ${result.problems
          .map((problem) => `${problem.path}: ${problem.message}`)
          .join('; ')}`,
      );
    }

    const versionNumber = await this.repo.nextVersionNumber(input.workflowId);
    const { id } = await this.repo.createVersion({
      workflowId: input.workflowId,
      versionNumber,
      definition: result.definition,
      triggerKind: input.triggerKind as WorkflowTriggerKind,
    });

    void workflow;
    return this.repo.getVersion(id);
  }

  // -------------------------------------------------------------------------
  // Runs
  // -------------------------------------------------------------------------

  /**
   * Manual (test) run against the current version. Writes the run + one step
   * row per node, evaluating the graph's condition branches along the true
   * path and marking delay nodes `pending` with a `scheduledFor`.
   */
  async createRun(input: {
    workflowId: string;
    triggerEntityType?: string;
    triggerEntityId?: string;
  }): Promise<{ run: WorkflowRunRow; steps: { nodeId: string; status: string }[] }> {
    const workflow = await this.repo.getWorkflow(input.workflowId);
    if (!workflow.currentVersionId) {
      throw new ConflictError('Save a version before running a workflow.');
    }

    const version = await this.repo.getVersion(workflow.currentVersionId);
    const definition = version.definition as WorkflowDefinition;

    const { id: runId } = await this.repo.createRun({
      workflowVersionId: version.id,
      triggerEntityType: input.triggerEntityType,
      triggerEntityId: input.triggerEntityId,
    });

    // Walk the graph from the trigger along the true path. A condition takes
    // its true branch; everything else executes; delay nodes are pending.
    const executed = this.traceTruePath(definition);
    const steps: {
      nodeId: string;
      status: 'pending' | 'succeeded';
      scheduledFor?: Date;
    }[] = executed.map((node) => {
      if (node.type === 'delay') {
        const seconds = Number(node.config['delaySeconds'] ?? 3600);
        return {
          nodeId: node.id,
          status: 'pending' as const,
          scheduledFor: new Date(Date.now() + seconds * 1000),
        };
      }
      return { nodeId: node.id, status: 'succeeded' as const };
    });

    await this.repo.createRunSteps(runId, steps);
    await this.repo.finishRun(runId, 'succeeded');

    const run = await this.repo.getRun(runId);
    return { run, steps: steps.map(({ nodeId, status }) => ({ nodeId, status })) };
  }

  async listRuns(workflowId: string): Promise<WorkflowRunRow[]> {
    await this.repo.getWorkflow(workflowId);
    return this.repo.listRuns(workflowId);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Orders the graph's nodes by walking edges from the trigger, following the
   * true branch of conditions. A node with no path from the trigger is skipped.
   */
  private traceTruePath(definition: WorkflowDefinition): WorkflowDefinition['nodes'] {
    const byId = new Map(definition.nodes.map((node) => [node.id, node]));
    const outgoing = new Map<string, { to: string; label?: 'true' | 'false' }[]>();
    for (const edge of definition.edges) {
      const list = outgoing.get(edge.from) ?? [];
      list.push({ to: edge.to, label: edge.label });
      outgoing.set(edge.from, list);
    }

    const ordered: WorkflowDefinition['nodes'] = [];
    const seen = new Set<string>();
    const visit = (nodeId: string) => {
      if (seen.has(nodeId)) return;
      seen.add(nodeId);
      const node = byId.get(nodeId);
      if (!node) return;
      ordered.push(node);

      const edges = outgoing.get(nodeId) ?? [];
      // Conditions: follow the true branch only. Everything else: all edges.
      const next =
        node.type === 'condition' ? edges.filter((e) => e.label === 'true') : edges;
      for (const edge of next) visit(edge.to);
    };

    const trigger = definition.nodes.find((node) => node.type === 'trigger');
    if (trigger) visit(trigger.id);
    return ordered;
  }
}
