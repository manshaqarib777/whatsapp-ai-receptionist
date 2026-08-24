import { logger } from '@/lib/logger';
import { BroadcastService } from '@/features/broadcast/services/broadcast.service';
import { listOrganizationIds } from '@/lib/db/system-discovery.repository';

/**
 * Broadcast send worker — Milestone 14 (AD-4).
 *
 * A DB-polled worker that claims due campaigns (scheduled ≤ now, or in-flight
 * `sending`), marks their queued recipients `sent`, and advances the campaign
 * to `sent`. No Redis — the database is the queue, per ARCHITECTURE_RULES §11
 * (same pattern as the knowledge / reminders / CRM workers).
 *
 * Run with `npm run broadcast:work`. The WhatsApp send is a no-op stub in M14
 * (the real transport lands with the messaging milestone); the worker marks
 * recipients and records the outcome so the status columns are real.
 */

const POLL_INTERVAL_MS = 30_000;

export async function processDueBroadcastCampaigns(): Promise<number> {
  let processed = 0;
  for (const organizationId of await listOrganizationIds()) {
    const service = BroadcastService.forOrganization(organizationId);
    processed += await service.processDueCampaigns();
  }

  return processed;
}

export async function runBroadcastWorker(
  options: { once?: boolean } = {},
): Promise<void> {
  logger.info('broadcast send worker started');

  for (;;) {
    const processed = await processDueBroadcastCampaigns();
    if (processed > 0) {
      logger.info({ processed }, 'broadcast campaigns processed');
    }

    if (options.once) break;
    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
