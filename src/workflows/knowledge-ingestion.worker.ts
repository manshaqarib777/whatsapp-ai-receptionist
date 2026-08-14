import { KnowledgeRepository } from '@/features/knowledge/repositories/knowledge.repository';
import type { JobStatus } from '@/features/knowledge/repositories/knowledge.repository';
import { KnowledgeService } from '@/features/knowledge/services/knowledge.service';
import { claimNextJob, deleteChunksForVersion } from '@/features/knowledge/lib/retrieval';
import { fetchWebsiteText, parseUpload } from '@/features/knowledge/services/parsers';
import { ocrPdf } from '@/features/knowledge/services/ocr';
import { getStorage } from '@/lib/storage';
import { logger } from '@/lib/logger';
import type { Scope } from '@/lib/db/scope';

/**
 * Knowledge ingestion worker (AD-3).
 *
 * A DB-polled worker: atomically claims a `queued` `ingestion_jobs` row (SKIP
 * LOCKED), parses the source, chunks + embeds, persists chunks, and marks the job
 * succeeded/failed with an error. No Redis, no external queue — the database IS the
 * queue, which is the constraint until Milestone 24.
 *
 * Run with `npm run knowledge:work` (a tsx script) or the docker-compose `worker`
 * service. The processing steps are plain async functions on the service so the
 * integration test drives the worker's exact code path without faking timers.
 */

const POLL_INTERVAL_MS = 2_000;

export type ProcessedJob = {
  jobId: string;
  status: JobStatus;
  error: string | null;
};

/**
 * Claims and processes a single queued job for the given organization scope.
 *
 * Returns null when there is nothing to claim. A job already claimed by another
 * worker is skipped (SKIP LOCKED), so two workers never process the same row.
 */
export async function processNextJob(scope: Scope): Promise<ProcessedJob | null> {
  const claimed = await claimNextJob(scope);
  if (!claimed) return null;

  const repo = new KnowledgeRepository(scope);
  const service = new KnowledgeService(repo);

  try {
    await runIngestion(service, repo, scope, claimed);
    await repo.updateJobStatus(claimed.id, { status: 'succeeded', progress: 100 });
    return { jobId: claimed.id, status: 'succeeded', error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ingestion error.';
    // Failures are persisted on the job row, never swallowed — the UI polls it.
    await repo.updateJobStatus(claimed.id, { status: 'failed', error: message });
    return { jobId: claimed.id, status: 'failed', error: message };
  }
}

/** Runs parse → chunk → embed → persist for one claimed job. */
async function runIngestion(
  service: KnowledgeService,
  repo: KnowledgeRepository,
  scope: Scope,
  job: {
    id: string;
    sourceId: string;
    documentId: string | null;
    versionId: string | null;
  },
): Promise<void> {
  if (!job.documentId || !job.versionId) {
    throw new Error('Job has no document or version to ingest.');
  }

  const source = await repo.getSource(job.sourceId);
  const document = await repo.getDocument(job.documentId);
  const branchId = document.branchId;

  let extractedText: string | null = null;
  let needsOcr = false;

  if (source.kind === 'website') {
    // The URL is recorded as the document title (see createWebsiteSource).
    extractedText = await fetchWebsiteText(document.title);
  } else if (source.kind === 'faq') {
    // FAQ content was ingested synchronously at creation; nothing to do here.
    return;
  } else if (document.fileName && document.mimeType && document.storageKey) {
    const buffer = await getStorage(document.storageKey);
    const parsed = await parseUpload(buffer, document.mimeType, document.fileName);
    extractedText = parsed.text;
    needsOcr = parsed.needsOcr;
  } else {
    throw new Error('Upload document is missing file metadata.');
  }

  if (needsOcr) {
    extractedText = await ocrPdfForDocument(document);
  }

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('The document contained no extractable text.');
  }

  // A re-ingestion of an unchanged file is a cheap no-op: replace the chunks only
  // when the content actually changed.
  await deleteChunksForVersion(scope, job.versionId, branchId);

  await service.ingestVersion({
    documentId: job.documentId,
    versionId: job.versionId,
    branchId,
    extractedText,
  });
}

/** Reads + parses + OCRs a scanned PDF. */
async function ocrPdfForDocument(document: {
  storageKey: string | null;
  mimeType: string | null;
  fileName: string | null;
}): Promise<string | null> {
  if (!document.storageKey || !document.mimeType || !document.fileName) return null;
  const buffer = await getStorage(document.storageKey);
  const parsed = await parseUpload(buffer, document.mimeType, document.fileName);
  if (!parsed.needsOcr) return parsed.text;

  // Render each page to an image (pdf-parse getScreenshot) and OCR it.
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  let pageCount = 1;
  try {
    const info = await parser.getInfo();
    const pages = (info as unknown as { pages?: number | unknown }).pages;
    if (typeof pages === 'number') pageCount = pages;
  } finally {
    await parser.destroy();
  }
  return ocrPdf(buffer, pageCount);
}

/**
 * The worker loop. Polls for orgs with queued jobs, claims and processes one job
 * per org per poll. Runs until the process is killed (SIGINT/SIGTERM), or once
 * when `options.once` is set (used by the integration test and one-shot runs).
 */
export async function runWorker(options: { once?: boolean } = {}): Promise<void> {
  const { prisma } = await import('@/lib/prisma');

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, 'knowledge worker started');

  for (;;) {
    const orgs = await prisma.$queryRaw<{ organizationId: string }[]>`
      SELECT DISTINCT organization_id AS "organizationId"
      FROM ingestion_jobs
      WHERE status = 'queued'
      ORDER BY organization_id
      LIMIT 50;
    `;

    for (const org of orgs) {
      const scope: Scope = { organizationId: org.organizationId, branchId: null };
      const result = await processNextJob(scope);
      if (result) {
        logger.info(
          { jobId: result.jobId, status: result.status },
          'ingestion job processed',
        );
      }
    }

    if (options.once) break;
    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
