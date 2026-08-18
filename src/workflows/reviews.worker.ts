import { logger } from '@/lib/logger';
import { ReviewsService } from '@/features/reviews/services/reviews.service';

/**
 * Review automation worker — Milestone 16 (AD-4).
 *
 * A DB-polled worker that, per organization, creates + sends review requests
 * for completed appointments past the grace window whose contacts have
 * consented, and sweeps sent requests whose expiry has passed into `expired`.
 * The transport is the same stub seam as the reminder worker; the status
 * columns are real.
 *
 * Run with `npm run reviews:work`.
 */

const POLL_INTERVAL_MS = 30_000;

export async function processReviewAutomation(): Promise<{
  requestsCreated: number;
  expired: number;
}> {
  const { prisma } = await import('@/lib/prisma');
  const organizations = await prisma.organization.findMany({ select: { id: true } });

  let requestsCreated = 0;
  let expired = 0;

  for (const { id: organizationId } of organizations) {
    const service = ReviewsService.forOrganization(organizationId);
    requestsCreated += await service.automateRequests();
    expired += await service.sweepExpiredRequests();
  }

  return { requestsCreated, expired };
}

export async function runReviewsWorker(options: { once?: boolean } = {}): Promise<void> {
  logger.info('review automation worker started');

  for (;;) {
    const { requestsCreated, expired } = await processReviewAutomation();
    if (requestsCreated > 0 || expired > 0) {
      logger.info({ requestsCreated, expired }, 'review automation processed');
    }

    if (options.once) break;
    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
