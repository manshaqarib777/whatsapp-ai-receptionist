import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { AiBaseRepository } from './ai.base';
import type {
  NewTemplateInput,
  PromptTemplateDetail,
  PromptTemplateRow,
} from './ai.types';

/**
 * Prompt-template data access.
 *
 * Templates are versioned; one version is `active` and drives the engine's
 * resolveActiveBody read path. Activation swaps the current version atomically.
 */
export class AiTemplatesRepository extends AiBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listTemplates(): Promise<PromptTemplateRow[]> {
    return this.db.promptTemplate.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        currentVersionId: true,
        version: true,
        createdAt: true,
      },
    });
  }

  async getTemplate(id: string): Promise<PromptTemplateDetail> {
    const row = await this.db.promptTemplate.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        key: true,
        name: true,
        currentVersionId: true,
        version: true,
        createdAt: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            body: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundError('Template not found.');
    return row;
  }

  async findTemplateByKey(key: string): Promise<PromptTemplateDetail | null> {
    return this.db.promptTemplate.findFirst({
      where: { key, deletedAt: null },
      select: {
        id: true,
        key: true,
        name: true,
        currentVersionId: true,
        version: true,
        createdAt: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            body: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async createTemplate(
    input: NewTemplateInput,
  ): Promise<{ id: string; versionId: string }> {
    const branchId = input.branchId ?? (await this.resolveDefaultBranch());
    const db = this.writeScope(branchId);
    const template = await db.promptTemplate.create({
      data: {
        organizationId: this.organizationId,
        branchId,
        key: input.key,
        name: input.name,
        version: 1,
      },
      select: { id: true },
    });

    const version = await db.promptTemplateVersion.create({
      data: {
        organizationId: this.organizationId,
        templateId: template.id,
        versionNumber: 1,
        body: input.body,
        status: 'draft',
      },
      select: { id: true },
    });

    return { id: template.id, versionId: version.id };
  }

  async addVersion(
    templateId: string,
    body: string,
  ): Promise<{ versionId: string; versionNumber: number }> {
    const template = await this.getTemplate(templateId);
    const nextNumber = template.versions[0]?.versionNumber ?? 0;
    const versionNumber = nextNumber + 1;

    const branchId = await this.resolveDefaultBranch();
    const db = this.writeScope(branchId);
    const version = await db.promptTemplateVersion.create({
      data: {
        organizationId: this.organizationId,
        templateId,
        versionNumber,
        body,
        status: 'draft',
      },
      select: { id: true },
    });

    await this.db.promptTemplate.updateMany({
      where: { id: templateId },
      data: { version: versionNumber },
    });

    return { versionId: version.id, versionNumber };
  }

  async activateVersion(templateId: string, versionId: string): Promise<void> {
    const version = await this.db.promptTemplateVersion.findFirst({
      where: { templateId, id: versionId },
      select: { id: true },
    });
    if (!version) throw new NotFoundError('Version not found.');

    const branchId = await this.resolveDefaultBranch();
    const db = this.writeScope(branchId);
    await db.$transaction([
      db.promptTemplateVersion.updateMany({
        where: { id: versionId },
        data: { status: 'active' },
      }),
      db.promptTemplate.updateMany({
        where: { id: templateId },
        data: { currentVersionId: versionId },
      }),
    ]);
  }

  /** Resolves the active body for a template key (engine read path). */
  async resolveActiveBody(key: string): Promise<string | null> {
    const template = await this.db.promptTemplate.findFirst({
      where: { key, deletedAt: null },
      select: {
        currentVersionId: true,
        versions: {
          where: { status: 'active' },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { body: true },
        },
      },
    });
    if (!template?.currentVersionId) return null;
    const active = template.versions[0];
    if (!active) return null;
    return active.body;
  }
}
