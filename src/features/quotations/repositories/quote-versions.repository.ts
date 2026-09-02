import type { Scope } from '@/lib/db/scope';

import { QuotationsBaseRepository } from './quotations.base';
import type { QuoteRow, QuoteVersionRow } from './quotations.types';

/**
 * Quote-version data access.
 *
 * Sending a quote snapshots the full quote row into a `QuoteVersion`, so the
 * accepted/rejected document is the exact one the customer saw — recoverable
 * verbatim, not approximated from the current row.
 */
export class QuoteVersionsRepository extends QuotationsBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listVersions(quoteId: string): Promise<QuoteVersionRow[]> {
    return this.db.quoteVersion.findMany({
      where: { quoteId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, snapshot: true, createdAt: true },
    });
  }

  async createVersion(
    quoteId: string,
    versionNumber: number,
    snapshot: QuoteRow,
  ): Promise<void> {
    const db = this.writeScope(await this.resolveDefaultBranch());
    await db.quoteVersion.create({
      data: {
        organizationId: this.organizationId,
        quoteId,
        versionNumber,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
      },
    });
  }

  async nextVersionNumber(quoteId: string): Promise<number> {
    const last = await this.db.quoteVersion.findFirst({
      where: { quoteId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return (last?.versionNumber ?? 0) + 1;
  }
}
