import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { KnowledgeBaseRepository } from './knowledge.base';
import type { JobStatus, KnowledgeJobRow } from './knowledge.types';

/**
 * Ingestion-job data access.
 *
 * Jobs are the DB-polled queue for the knowledge worker. `finishedAt` is set
 * when a terminal status lands.
 */
export class KnowledgeJobsRepository extends KnowledgeBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async createJob(input: {
    sourceId: string;
    documentId?: string;
    versionId?: string;
  }): Promise<{ id: string }> {
    return this.db.ingestionJob.create({
      data: {
        organizationId: this.organizationId,
        sourceId: input.sourceId,
        documentId: input.documentId ?? null,
        versionId: input.versionId ?? null,
        status: 'queued',
        progress: 0,
      },
      select: { id: true },
    });
  }

  async listJobs(limit = 20): Promise<KnowledgeJobRow[]> {
    return this.db.ingestionJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        sourceId: true,
        documentId: true,
        versionId: true,
        status: true,
        error: true,
        progress: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getJob(id: string): Promise<KnowledgeJobRow> {
    const row = await this.db.ingestionJob.findFirst({
      where: { id },
      select: {
        id: true,
        sourceId: true,
        documentId: true,
        versionId: true,
        status: true,
        error: true,
        progress: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!row) throw new NotFoundError('Job not found.');
    return row;
  }

  async updateJobStatus(
    id: string,
    input: {
      status: JobStatus;
      error?: string;
      progress?: number;
    },
  ): Promise<void> {
    await this.db.ingestionJob.updateMany({
      where: { id },
      data: {
        status: input.status,
        error: input.error ?? null,
        progress: input.progress ?? null,
        finishedAt:
          input.status === 'succeeded' || input.status === 'failed'
            ? new Date()
            : undefined,
      },
    });
  }
}
