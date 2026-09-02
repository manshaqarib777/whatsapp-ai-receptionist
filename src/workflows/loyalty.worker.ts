import { logger } from '@/lib/logger';
import { LoyaltyService } from '@/features/loyalty/services/loyalty.service';
import { listOrganizationIds } from '@/lib/db/system-discovery.repository';

/**
 * Loyalty earn worker — Milestone 17 (AD-4).
 *
 * A DB-polled worker that, per organization, finds paid invoices that have not
 * yet earned points, credits the contact's loyalty account (creating it on
 * first earn), and resolves referral bonuses. Idempotent via the unique
 * (invoiceId, kind) transaction guard — a re-run cannot double-award.
 *
 * Run with `npm run loyalty:work`.
 */

const POLL_INTERVAL_MS = 30_000;

export async function processLoyaltyEarnings(): Promise<number> {
  let earned = 0;
  for (const organizationId of await listOrganizationIds()) {
    const service = LoyaltyService.forOrganization(organizationId);
    earned += await service.processEarnings();
  }

  return earned;
}

export async function runLoyaltyWorker(options: { once?: boolean } = {}): Promise<void> {
  logger.info('loyalty earn worker started');

  for (;;) {
    const earned = await processLoyaltyEarnings();
    if (earned > 0) {
      logger.info({ earned }, 'loyalty points processed');
    }

    if (options.once) break;
    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
