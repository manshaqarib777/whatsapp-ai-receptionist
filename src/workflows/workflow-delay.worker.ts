import { WorkflowsRepository } from '@/features/workflow-builder/repositories/workflows.repository';
import {
  traceExecutionSegment,
  type WorkflowVariables,
} from '@/features/workflow-builder/services/execution';
import type { WorkflowDefinition } from '@/features/workflow-builder/services/graph';
import { claimDueWorkflowStep } from '@/lib/db/system-discovery.repository';
import { logger } from '@/lib/logger';

const POLL_INTERVAL_MS = 2_000;

export async function processDueWorkflowStep(): Promise<boolean> {
  const claimed = await claimDueWorkflowStep();
  if (!claimed) return false;
  const repo = WorkflowsRepository.forOrganization(claimed.organizationId);

  try {
    const [run, version] = await Promise.all([
      repo.getRun(claimed.runId),
      repo.getVersion(claimed.workflowVersionId),
    ]);
    const definition = version.definition as WorkflowDefinition;
    const nextNodeId = definition.edges.find((edge) => edge.from === claimed.nodeId)?.to;
    await repo.completeRunStep(claimed.stepId);

    if (!nextNodeId) {
      await repo.finishRun(claimed.runId, 'succeeded');
      return true;
    }
    const segment = traceExecutionSegment(
      definition,
      nextNodeId,
      run.context as WorkflowVariables,
    );
    await repo.createRunSteps(
      claimed.runId,
      segment.nodes.map((node) =>
        node.type === 'delay'
          ? {
              nodeId: node.id,
              status: 'pending' as const,
              scheduledFor: new Date(
                Date.now() + Number(node.config['delaySeconds'] ?? 3600) * 1000,
              ),
            }
          : { nodeId: node.id, status: 'succeeded' as const },
      ),
    );
    if (!segment.delay) await repo.finishRun(claimed.runId, 'succeeded');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workflow resume failed.';
    await repo.failRunStep(claimed.stepId, message);
    await repo.finishRun(claimed.runId, 'failed', message);
    logger.error({ err: error, stepId: claimed.stepId }, 'workflow delay failed');
  }
  return true;
}

export async function runWorkflowDelayWorker(
  options: { once?: boolean } = {},
): Promise<void> {
  logger.info('workflow delay worker started');
  for (;;) {
    await processDueWorkflowStep();
    if (options.once) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
