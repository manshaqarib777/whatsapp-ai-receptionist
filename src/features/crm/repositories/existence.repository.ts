import type { Scope } from '@/lib/db/scope';

import { CrmBaseRepository } from './crm.base';

/**
 * Cross-entity existence checks used by tagging and activity subjects.
 *
 * A tag or activity can target a contact or a conversation; the subject must
 * exist within the tenant before the polymorphic row is written.
 */
export class CrmExistenceRepository extends CrmBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async contactExists(id: string): Promise<boolean> {
    const row = await this.db.contact.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  async conversationExists(id: string): Promise<boolean> {
    const row = await this.db.conversation.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }
}
