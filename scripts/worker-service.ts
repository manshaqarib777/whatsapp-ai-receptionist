import { runAiTurnWorker } from '@/workflows/ai-turn.worker';
import { runReminderWorker } from '@/workflows/appointment-reminders.worker';
import { runBroadcastWorker } from '@/workflows/broadcast.worker';
import { runCrmAutomationWorker } from '@/workflows/crm-automation.worker';
import { runWorker as runKnowledgeWorker } from '@/workflows/knowledge-ingestion.worker';
import { runLoyaltyWorker } from '@/workflows/loyalty.worker';
import { runReviewsWorker } from '@/workflows/reviews.worker';
import { runTranscriptionWorker } from '@/workflows/transcription.worker';
import { runWorkflowDelayWorker } from '@/workflows/workflow-delay.worker';
import { logger } from '@/lib/logger';

/** Runs every durable PostgreSQL-backed consumer in one restartable worker service. */
async function main(): Promise<void> {
  logger.info('combined worker service started');
  await Promise.all([
    runAiTurnWorker(),
    runReminderWorker(),
    runBroadcastWorker(),
    runCrmAutomationWorker(),
    runKnowledgeWorker(),
    runLoyaltyWorker(),
    runReviewsWorker(),
    runTranscriptionWorker(),
    runWorkflowDelayWorker(),
  ]);
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'combined worker service exited');
  process.exitCode = 1;
});
