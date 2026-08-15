import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { KnowledgeBaseRepository } from './knowledge.base';
import type {
  KnowledgeSourceRow,
  NewSourceInput,
  SourceWithDocuments,
} from './knowledge.types';

/**
 * Knowledge-source data access.
 *
 * Sources are branch-scoped; creates resolve the default branch and build a
 * branch-scoped client, the same pattern the inbox uses for labels.
 */
export class KnowledgeSourcesRepository extends KnowledgeBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

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
    const branchDb = this.writeScope(branchId);
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
}
