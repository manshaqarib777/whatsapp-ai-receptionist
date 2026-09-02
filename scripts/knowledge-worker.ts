import { runWorker } from '@/workflows/knowledge-ingestion.worker';

/**
 * `npm run knowledge:work` — the knowledge ingestion worker.
 *
 * Polls the database for queued ingestion jobs and processes them. Ctrl-C
 * (SIGINT) stops the loop cleanly; the process is designed to be restarted by
 * docker-compose (restart: unless-stopped) if it ever exits.
 */
runWorker()
  .catch((error: unknown) => {
    console.error('Knowledge worker exited with an error:', error);
    process.exit(1);
  })
  .finally(async () => {
    const { closeOcr } = await import('@/features/knowledge/services/ocr');
    await closeOcr();
  });
