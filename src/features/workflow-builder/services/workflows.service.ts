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
import {
  traceExecutionSegment,
  type WorkflowVariables,
} from '@/features/workflow-builder/services/execution';

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

  async cloneWorkflow(sourceId: string, input: { name: string }): Promise<WorkflowRow> {
    const source = await this.repo.getWorkflow(sourceId);
    if (!source.currentVersionId) {
      throw new ConflictError('Save a version before using this workflow as a template.');
    }
    const sourceVersion = await this.repo.getVersion(source.currentVersionId);
    const copy = await this.createWorkflow(input);
    await this.saveVersion({
      workflowId: copy.id,
      definition: sourceVersion.definition,
      triggerKind: sourceVersion.triggerKind,
    });
    return this.repo.getWorkflow(copy.id);
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
   * row per node, evaluating the graph's condition branches from run variables
   * path and marking delay nodes `pending` with a `scheduledFor`.
   */
  async createRun(input: {
    workflowId: string;
    triggerEntityType?: string;
    triggerEntityId?: string;
    variables?: WorkflowVariables;
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
      context: input.variables,
    });

    // Walk the graph from the trigger along the true path. A condition takes
    // its true branch; everything else executes; delay nodes are pending.
    const trigger = definition.nodes.find((node) => node.type === 'trigger');
    if (!trigger) throw new ConflictError('The workflow has no trigger node.');
    const executed = traceExecutionSegment(definition, trigger.id, input.variables);
    const steps: {
      nodeId: string;
      status: 'pending' | 'succeeded';
      scheduledFor?: Date;
    }[] = executed.nodes.map((node) => {
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
    if (!executed.delay) await this.repo.finishRun(runId, 'succeeded');

    const run = await this.repo.getRun(runId);
    return { run, steps: steps.map(({ nodeId, status }) => ({ nodeId, status })) };
  }

  async listRuns(workflowId: string): Promise<WorkflowRunRow[]> {
    await this.repo.getWorkflow(workflowId);
    return this.repo.listRuns(workflowId);
  }
}
