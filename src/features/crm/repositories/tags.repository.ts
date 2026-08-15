import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { CrmBaseRepository } from './crm.base';
import type { TagRow, TaggableType } from './crm.types';

const TAG_SELECT = {
  id: true,
  name: true,
  color: true,
} as const;

/**
 * Tag data access.
 *
 * Tags apply polymorphically through `taggables` (deal/contact/conversation).
 * Re-tagging is idempotent: the unique `(tagId, taggableType, taggableId)`
 * constraint makes a duplicate insert a swallowed P2002, not a duplicate.
 */
export class CrmTagsRepository extends CrmBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listTags(): Promise<TagRow[]> {
    return this.db.tag.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: TAG_SELECT,
    });
  }

  async createTag(input: {
    branchId: string;
    name: string;
    color: string;
  }): Promise<TagRow> {
    const db = this.writeScope(input.branchId);
    return db.tag.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        color: input.color,
      },
      select: TAG_SELECT,
    });
  }

  async getTag(id: string): Promise<TagRow> {
    const row = await this.db.tag.findFirst({
      where: { id, deletedAt: null },
      select: TAG_SELECT,
    });
    if (!row) throw new NotFoundError('Tag not found.');
    return row;
  }

  /**
   * Tags a subject. Idempotent — the unique `(tagId, taggableType, taggableId)`
   * constraint means re-tagging is a no-op, not a duplicate.
   */
  async assignTag(
    tagId: string,
    taggableType: TaggableType,
    taggableId: string,
  ): Promise<void> {
    await this.getTag(tagId);
    try {
      await this.db.taggable.create({
        data: {
          organizationId: this.organizationId,
          tagId,
          taggableType,
          taggableId,
        },
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2002') return; // already tagged — idempotent
      throw error;
    }
  }

  async removeTag(
    tagId: string,
    taggableType: TaggableType,
    taggableId: string,
  ): Promise<void> {
    await this.db.taggable.deleteMany({
      where: { tagId, taggableType, taggableId },
    });
  }

  async listTaggedDeals(tagId: string): Promise<string[]> {
    const rows = await this.db.taggable.findMany({
      where: { tagId, taggableType: 'deal' },
      select: { taggableId: true },
    });
    return rows.map((row) => row.taggableId);
  }

  /**
   * Finds a tag by name, creating it (in the default branch) when absent. Used
   * by automation rules so a configured tag name does not need a manual setup
   * step.
   */
  async findOrCreateTagByName(name: string): Promise<TagRow> {
    const existing = await this.db.tag.findFirst({
      where: { name, deletedAt: null },
      select: TAG_SELECT,
    });
    if (existing) return existing;

    const branchId = await this.resolveDefaultBranch();
    const db = this.writeScope(branchId);
    return db.tag.create({
      data: {
        organizationId: this.organizationId,
        branchId,
        name,
        color: 'neutral',
      },
      select: TAG_SELECT,
    });
  }

  /** Idempotency marker: is this tag already on this subject? */
  async hasTag(
    tagId: string,
    taggableType: TaggableType,
    taggableId: string,
  ): Promise<boolean> {
    const row = await this.db.taggable.findFirst({
      where: { tagId, taggableType, taggableId },
      select: { id: true },
    });
    return row !== null;
  }
}
