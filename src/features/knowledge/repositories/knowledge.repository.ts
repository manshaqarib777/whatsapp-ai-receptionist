import { NotFoundError } from '@/lib/errors';
import { forScope } from '@/lib/db/scoped-prisma';
import type { Scope } from '@/lib/db/scope';
import { expectOne } from '@/lib/db/base-repository';
import { resolveScope } from '@/server/scope';

/**
 * Knowledge base data access — Milestone 7.
 *
 * The only layer that touches the database for knowledge reads and writes. Every
 * query runs through `forScope(scope)` — the tenant isolation control — with the
 * scope built by `resolveScope` from the session-derived organization id.
 *
 * Scoped-model rule: never `findUnique` on a scoped model — use `findFirst` +
 * `expectOne`. Cross-tenant reads/writes are 404, never 403.
 *
 * The pgvector similarity search and chunk inserts go through raw SQL in
 * `src/features/knowledge/lib/retrieval.ts` because `KnowledgeChunk.embedding` is
 * `Unsupported`; those queries self-scope explicitly.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KnowledgeSourceKind =
  'upload' | 'pdf' | 'docx' | 'csv' | 'website' | 'faq' | 'notion' | 'google_docs';
export type KnowledgeVersionStatus =
  'draft' | 'pending_approval' | 'approved' | 'archived';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type KnowledgeSourceRow = {
  id: string;
  kind: KnowledgeSourceKind;
  name: string;
  documentCount: number;
  createdAt: Date;
};

export type KnowledgeDocumentRow = {
  id: string;
  sourceId: string;
  title: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: string | null;
  currentVersionId: string | null;
  currentStatus: KnowledgeVersionStatus | null;
  currentVersionNumber: number | null;
  createdAt: Date;
};

export type KnowledgeVersionRow = {
  id: string;
  documentId: string;
  versionNumber: number;
  status: KnowledgeVersionStatus;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  chunkCount: number | null;
  checksum: string | null;
  createdAt: Date;
};

export type KnowledgeDocumentDetail = {
  id: string;
  sourceId: string;
  sourceName: string;
  branchId: string;
  title: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: string | null;
  storageKey: string | null;
  currentVersionId: string | null;
  createdAt: Date;
  versions: KnowledgeVersionRow[];
};

export type KnowledgeJobRow = {
  id: string;
  sourceId: string;
  documentId: string | null;
  versionId: string | null;
  status: JobStatus;
  error: string | null;
  progress: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SourceWithDocuments = {
  id: string;
  kind: KnowledgeSourceKind;
  name: string;
  createdAt: Date;
  documents: KnowledgeDocumentRow[];
};

export type NewSourceInput = {
  kind: KnowledgeSourceKind;
  name: string;
  branchId: string;
};

export class KnowledgeRepository {
  private readonly db: ReturnType<typeof forScope>;
  readonly organizationId: string;

  constructor(scope: Scope) {
    this.db = forScope(scope);
    this.organizationId = scope.organizationId;
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): KnowledgeRepository {
    return new KnowledgeRepository(resolveScope(organizationId));
  }

  // -------------------------------------------------------------------------
  // Sources
  // -------------------------------------------------------------------------

  async listSources(): Promise<KnowledgeSourceRow[]> {
    const rows = await this.db.knowledgeSource.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        name: true,
        createdAt: true,
        documents: { where: { deletedAt: null }, select: { id: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      documentCount: row.documents.length,
      createdAt: row.createdAt,
    }));
  }

  async getSource(id: string): Promise<SourceWithDocuments> {
    const row = await this.db.knowledgeSource.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        kind: true,
        name: true,
        createdAt: true,
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            currentVersionId: true,
            createdAt: true,
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              select: { id: true, versionNumber: true, status: true },
            },
          },
        },
      },
    });

    if (!row) throw new NotFoundError('Source not found.');

    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      createdAt: row.createdAt,
      documents: row.documents.map((doc) => {
        const latest = doc.versions[0];
        return {
          id: doc.id,
          sourceId: id,
          title: doc.title,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes ? doc.sizeBytes.toString() : null,
          currentVersionId: doc.currentVersionId,
          currentStatus: latest?.status ?? null,
          currentVersionNumber: latest?.versionNumber ?? null,
          createdAt: doc.createdAt,
        };
      }),
    };
  }

  async createSource(input: NewSourceInput): Promise<KnowledgeSourceRow> {
    // KnowledgeSource is branch-scoped, but the org-level scope has no branch.
    // Resolve the default branch and build a branch-scoped client for the create —
    // the same pattern the inbox uses for labels.
    const branchId = input.branchId ?? (await this.resolveDefaultBranch());
    const branchDb = forScope({ organizationId: this.organizationId, branchId });
    const row = await branchDb.knowledgeSource.create({
      data: {
        organizationId: this.organizationId,
        branchId,
        kind: input.kind,
        name: input.name,
      },
      select: { id: true, kind: true, name: true, createdAt: true },
    });
    return { ...row, documentCount: 0 };
  }

  async assertSourceExists(id: string): Promise<void> {
    const row = await this.db.knowledgeSource.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundError('Source not found.');
  }

  // -------------------------------------------------------------------------
  // Documents + versions
  // -------------------------------------------------------------------------

  async createDocument(input: {
    sourceId: string;
    branchId: string;
    title: string;
    fileName?: string;
    mimeType?: string;
    storageKey?: string;
    sizeBytes?: bigint;
  }): Promise<{ id: string; branchId: string }> {
    await this.assertSourceExists(input.sourceId);

    const branchId = input.branchId ?? (await this.resolveDefaultBranch());
    const branchDb = forScope({ organizationId: this.organizationId, branchId });
    const row = await branchDb.knowledgeDocument.create({
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
    return row;
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
    const row = await this.db.knowledgeDocumentVersion.create({
      data: {
        organizationId: this.organizationId,
        documentId: input.documentId,
        versionNumber: input.versionNumber,
        extractedText: input.extractedText,
      },
      select: { id: true },
    });
    return row;
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

  // -------------------------------------------------------------------------
  // Chunks — raw SQL lives in lib/retrieval.ts
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Ingestion jobs
  // -------------------------------------------------------------------------

  async createJob(input: {
    sourceId: string;
    documentId?: string;
    versionId?: string;
  }): Promise<{ id: string }> {
    const row = await this.db.ingestionJob.create({
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
    return row;
  }

  async listJobs(limit = 20): Promise<KnowledgeJobRow[]> {
    const rows = await this.db.ingestionJob.findMany({
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
    return rows;
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

  // -------------------------------------------------------------------------
  // Branch resolution
  // -------------------------------------------------------------------------

  async resolveDefaultBranch(): Promise<string> {
    const branch = await this.db.branch.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (!branch) throw new NotFoundError('No default branch for this organization.');
    return branch.id;
  }
}
