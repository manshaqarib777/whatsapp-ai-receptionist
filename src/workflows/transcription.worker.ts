import { TranscriptionsRepository } from '@/features/voice/repositories/transcriptions.repository';
import { speechProvider } from '@/features/voice/services/speech.provider';
import {
  claimTranscription,
  listTranscriptionOrganizationIds,
} from '@/lib/db/system-discovery.repository';
import { getStorage } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { resolveBranchScope } from '@/server/scope';

export async function processNextTranscription(organizationId: string): Promise<boolean> {
  const claimed = await claimTranscription(organizationId);
  if (!claimed) return false;
  const repo = new TranscriptionsRepository(
    resolveBranchScope(organizationId, claimed.branchId),
  );
  try {
    const job = await repo.getJob(claimed.id);
    const audio = await getStorage(job.attachment.storageKey);
    await repo.complete(
      job.id,
      await speechProvider().transcribe({
        audio,
        mimeType: job.attachment.mimeType,
        language: job.language,
        fileName: job.attachment.fileName,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown transcription failure.';
    await repo.fail(claimed.id, message);
    logger.error({ err: error, transcriptionId: claimed.id }, 'transcription failed');
  }
  return true;
}

export async function runTranscriptionWorker(options: { once?: boolean } = {}) {
  logger.info('transcription worker started');
  for (;;) {
    for (const organizationId of await listTranscriptionOrganizationIds())
      await processNextTranscription(organizationId);
    if (options.once) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
