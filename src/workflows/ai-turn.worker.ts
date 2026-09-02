import { AiEngineService } from '@/features/ai/services/ai-engine.service';
import { AiRepository } from '@/features/ai/repositories/ai.repository';
import { AiTurnJobsRepository } from '@/features/ai/repositories/turn-jobs.repository';
import {
  claimAiTurnJob,
  listAiTurnJobOrganizationIds,
} from '@/lib/db/system-discovery.repository';
import { logger } from '@/lib/logger';
import { resolveScope } from '@/server/scope';

const POLL_INTERVAL_MS = 2_000;

export async function processNextAiTurn(organizationId: string): Promise<boolean> {
  const jobId = await claimAiTurnJob(organizationId);
  if (!jobId) return false;

  const scope = resolveScope(organizationId);
  const jobs = new AiTurnJobsRepository(scope);

  try {
    // The run id is deterministic (the job UUID). If a worker crashed after writing
    // the run but before completing the job, recovery links the existing run instead
    // of invoking the provider twice.
    if (await new AiRepository(scope).findRun(jobId)) {
      await jobs.succeed(jobId, jobId);
      return true;
    }

    const input = await jobs.getInput(jobId);
    const result = await new AiEngineService(scope).runTurn({
      ...input,
      runId: jobId,
    });
    await jobs.succeed(jobId, result.runId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AI turn failure.';
    await jobs.fail(jobId, message);
    logger.error({ err: error, jobId }, 'AI turn job failed');
  }

  return true;
}

export async function runAiTurnWorker(options: { once?: boolean } = {}): Promise<void> {
  logger.info('AI turn worker started');
  for (;;) {
    for (const organizationId of await listAiTurnJobOrganizationIds()) {
      await processNextAiTurn(organizationId);
    }
    if (options.once) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
