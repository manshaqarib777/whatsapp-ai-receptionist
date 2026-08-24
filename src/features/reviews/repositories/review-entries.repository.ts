import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';
import { ReviewsBaseRepository } from './reviews.base';
import type { ReviewRow } from './reviews.types';

const REVIEW_SELECT = {
  id: true,
  contactId: true,
  platformId: true,
  requestId: true,
  rating: true,
  text: true,
  externalReviewId: true,
  receivedAt: true,
  createdAt: true,
  contact: { select: { displayName: true } },
  platform: { select: { name: true, provider: true } },
} as const;

export class ReviewEntriesRepository extends ReviewsBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listReviews(filter: { status?: string } = {}): Promise<ReviewRow[]> {
    const rows = await this.db.review.findMany({
      where: {
        deletedAt: null,
        ...(filter.status === 'needs-attention' ? { rating: { lt: 4 } } : {}),
      },
      orderBy: { receivedAt: 'desc' },
      select: REVIEW_SELECT,
    });
    return rows.map(toReviewRow);
  }

  async createReview(input: {
    branchId: string;
    contactId: string;
    platformId: string;
    requestId?: string;
    rating: number;
    text?: string;
    externalReviewId?: string;
  }): Promise<ReviewRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.review.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        contactId: input.contactId,
        platformId: input.platformId,
        requestId: input.requestId ?? null,
        rating: input.rating,
        text: input.text ?? null,
        externalReviewId: input.externalReviewId ?? null,
      },
      select: { id: true },
    });
    if (input.requestId) {
      await this.db.reviewRequest.updateMany({
        where: { id: input.requestId },
        data: { status: 'responded', respondedAt: new Date() },
      });
    }
    return this.getReview(row.id);
  }

  async getReview(id: string): Promise<ReviewRow> {
    const row = await this.db.review.findFirst({
      where: { id, deletedAt: null },
      select: REVIEW_SELECT,
    });
    if (!row) throw new NotFoundError('Review not found.');
    return toReviewRow(row);
  }
}

function toReviewRow(row: {
  id: string;
  contactId: string;
  platformId: string;
  requestId: string | null;
  rating: number;
  text: string | null;
  externalReviewId: string | null;
  receivedAt: Date;
  createdAt: Date;
  contact: { displayName: string };
  platform: { name: string; provider: string } | null;
}): ReviewRow {
  return {
    id: row.id,
    contactId: row.contactId,
    contactDisplayName: row.contact.displayName,
    platformId: row.platformId,
    platformName: row.platform?.name ?? 'Unknown',
    platformProvider: row.platform?.provider ?? 'unknown',
    requestId: row.requestId,
    rating: row.rating,
    text: row.text,
    externalReviewId: row.externalReviewId,
    receivedAt: row.receivedAt,
    createdAt: row.createdAt,
  };
}
