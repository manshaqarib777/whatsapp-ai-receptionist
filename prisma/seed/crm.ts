import type { PrismaClient } from '@prisma/client';

import { SEED_NOW, daysFromNow, seedId, type Random } from './support';
import type { SeededContacts } from './contacts';
import type { SeededTenants } from './tenants';

/**
 * Pipeline, deals, tags, activities, tasks, notifications.
 *
 * DATABASE_RULES.md → Seed Data: "Enough CRM, quote, and invoice records that charts
 * and funnels render meaningfully."
 *
 * "Meaningfully" is doing work in that sentence. A funnel needs deals distributed
 * across stages with a believable taper — five stages with two deals each renders as a
 * rectangle and tells a reviewer nothing about whether the chart is correct.
 */

const STAGES = [
  { name: 'New enquiry', probability: '0.100' },
  { name: 'Qualified', probability: '0.300' },
  { name: 'Quote sent', probability: '0.600' },
  { name: 'Negotiation', probability: '0.800' },
  { name: 'Won', probability: '1.000' },
] as const;

/** A taper, so the funnel looks like a funnel. */
const DEALS_PER_STAGE = [9, 6, 4, 2, 3] as const;

const TAGS = [
  { name: 'Insurance', color: 'info' },
  { name: 'Referral', color: 'success' },
  { name: 'Price sensitive', color: 'warning' },
] as const;

export type SeededCrm = Awaited<ReturnType<typeof seedCrm>>;

export async function seedCrm(
  prisma: PrismaClient,
  tenants: SeededTenants,
  contacts: SeededContacts,
  random: Random,
) {
  const pipeline = await prisma.pipeline.create({
    data: {
      id: seedId('pipeline', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      name: 'Treatment plans',
      isDefault: true,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  const stageIds: string[] = [];

  for (const [index, stage] of STAGES.entries()) {
    const row = await prisma.pipelineStage.create({
      data: {
        id: seedId('stage', index + 1),
        organizationId: tenants.northwind.id,
        pipelineId: pipeline.id,
        name: stage.name,
        position: index,
        winProbability: stage.probability,
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });
    stageIds.push(row.id);
  }

  const tagIds: string[] = [];

  for (const [index, tag] of TAGS.entries()) {
    const row = await prisma.tag.create({
      data: {
        id: seedId('tag', index + 1),
        organizationId: tenants.northwind.id,
        branchId: tenants.northwind.riyadh,
        name: tag.name,
        color: tag.color,
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });
    tagIds.push(row.id);
  }

  const dealIds: string[] = [];
  let dealNumber = 0;

  for (const [stageIndex, count] of DEALS_PER_STAGE.entries()) {
    for (let n = 0; n < count; n += 1) {
      dealNumber += 1;
      const contactId =
        contacts.riyadhContacts[dealNumber % contacts.riyadhContacts.length];
      const isWon = stageIndex === STAGES.length - 1;
      // Closed dates spread backwards so a "revenue this month" chart has a slope
      // rather than a single spike.
      const ageDays = random.int(2, 75);

      const deal = await prisma.deal.create({
        data: {
          id: seedId('deal', dealNumber),
          organizationId: tenants.northwind.id,
          branchId: tenants.northwind.riyadh,
          contactId: contactId ?? null,
          companyId: dealNumber % 4 === 0 ? (contacts.companies[0] as string) : null,
          stageId: stageIds[stageIndex] as string,
          title: `${STAGES[stageIndex]?.name} — case ${dealNumber}`,
          valueAmount: `${random.int(400, 9000)}.0000`,
          valueCurrency: 'SAR',
          status: isWon ? 'won' : 'open',
          closedAt: isWon ? daysFromNow(-ageDays) : null,
          createdAt: daysFromNow(-ageDays - random.int(1, 20)),
          updatedAt: SEED_NOW,
        },
      });

      dealIds.push(deal.id);

      if (dealNumber % 3 === 0) {
        await prisma.taggable.create({
          data: {
            id: seedId('taggable', dealNumber),
            organizationId: tenants.northwind.id,
            tagId: tagIds[dealNumber % tagIds.length] as string,
            taggableType: 'deal',
            taggableId: deal.id,
            createdAt: SEED_NOW,
          },
        });
      }

      await prisma.activity.create({
        data: {
          id: seedId('activity', dealNumber),
          organizationId: tenants.northwind.id,
          branchId: tenants.northwind.riyadh,
          subjectType: 'deal',
          subjectId: deal.id,
          kind: n === 0 ? 'stage_change' : 'note',
          actorId: tenants.staff.member,
          body:
            n === 0 ? `Moved to ${STAGES[stageIndex]?.name}` : 'Followed up by phone.',
          createdAt: daysFromNow(-ageDays, 10, n),
        },
      });
    }
  }

  // A few lost deals. Without them a conversion rate is 100%, which is not a number
  // anybody should see on a dashboard.
  for (let n = 0; n < 5; n += 1) {
    dealNumber += 1;
    await prisma.deal.create({
      data: {
        id: seedId('deal', dealNumber),
        organizationId: tenants.northwind.id,
        branchId: tenants.northwind.riyadh,
        contactId: contacts.riyadhContacts[n % contacts.riyadhContacts.length] ?? null,
        stageId: stageIds[random.int(1, 3)] as string,
        title: `Lost — case ${dealNumber}`,
        valueAmount: `${random.int(300, 4000)}.0000`,
        valueCurrency: 'SAR',
        status: 'lost',
        closedAt: daysFromNow(-random.int(5, 60)),
        createdAt: daysFromNow(-random.int(61, 120)),
        updatedAt: SEED_NOW,
      },
    });
  }

  await seedWork(prisma, tenants);
  await seedBeaconCrm(prisma, tenants);

  return { pipeline: pipeline.id, stageIds, tagIds, dealIds };
}

/**
 * Cross-tenant beacon: a deal and a task in the second org. The isolation
 * integration test uses it to prove org A never sees org B's CRM rows.
 */
async function seedBeaconCrm(prisma: PrismaClient, tenants: SeededTenants) {
  const pipeline = await prisma.pipeline.create({
    data: {
      id: seedId('beacon-pipeline', 1),
      organizationId: tenants.beacon.id,
      branchId: tenants.beacon.main,
      name: 'Vehicle sales',
      isDefault: true,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  const stage = await prisma.pipelineStage.create({
    data: {
      id: seedId('beacon-stage', 1),
      organizationId: tenants.beacon.id,
      pipelineId: pipeline.id,
      name: 'Enquiry',
      position: 0,
      winProbability: '0.200',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  await prisma.deal.create({
    data: {
      id: seedId('beacon-deal', 1),
      organizationId: tenants.beacon.id,
      branchId: tenants.beacon.main,
      stageId: stage.id,
      title: 'Fleet sale — Northstar Logistics',
      valueAmount: '250000.0000',
      valueCurrency: 'GBP',
      status: 'open',
      createdAt: daysFromNow(-3),
      updatedAt: SEED_NOW,
    },
  });

  await prisma.task.create({
    data: {
      id: seedId('beacon-task', 1),
      organizationId: tenants.beacon.id,
      branchId: tenants.beacon.main,
      title: 'Prepare fleet proposal',
      status: 'open',
      createdAt: daysFromNow(-2),
      updatedAt: SEED_NOW,
    },
  });
}

/** Tasks and notifications — Milestone 5's dashboard, seeded here with the schema. */
async function seedWork(prisma: PrismaClient, tenants: SeededTenants) {
  const tasks = [
    {
      title: 'Call back about the crown fitting',
      dueOffset: -2,
      status: 'open' as const,
    },
    {
      title: 'Send revised quote to Alrajhi Logistics',
      dueOffset: 0,
      status: 'open' as const,
    },
    { title: 'Order replacement parts', dueOffset: 3, status: 'in_progress' as const },
    { title: 'Confirm Thursday reschedules', dueOffset: 5, status: 'open' as const },
    { title: 'File insurance paperwork', dueOffset: -9, status: 'done' as const },
  ];

  for (const [index, task] of tasks.entries()) {
    await prisma.task.create({
      data: {
        id: seedId('task', index + 1),
        organizationId: tenants.northwind.id,
        branchId: tenants.northwind.riyadh,
        assigneeId: index % 2 === 0 ? tenants.staff.member : tenants.staff.admin,
        title: task.title,
        // One overdue and one due today, so a dashboard's urgency states are visible
        // rather than theoretical.
        dueAt: daysFromNow(task.dueOffset, 17),
        status: task.status,
        createdAt: daysFromNow(task.dueOffset - 5),
        updatedAt: SEED_NOW,
      },
    });
  }

  const notifications = [
    {
      kind: 'conversation.escalated',
      title: 'Conversation escalated to you',
      read: false,
    },
    {
      kind: 'appointment.cancelled',
      title: 'Appointment cancelled by customer',
      read: false,
    },
    { kind: 'invoice.paid', title: 'Invoice INV-1003 paid', read: true },
  ];

  for (const [index, n] of notifications.entries()) {
    await prisma.notification.create({
      data: {
        id: seedId('notification', index + 1),
        organizationId: tenants.northwind.id,
        userId: tenants.staff.member,
        kind: n.kind,
        title: n.title,
        readAt: n.read ? daysFromNow(-1) : null,
        createdAt: daysFromNow(-index, 8),
      },
    });
  }
}
