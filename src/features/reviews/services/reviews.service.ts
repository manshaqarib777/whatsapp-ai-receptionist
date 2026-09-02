import { ConflictError, NotFoundError, UnprocessableError } from '@/lib/errors';

import { ReviewsRepository } from '@/features/reviews/repositories/reviews.repository';
import {
  unavailableReviewRequestTransport,
  type ReviewRequestTransport,
} from './review-request-transport';

/**
 * Reviews orchestration — Milestone 16.
 *
 * The review-request lifecycle (created → sent → responded / expired), the
 * consent gate on requests, the feedback threshold, and the platform seam.
 * The Google/Facebook adapters are `unconfigured` in M16 — the real APIs need
 * OAuth credentials — so the seam is the same narrow-interface + loud-failure
 * pattern as the M12 payment gateways.
 */

/** A rating below this is surfaced as needing attention. */
export const FEEDBACK_THRESHOLD = 4;

/** How long a sent review request stays open before it expires. */
export const REQUEST_EXPIRY_DAYS = 14;

/** Completed appointments must be this old before the worker requests a review. */
export const REQUEST_GRACE_HOURS = 24;

export interface ReviewPlatformAdapter {
  readonly provider: 'google' | 'facebook';
  /** Whether real credentials are configured. */
  readonly configured: boolean;
  fetchReviews(): Promise<never>;
  verifyWebhook(): never;
}

export class UnconfiguredPlatform implements ReviewPlatformAdapter {
  constructor(readonly provider: 'google' | 'facebook') {}

  readonly configured = false;

  async fetchReviews(): Promise<never> {
    throw new Error(`${this.provider} review integration is not configured.`);
  }

  verifyWebhook(): never {
    throw new Error(`${this.provider} review integration is not configured.`);
  }
}

export const PLATFORM_ADAPTERS: readonly ReviewPlatformAdapter[] = [
  new UnconfiguredPlatform('google'),
  new UnconfiguredPlatform('facebook'),
];

export function adapterFor(provider: string): ReviewPlatformAdapter {
  const adapter = PLATFORM_ADAPTERS.find((a) => a.provider === provider);
  if (!adapter) throw new NotFoundError(`No adapter for platform "${provider}".`);
  return adapter;
}

export class ReviewsService {
  private readonly repo: ReviewsRepository;
  private readonly transport: ReviewRequestTransport;
  readonly organizationId: string;

  constructor(
    repo: ReviewsRepository,
    transport: ReviewRequestTransport = unavailableReviewRequestTransport,
  ) {
    this.repo = repo;
    this.transport = transport;
    this.organizationId = repo.organizationId;
  }

  static forOrganization(organizationId: string): ReviewsService {
    return new ReviewsService(ReviewsRepository.forOrganization(organizationId));
  }

  static forOrganizationWithTransport(
    organizationId: string,
    transport: ReviewRequestTransport,
  ): ReviewsService {
    return new ReviewsService(
      ReviewsRepository.forOrganization(organizationId),
      transport,
    );
  }

  // -------------------------------------------------------------------------
  // Platforms
  // -------------------------------------------------------------------------

  async listPlatforms() {
    const rows = await this.repo.listPlatforms();
    return rows.map((row) => {
      const adapter = adapterFor(row.provider);
      return { ...row, configured: adapter.configured };
    });
  }

  async ensurePlatforms(): Promise<void> {
    const branchId = await this.repo.resolveDefaultBranch();
    await this.repo.ensureDefaultPlatforms(branchId);
  }

  // -------------------------------------------------------------------------
  // Requests
  // -------------------------------------------------------------------------

  async listRequests(filter: { status?: string } = {}) {
    return this.repo.listRequests(filter);
  }

  async getRequest(id: string) {
    return this.repo.getRequest(id);
  }

  /**
   * Creates a review request for a completed appointment. The consent gate is
   * non-negotiable: a request for a non-consenting or opted-out contact is
   * refused (422), never silently skipped.
   */
  async createRequest(input: {
    contactId: string;
    appointmentId: string;
    platformId: string;
  }): Promise<Awaited<ReturnType<typeof this.repo.createRequest>>> {
    const branchId = await this.repo.resolveDefaultBranch();

    const appointment = await this.repo.findAppointmentWithConsent(input.appointmentId);
    if (!appointment) throw new NotFoundError('Appointment not found.');

    if (appointment.status !== 'completed') {
      throw new ConflictError('Only a completed appointment can yield a review request.');
    }
    if (appointment.contactId !== input.contactId) {
      throw new UnprocessableError('The contact does not match the appointment.');
    }
    const contact = appointment.contact;
    if (
      !contact.hasConsent ||
      contact.optedOutAt !== null ||
      contact.deletedAt !== null
    ) {
      throw new UnprocessableError('This contact has not consented to review requests.');
    }

    await this.repo.getPlatform(input.platformId);

    const expiresAt = new Date(Date.now() + REQUEST_EXPIRY_DAYS * 24 * 3_600_000);
    return this.repo.createRequest({ branchId, ...input, expiresAt });
  }

  /**
   * Lifecycle transition: `send` marks the request sent (through the transport
   * stub seam); `cancel` aborts an unsent request.
   */
  async transition(
    id: string,
    action: 'send' | 'cancel',
  ): Promise<Awaited<ReturnType<typeof this.repo.updateRequestStatus>>> {
    const request = await this.repo.getRequest(id);

    switch (action) {
      case 'send': {
        if (request.status !== 'created') {
          throw new ConflictError('Only a created request can be sent.');
        }
        await this.transport.send({ organizationId: this.organizationId, request });
        return this.repo.updateRequestStatus(id, 'sent', { sentAt: new Date() });
      }
      case 'cancel': {
        if (request.status === 'sent' || request.status === 'responded') {
          throw new ConflictError('A sent or responded request cannot be cancelled.');
        }
        if (request.status === 'cancelled' || request.status === 'expired') {
          throw new ConflictError('This request is already closed.');
        }
        return this.repo.updateRequestStatus(id, 'cancelled');
      }
      default:
        throw new UnprocessableError('Unknown transition.');
    }
  }

  /**
   * Worker step: mark sent requests whose expiry has passed as `expired`.
   */
  async sweepExpiredRequests(now = new Date()): Promise<number> {
    const expired = await this.repo.listExpiredSentRequests(now);
    for (const request of expired) {
      await this.repo.updateRequestStatus(request.id, 'expired');
    }
    return expired.length;
  }

  // -------------------------------------------------------------------------
  // Reviews
  // -------------------------------------------------------------------------

  async listReviews(filter: { status?: string } = {}) {
    const reviews = await this.repo.listReviews(filter);
    return reviews.map((review) => ({
      ...review,
      needsAttention: review.rating < FEEDBACK_THRESHOLD,
    }));
  }

  async createReview(input: {
    contactId: string;
    platformId: string;
    requestId?: string;
    rating: number;
    text?: string;
    externalReviewId?: string;
  }): Promise<Awaited<ReturnType<typeof this.repo.createReview>>> {
    if (input.rating < 1 || input.rating > 5) {
      throw new UnprocessableError('Rating must be between 1 and 5.');
    }

    const branchId = await this.repo.resolveDefaultBranch();
    await this.repo.getPlatform(input.platformId);

    // The contact must exist in the org.
    const exists = await this.repo.contactExists(input.contactId);
    if (!exists) throw new NotFoundError('Contact not found.');

    return this.repo.createReview({ branchId, ...input });
  }

  // -------------------------------------------------------------------------
  // Automation worker step
  // -------------------------------------------------------------------------

  /**
   * Creates review requests for completed appointments past the grace window
   * whose contacts have consented. Idempotent via the unique
   * `(appointmentId, platformId)` request guard.
   */
  async automateRequests(now = new Date()): Promise<number> {
    const graceBefore = new Date(now.getTime() - REQUEST_GRACE_HOURS * 3_600_000);
    const appointments = await this.repo.listEligibleAppointments(graceBefore);
    const branchId = await this.repo.resolveDefaultBranch();
    await this.repo.ensureDefaultPlatforms(branchId);
    const google = await this.repo.findPlatformByProvider('google');
    if (!google) return 0;

    let sent = 0;
    for (const request of await this.repo.listRequests({ status: 'created' })) {
      try {
        await this.transport.send({ organizationId: this.organizationId, request });
        await this.repo.updateRequestStatus(request.id, 'sent', { sentAt: now });
        sent += 1;
      } catch {
        // Durable retry: leave it created for the next worker pass.
      }
    }
    for (const appointment of appointments) {
      try {
        const request = await this.repo.createRequest({
          branchId,
          contactId: appointment.contactId,
          appointmentId: appointment.id,
          platformId: google.id,
          expiresAt: new Date(now.getTime() + REQUEST_EXPIRY_DAYS * 24 * 3_600_000),
        });
        try {
          await this.transport.send({ organizationId: this.organizationId, request });
          await this.repo.updateRequestStatus(request.id, 'sent', { sentAt: now });
          sent += 1;
        } catch {
          // Keep the durable request in `created`; a later worker pass can retry.
        }
      } catch (error) {
        // P2002 — a request already exists for this appointment+platform.
        const code = (error as { code?: string })?.code;
        if (code !== 'P2002') throw error;
      }
    }

    return sent;
  }
}
