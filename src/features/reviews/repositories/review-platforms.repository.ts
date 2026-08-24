import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';
import { ReviewsBaseRepository } from './reviews.base';
import type { ReviewPlatformRow } from './reviews.types';

const SELECT = {
  id: true,
  name: true,
  provider: true,
  isConnected: true,
  createdAt: true,
} as const;

export class ReviewPlatformsRepository extends ReviewsBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listPlatforms(): Promise<ReviewPlatformRow[]> {
    const rows = await this.db.reviewPlatform.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: SELECT,
    });
    return rows.map(toPlatformRow);
  }

  async getPlatform(id: string): Promise<ReviewPlatformRow> {
    const row = await this.db.reviewPlatform.findFirst({
      where: { id, deletedAt: null },
      select: SELECT,
    });
    if (!row) throw new NotFoundError('Review platform not found.');
    return toPlatformRow(row);
  }

  async findPlatformByProvider(provider: 'google' | 'facebook') {
    const row = await this.db.reviewPlatform.findFirst({
      where: { provider, deletedAt: null },
      select: SELECT,
    });
    return row ? toPlatformRow(row) : null;
  }

  async createPlatform(input: {
    branchId: string;
    name: string;
    provider: 'google' | 'facebook';
    isConnected: boolean;
  }): Promise<ReviewPlatformRow> {
    const row = await this.writeScope(input.branchId).reviewPlatform.create({
      data: { organizationId: this.organizationId, ...input },
      select: SELECT,
    });
    return toPlatformRow(row);
  }

  async ensureDefaultPlatforms(branchId: string): Promise<void> {
    const db = this.writeScope(branchId);
    for (const provider of ['google', 'facebook'] as const) {
      const existing = await db.reviewPlatform.findFirst({
        where: { provider, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        await db.reviewPlatform.create({
          data: {
            organizationId: this.organizationId,
            branchId,
            name: provider === 'google' ? 'Google' : 'Facebook',
            provider,
            isConnected: false,
          },
        });
      }
    }
  }
}

function toPlatformRow(row: {
  id: string;
  name: string;
  provider: string;
  isConnected: boolean;
  createdAt: Date;
}): ReviewPlatformRow {
  return {
    ...row,
    provider: row.provider as ReviewPlatformRow['provider'],
  };
}
