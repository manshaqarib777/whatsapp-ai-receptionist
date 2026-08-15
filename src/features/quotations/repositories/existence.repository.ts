import type { Scope } from '@/lib/db/scope';

import { QuotationsBaseRepository } from './quotations.base';

/**
 * Cross-entity existence checks for quote creation.
 */
export class QuotationsExistenceRepository extends QuotationsBaseRepository {
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
}
