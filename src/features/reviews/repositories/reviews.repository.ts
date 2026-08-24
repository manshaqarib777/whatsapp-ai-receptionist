import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { ReviewsBaseRepository } from './reviews.base';
import { ReviewEntriesRepository } from './review-entries.repository';
import { ReviewPlatformsRepository } from './review-platforms.repository';
import type { ReviewPlatformRow, ReviewRequestRow, ReviewRow } from './reviews.types';

/**
 * Reviews data access — Milestone 16.
 *
 * Platforms, requests, and reviews. Every query runs through the scoped client;
 * writes derive a branch scope from the default branch. The review request
 * lifecycle and the consent gate live in the service; this layer is raw rows.
 */

export class ReviewsRepository extends ReviewsBaseRepository {
  private readonly entries: ReviewEntriesRepository;
  private readonly platforms: ReviewPlatformsRepository;

  constructor(scope: Scope) {
    super(scope);
    this.entries = new ReviewEntriesRepository(scope);
    this.platforms = new ReviewPlatformsRepository(scope);
  }

  // -------------------------------------------------------------------------
  // Platforms
  // -------------------------------------------------------------------------

  async listPlatforms(): Promise<ReviewPlatformRow[]> {
    return this.platforms.listPlatforms();
  }

  async getPlatform(id: string): Promise<ReviewPlatformRow> {
    return this.platforms.getPlatform(id);
  }

  /** Finds a platform by provider, or null. */
  async findPlatformByProvider(
    provider: 'google' | 'facebook',
  ): Promise<ReviewPlatformRow | null> {
    return this.platforms.findPlatformByProvider(provider);
  }

  async createPlatform(input: {
    branchId: string;
    name: string;
    provider: 'google' | 'facebook';
    isConnected: boolean;
  }): Promise<ReviewPlatformRow> {
    return this.platforms.createPlatform(input);
  }

  /** Creates the Google and Facebook platform rows if absent (idempotent). */
  async ensureDefaultPlatforms(branchId: string): Promise<void> {
    return this.platforms.ensureDefaultPlatforms(branchId);
  }

  // -------------------------------------------------------------------------
  // Requests
  // -------------------------------------------------------------------------

  async listRequests(filter: { status?: string } = {}): Promise<ReviewRequestRow[]> {
    const rows = await this.db.reviewRequest.findMany({
      where: {
        deletedAt: null,
        ...(filter.status ? { status: filter.status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        contactId: true,
        appointmentId: true,
        platformId: true,
        status: true,
        sentAt: true,
        respondedAt: true,
        expiresAt: true,
        createdAt: true,
        contact: { select: { displayName: true } },
        appointment: { select: { startsAt: true } },
        platform: { select: { name: true, provider: true } },
      },
    });
    return rows.map(toRequestRow);
  }

  async getRequest(id: string): Promise<ReviewRequestRow> {
    const row = await this.db.reviewRequest.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        contactId: true,
        appointmentId: true,
        platformId: true,
        status: true,
        sentAt: true,
        respondedAt: true,
        expiresAt: true,
        createdAt: true,
        contact: { select: { displayName: true } },
        appointment: { select: { startsAt: true } },
        platform: { select: { name: true, provider: true } },
      },
    });
    if (!row) throw new NotFoundError('Review request not found.');
    return toRequestRow(row);
  }

  async createRequest(input: {
    branchId: string;
    contactId: string;
    appointmentId: string;
    platformId: string;
    expiresAt?: Date;
  }): Promise<ReviewRequestRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.reviewRequest.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        contactId: input.contactId,
        appointmentId: input.appointmentId,
        platformId: input.platformId,
        expiresAt: input.expiresAt ?? null,
      },
      select: { id: true },
    });
    return this.getRequest(row.id);
  }

  async updateRequestStatus(
    id: string,
    status: 'created' | 'sent' | 'responded' | 'expired' | 'cancelled',
    extras: { sentAt?: Date; respondedAt?: Date; expiresAt?: Date } = {},
  ): Promise<ReviewRequestRow> {
    await this.db.reviewRequest.updateMany({
      where: { id },
      data: {
        status,
        ...(extras.sentAt !== undefined ? { sentAt: extras.sentAt } : {}),
        ...(extras.respondedAt !== undefined ? { respondedAt: extras.respondedAt } : {}),
        ...(extras.expiresAt !== undefined ? { expiresAt: extras.expiresAt } : {}),
        version: { increment: 1 },
      },
    });
    return this.getRequest(id);
  }

  /** Requests in `sent` whose expiry has passed, for the worker sweep. */
  async listExpiredSentRequests(now: Date): Promise<ReviewRequestRow[]> {
    const rows = await this.db.reviewRequest.findMany({
      where: {
        deletedAt: null,
        status: 'sent',
        expiresAt: { lte: now },
      },
      select: {
        id: true,
        contactId: true,
        appointmentId: true,
        platformId: true,
        status: true,
        sentAt: true,
        respondedAt: true,
        expiresAt: true,
        createdAt: true,
        contact: { select: { displayName: true } },
        appointment: { select: { startsAt: true } },
        platform: { select: { name: true, provider: true } },
      },
    });
    return rows.map(toRequestRow);
  }

  /**
   * Completed appointments past the grace window with no review request yet —
   * the automation worker's input. Scoped to the org, all branches.
   */
  async listEligibleAppointments(
    graceBefore: Date,
    limit = 50,
  ): Promise<{ id: string; contactId: string; endsAt: Date; branchId: string }[]> {
    const rows = await this.db.appointment.findMany({
      where: {
        status: 'completed',
        endsAt: { lte: graceBefore },
        reviewRequests: { none: {} },
        contact: { hasConsent: true, optedOutAt: null, deletedAt: null },
      },
      orderBy: { endsAt: 'asc' },
      take: limit,
      select: { id: true, contactId: true, endsAt: true, branchId: true },
    });
    return rows;
  }

  /**
   * The appointment + consent context a request creation needs, org-scoped.
   * Returns null when the appointment is missing or soft-deleted.
   */
  async findAppointmentWithConsent(id: string): Promise<{
    id: string;
    status: string;
    contactId: string;
    contact: { hasConsent: boolean; optedOutAt: Date | null; deletedAt: Date | null };
  } | null> {
    const row = await this.db.appointment.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        contactId: true,
        contact: { select: { hasConsent: true, optedOutAt: true, deletedAt: true } },
      },
    });
    return row;
  }

  /** Whether a contact exists and is not soft-deleted, org-scoped. */
  async contactExists(id: string): Promise<boolean> {
    const row = await this.db.contact.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  // -------------------------------------------------------------------------
  // Reviews
  // -------------------------------------------------------------------------

  async listReviews(filter: { status?: string } = {}): Promise<ReviewRow[]> {
    return this.entries.listReviews(filter);
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
    return this.entries.createReview(input);
  }

  async getReview(id: string): Promise<ReviewRow> {
    return this.entries.getReview(id);
  }
}

function toRequestRow(row: {
  id: string;
  contactId: string;
  appointmentId: string;
  platformId: string;
  status: string;
  sentAt: Date | null;
  respondedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  contact: { displayName: string };
  appointment: { startsAt: Date } | null;
  platform: { name: string; provider: string } | null;
}): ReviewRequestRow {
  return {
    id: row.id,
    contactId: row.contactId,
    contactDisplayName: row.contact.displayName,
    appointmentId: row.appointmentId,
    appointmentStartsAt: row.appointment?.startsAt ?? null,
    platformId: row.platformId,
    platformName: row.platform?.name ?? 'Unknown',
    platformProvider: row.platform?.provider ?? 'unknown',
    status: row.status as ReviewRequestRow['status'],
    sentAt: row.sentAt,
    respondedAt: row.respondedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}
