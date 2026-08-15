import { NotFoundError } from '@/lib/errors';
import { expectOne } from '@/lib/db/base-repository';
import type { Scope } from '@/lib/db/scope';

import { KnowledgeBaseRepository } from './knowledge.base';
import type { KnowledgeDocumentDetail, KnowledgeVersionStatus } from './knowledge.types';

/**
 * Knowledge document + version data access.
 *
 * Versions follow a strict lifecycle (draft → pending_approval → approved /
 * archived), guarded with `from`/`to` transitions so a stale write is a no-op.
 */
export class KnowledgeDocumentsRepository extends KnowledgeBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async createDocument(input: {
    sourceId: string;
    branchId: string;
    title: string;
    fileName?: string;
    mimeType?: string;
    storageKey?: string;
    sizeBytes?: bigint;
  }): Promise<{ id: string; branchId: string }> {
    // The source must exist within this tenant — the scoped lookup is the
    // cross-tenant guard (404 for another org's source id).
    const source = await this.db.knowledgeSource.findFirst({
      where: { id: input.sourceId, deletedAt: null },
      select: { id: true },
    });
    if (!source) throw new NotFoundError('Source not found.');

    const branchId = input.branchId ?? (await this.resolveDefaultBranch());
    const branchDb = this.writeScope(branchId);
    return branchDb.knowledgeDocument.create({
      data: {
        organizationId: this.organizationId,
        branchId,
        sourceId: input.sourceId,
        title: input.title,
        fileName: input.fileName ?? null,
        mimeType: input.mimeType ?? null,
        storageKey: input.storageKey ?? null,
        sizeBytes: input.sizeBytes ?? null,
      },
      select: { id: true, branchId: true },
    });
  }

  async getDocument(id: string): Promise<KnowledgeDocumentDetail> {
    const row = await this.db.knowledgeDocument.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        sourceId: true,
        branchId: true,
        title: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        storageKey: true,
        currentVersionId: true,
        createdAt: true,
        source: { select: { name: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            status: true,
            approvedById: true,
            approvedAt: true,
            chunkCount: true,
            checksum: true,
            createdAt: true,
            approvedBy: { select: { name: true } },
          },
        },
      },
    });

    if (!row) throw new NotFoundError('Document not found.');

    return {
      id: row.id,
      sourceId: row.sourceId,
      sourceName: row.source.name,
      branchId: row.branchId,
      title: row.title,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes ? row.sizeBytes.toString() : null,
      storageKey: row.storageKey,
      currentVersionId: row.currentVersionId,
      createdAt: row.createdAt,
      versions: row.versions.map((v) => ({
        id: v.id,
        documentId: row.id,
        versionNumber: v.versionNumber,
        status: v.status,
        approvedById: v.approvedById,
        approvedByName: v.approvedBy?.name ?? null,
        approvedAt: v.approvedAt,
        chunkCount: v.chunkCount,
        checksum: v.checksum,
        createdAt: v.createdAt,
      })),
    };
  }

  /** Creates the draft version row for a document (before ingestion fills chunks). */
  async createVersion(input: {
    documentId: string;
    versionNumber: number;
    extractedText: string;
  }): Promise<{ id: string }> {
    return this.db.knowledgeDocumentVersion.create({
      data: {
        organizationId: this.organizationId,
        documentId: input.documentId,
        versionNumber: input.versionNumber,
        extractedText: input.extractedText,
      },
      select: { id: true },
    });
  }

  async updateVersionChunks(input: {
    versionId: string;
    chunkCount: number;
    checksum: string;
  }): Promise<void> {
    const result = await this.db.knowledgeDocumentVersion.updateMany({
      where: { id: input.versionId },
      data: { chunkCount: input.chunkCount, checksum: input.checksum },
    });
    expectOne(result, 'Version');
  }

  async transitionVersionStatus(input: {
    versionId: string;
    from: KnowledgeVersionStatus;
    to: KnowledgeVersionStatus;
    approvedById?: string | null;
    approvedAt?: Date | null;
  }): Promise<{ id: string; documentId: string; status: KnowledgeVersionStatus }> {
    const result = await this.db.knowledgeDocumentVersion.updateMany({
      where: { id: input.versionId, status: input.from },
      data: {
        status: input.to,
        ...(input.approvedById !== undefined ? { approvedById: input.approvedById } : {}),
        ...(input.approvedAt !== undefined ? { approvedAt: input.approvedAt } : {}),
      },
    });
    expectOne(result, 'Version');

    const row = await this.db.knowledgeDocumentVersion.findFirst({
      where: { id: input.versionId },
      select: { id: true, documentId: true, status: true },
    });
    if (!row) throw new NotFoundError('Version not found.');
    return row;
  }

  async setCurrentVersion(documentId: string, versionId: string): Promise<void> {
    const result = await this.db.knowledgeDocument.updateMany({
      where: { id: documentId },
      data: { currentVersionId: versionId },
    });
    expectOne(result, 'Document');
  }

  async getNextVersionNumber(documentId: string): Promise<number> {
    const latest = await this.db.knowledgeDocumentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return latest ? latest.versionNumber + 1 : 1;
  }

  async getVersion(input: {
    versionId: string;
  }): Promise<{ id: string; documentId: string; status: KnowledgeVersionStatus }> {
    const row = await this.db.knowledgeDocumentVersion.findFirst({
      where: { id: input.versionId },
      select: { id: true, documentId: true, status: true },
    });
    if (!row) throw new NotFoundError('Version not found.');
    return row;
  }
}
