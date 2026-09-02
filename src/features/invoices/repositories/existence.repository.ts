import type { Scope } from '@/lib/db/scope';

import { InvoicesBaseRepository } from './invoices.base';

/**
 * Cross-entity existence checks for invoice creation.
 */
export class InvoicesExistenceRepository extends InvoicesBaseRepository {
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
