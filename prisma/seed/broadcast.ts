import type { PrismaClient } from '@prisma/client';

import { SEED_NOW, daysFromNow, seedId } from './support';
import type { SeededTenants } from './tenants';

/**
 * Broadcast (Milestone 14).
 *
 * One segment (Riyadh, locale `en`, consented), one approved template, and
 * campaigns across the lifecycle states so the list shows every badge: a
 * cancelled draft with no recipients, a scheduled campaign due in the future,
 * and a sent campaign whose recipients are materialised with delivery
 * statuses (so analytics show real totals and rates).
 *
 * The seeded contacts already include an opted-out and a never-consented
 * contact — they are deliberately absent from the sent campaign's recipients,
 * which is what lets a demo show the consent rule being honoured.
 */

export type SeededBroadcast = Awaited<ReturnType<typeof seedBroadcast>>;

export async function seedBroadcast(
  prisma: PrismaClient,
  tenants: SeededTenants,
  riyadhContactIds: string[],
): Promise<{ campaignIds: string[]; segmentId: string; templateId: string }> {
  const campaignIds: string[] = [];

  const segment = await prisma.segment.create({
    data: {
      id: seedId('segment', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      name: 'Riyadh English speakers',
      definition: {
        locale: 'en',
        createdAtAfter: '2026-01-01T00:00:00.000Z',
      },
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });

  const template = await prisma.whatsappMessageTemplate.create({
    data: {
      id: seedId('template', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      name: 'Checkup reminder',
      language: 'en',
      metaStatus: 'approved',
      body: {
        body: 'Hi {{1}}, your appointment at Northwind Dental is coming up. Reply to confirm or reschedule.',
      },
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });

  // Cancelled draft: never scheduled, no recipients.
  await prisma.campaign.create({
    data: {
      id: seedId('campaign', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      segmentId: segment.id,
      templateId: template.id,
      name: 'Summer opening hours (draft)',
      status: 'cancelled',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });
  campaignIds.push(seedId('campaign', 1));

  // Scheduled: due after the seed's now, so the worker does not pick it up.
  await prisma.campaign.create({
    data: {
      id: seedId('campaign', 2),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      segmentId: segment.id,
      templateId: template.id,
      name: 'August checkup wave',
      status: 'scheduled',
      scheduledFor: daysFromNow(3, 10, 0),
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });
  campaignIds.push(seedId('campaign', 2));

  // Sent: recipients materialised with delivery statuses for the analytics.
  const sent = await prisma.campaign.create({
    data: {
      id: seedId('campaign', 3),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      segmentId: segment.id,
      templateId: template.id,
      name: 'July checkup reminders',
      status: 'sent',
      startedAt: daysFromNow(-5, 9, 0),
      finishedAt: daysFromNow(-5, 9, 5),
      createdAt: daysFromNow(-6),
      updatedAt: daysFromNow(-5, 9, 5),
    },
    select: { id: true },
  });
  campaignIds.push(sent.id);

  // Recipients: a subset of the Riyadh contacts, with a realistic status mix.
  // index 0 is the opted-out contact and index 1 never consented — neither may
  // appear here, and the segment evaluation enforces exactly that.
  for (const [index, contactId] of riyadhContactIds.entries()) {
    const status = (
      [
        'read',
        'delivered',
        'read',
        'delivered',
        'sent',
        'sent',
        'failed',
        'read',
      ] as const
    )[index];

    if (!status) continue;

    await prisma.campaignRecipient.create({
      data: {
        id: seedId('campaign-recipient', index + 1),
        organizationId: tenants.northwind.id,
        campaignId: sent.id,
        contactId,
        status,
        createdAt: daysFromNow(-5, 9, 1),
        updatedAt: daysFromNow(-5, 9, 3),
      },
    });
  }

  return { campaignIds, segmentId: segment.id, templateId: template.id };
}
