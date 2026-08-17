// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { AnalyticsService } from '@/features/analytics/services/analytics.service';

/**
 * Analytics integration tests — real Postgres.
 *
 * The non-negotiable: org A never sees org B's revenue, deals, appointments, or
 * contacts. Each analytic (revenue sums, funnel taper, conversion, retention,
 * bookings value, performance, weighted forecast) is exercised against the real
 * database with seeded rows.
 */

type Fixture = { orgA: string; orgB: string; branchA: string; branchB: string };

let f: Fixture;
let suffix = 0;

async function makeOrg(label: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: label, slug: `analytics-${label}-${Date.now()}-${suffix}` },
    select: { id: true },
  });
  return org.id;
}

async function makeBranch(orgId: string, label: string): Promise<string> {
  suffix += 1;
  const branch = await prisma.branch.create({
    data: {
      organizationId: orgId,
      name: label,
      slug: `analytics-${label}-${Date.now()}-${suffix}`,
      timezone: 'Asia/Riyadh',
      isDefault: true,
    },
    select: { id: true },
  });
  return branch.id;
}

function serviceFor(orgId: string): AnalyticsService {
  return AnalyticsService.forOrganization(orgId);
}

function range(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 3_600_000);
  return { from, to };
}

beforeEach(async () => {
  suffix += 1;
  const orgA = await makeOrg('A');
  const orgB = await makeOrg('B');
  f = {
    orgA,
    orgB,
    branchA: await makeBranch(orgA, 'main'),
    branchB: await makeBranch(orgB, 'main'),
  };
});

afterEach(async () => {
  for (const orgId of [f.orgA, f.orgB]) {
    await prisma.paymentEvent.deleteMany({ where: { organizationId: orgId } });
    await prisma.refund.deleteMany({ where: { organizationId: orgId } });
    await prisma.payment.deleteMany({ where: { organizationId: orgId } });
    await prisma.invoiceLineItem.deleteMany({ where: { organizationId: orgId } });
    await prisma.invoice.deleteMany({ where: { organizationId: orgId } });
    await prisma.quoteVersion.deleteMany({ where: { organizationId: orgId } });
    await prisma.quoteLineItem.deleteMany({ where: { organizationId: orgId } });
    await prisma.quote.deleteMany({ where: { organizationId: orgId } });
    await prisma.appointmentReminder.deleteMany({ where: { organizationId: orgId } });
    await prisma.appointment.deleteMany({ where: { organizationId: orgId } });
    await prisma.availabilityException.deleteMany({ where: { organizationId: orgId } });
    await prisma.availabilityRule.deleteMany({ where: { organizationId: orgId } });
    await prisma.resource.deleteMany({ where: { organizationId: orgId } });
    await prisma.service.deleteMany({ where: { organizationId: orgId } });
    await prisma.campaignRecipient.deleteMany({ where: { organizationId: orgId } });
    await prisma.campaign.deleteMany({ where: { organizationId: orgId } });
    await prisma.whatsappMessageTemplate.deleteMany({ where: { organizationId: orgId } });
    await prisma.segment.deleteMany({ where: { organizationId: orgId } });
    await prisma.deal.deleteMany({ where: { organizationId: orgId } });
    await prisma.pipelineStage.deleteMany({ where: { organizationId: orgId } });
    await prisma.pipeline.deleteMany({ where: { organizationId: orgId } });
    await prisma.conversationNote.deleteMany({ where: { organizationId: orgId } });
    await prisma.conversationLabel.deleteMany({ where: { organizationId: orgId } });
    await prisma.label.deleteMany({ where: { organizationId: orgId } });
    await prisma.message.deleteMany({ where: { organizationId: orgId } });
    await prisma.conversation.deleteMany({ where: { organizationId: orgId } });
    await prisma.whatsappAccount.deleteMany({ where: { organizationId: orgId } });
    await prisma.contact.deleteMany({ where: { organizationId: orgId } });
    await prisma.company.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Creates an invoice with the given status/amount and issuedAt in the range. */
async function makeInvoice(
  orgId: string,
  branchId: string,
  status: string,
  amount: number,
): Promise<string> {
  suffix += 1;
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumber: `+9665000${String(suffix).padStart(5, '0')}`,
      displayName: `Invoice contact ${suffix}`,
      hasConsent: true,
    },
    select: { id: true },
  });

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: orgId,
      branchId,
      contactId: contact.id,
      number: `INV-${suffix}`,
      status: status as never,
      totalAmount: amount,
      amountPaid: status === 'paid' ? amount : 0,
      subtotalAmount: amount,
      taxAmount: 0,
      currency: 'SAR',
      issuedAt: new Date(Date.now() - 5 * 24 * 3_600_000),
      paidAt: status === 'paid' ? new Date(Date.now() - 3 * 24 * 3_600_000) : null,
    },
    select: { id: true },
  });
  return invoice.id;
}

describe('analytics — revenue', () => {
  it('sums invoiced, collected, outstanding, and refunds for the org', async () => {
    await makeInvoice(f.orgA, f.branchA, 'paid', 1000);
    await makeInvoice(f.orgA, f.branchA, 'issued', 500);
    await makeInvoice(f.orgB, f.branchB, 'paid', 99_999);

    const revenue = await serviceFor(f.orgA).getRevenue(range());

    expect(revenue.invoiced).toBe(1500);
    expect(revenue.collected).toBe(1000);
    expect(revenue.outstanding).toBe(500);
  });

  it('never includes org B invoices', async () => {
    await makeInvoice(f.orgA, f.branchA, 'paid', 100);
    await makeInvoice(f.orgB, f.branchB, 'paid', 99_999);

    const revenue = await serviceFor(f.orgA).getRevenue(range());
    expect(revenue.invoiced).toBe(100);
  });
});

describe('analytics — funnels and conversion', () => {
  async function makePipeline(
    orgId: string,
    branchId: string,
  ): Promise<{ stageIds: string[] }> {
    const pipeline = await prisma.pipeline.create({
      data: {
        organizationId: orgId,
        branchId,
        name: 'P',
        isDefault: true,
      },
      select: { id: true },
    });
    const stageIds: string[] = [];
    for (const [index, probability] of ['0.1', '0.5', '1.0'].entries()) {
      const stage = await prisma.pipelineStage.create({
        data: {
          organizationId: orgId,
          pipelineId: pipeline.id,
          name: `Stage ${index + 1}`,
          position: index,
          winProbability: probability,
        },
        select: { id: true },
      });
      stageIds.push(stage.id);
    }
    return { stageIds };
  }

  it('builds the pipeline funnel with open deal counts per stage', async () => {
    const { stageIds } = await makePipeline(f.orgA, f.branchA);
    const [early, late] = stageIds;

    await prisma.deal.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        stageId: early as string,
        title: 'Deal 1',
        valueAmount: 1000,
        status: 'open',
      },
    });
    await prisma.deal.createMany({
      data: [
        {
          organizationId: f.orgA,
          branchId: f.branchA,
          stageId: late as string,
          title: 'Deal 2',
          valueAmount: 2000,
          status: 'open',
        },
        {
          organizationId: f.orgA,
          branchId: f.branchA,
          stageId: late as string,
          title: 'Deal 3',
          valueAmount: 3000,
          status: 'open',
        },
      ],
    });

    const funnels = await serviceFor(f.orgA).getFunnels();
    expect(funnels.pipeline[0]?.openDeals).toBe(1);
    expect(funnels.pipeline[1]?.openDeals).toBe(2);
  });

  it('computes the weighted forecast from stage probabilities', async () => {
    const { stageIds } = await makePipeline(f.orgA, f.branchA);
    const [early, middle, late] = stageIds;

    await prisma.deal.createMany({
      data: [
        {
          organizationId: f.orgA,
          branchId: f.branchA,
          stageId: early as string,
          title: 'Deal 1',
          valueAmount: 1000,
          status: 'open',
        },
        {
          organizationId: f.orgA,
          branchId: f.branchA,
          stageId: late as string,
          title: 'Deal 2',
          valueAmount: 2000,
          status: 'open',
        },
        {
          organizationId: f.orgA,
          branchId: f.branchA,
          stageId: middle as string,
          title: 'Deal 3',
          valueAmount: 4000,
          status: 'open',
        },
      ],
    });

    const forecast = await serviceFor(f.orgA).getForecast();

    // 1000 × 0.1 + 4000 × 0.5 + 2000 × 1.0
    expect(forecast.weighted).toBe(4100);
    expect(forecast.deals).toBe(3);
    expect(forecast.openValue).toBe(7000);
  });

  it('never includes org B deals in the forecast', async () => {
    const { stageIds } = await makePipeline(f.orgA, f.branchA);
    const { stageIds: bStages } = await makePipeline(f.orgB, f.branchB);

    await prisma.deal.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        stageId: stageIds[0] as string,
        title: 'A',
        valueAmount: 500,
        status: 'open',
      },
    });
    await prisma.deal.create({
      data: {
        organizationId: f.orgB,
        branchId: f.branchB,
        stageId: bStages[0] as string,
        title: 'B',
        valueAmount: 99_999,
        status: 'open',
      },
    });

    const forecast = await serviceFor(f.orgA).getForecast();
    expect(forecast.openValue).toBe(500);
  });
});

describe('analytics — bookings', () => {
  it('counts appointments by status and values them at service price', async () => {
    const service = await prisma.service.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        name: 'Check-up',
        durationMinutes: 30,
        priceAmount: 150,
      },
      select: { id: true },
    });

    const resource = await prisma.resource.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        kind: 'staff',
        name: 'Dr. Test',
      },
      select: { id: true },
    });

    const contact = await prisma.contact.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        phoneNumber: `+9665000${String(suffix++).padStart(5, '0')}`,
        displayName: 'Booking contact',
        hasConsent: true,
      },
      select: { id: true },
    });

    await prisma.appointment.createMany({
      data: [
        {
          organizationId: f.orgA,
          branchId: f.branchA,
          serviceId: service.id,
          resourceId: resource.id,
          contactId: contact.id,
          status: 'completed',
          startsAt: new Date(Date.now() - 2 * 24 * 3_600_000),
          endsAt: new Date(Date.now() - 2 * 24 * 3_600_000 + 1_800_000),
          timezone: 'Asia/Riyadh',
        },
        {
          organizationId: f.orgA,
          branchId: f.branchA,
          serviceId: service.id,
          resourceId: resource.id,
          contactId: contact.id,
          status: 'no_show',
          startsAt: new Date(Date.now() - 1 * 24 * 3_600_000),
          endsAt: new Date(Date.now() - 1 * 24 * 3_600_000 + 1_800_000),
          timezone: 'Asia/Riyadh',
        },
      ],
    });

    const bookings = await serviceFor(f.orgA).getBookings(range());

    expect(bookings.total).toBe(2);
    expect(bookings.value).toBe(300);
    expect(bookings.noShowCount).toBe(1);
    expect(bookings.noShowRate).toBe(50);
  });
});

describe('analytics — retention', () => {
  it('counts lifecycle stages and active-of-created for the org', async () => {
    await prisma.contact.createMany({
      data: [
        {
          organizationId: f.orgA,
          branchId: f.branchA,
          phoneNumber: `+9665000${String(suffix++).padStart(5, '0')}`,
          displayName: 'A1',
          lifecycleStage: 'customer',
          hasConsent: true,
          createdAt: new Date(Date.now() - 10 * 24 * 3_600_000),
        },
        {
          organizationId: f.orgA,
          branchId: f.branchA,
          phoneNumber: `+9665000${String(suffix++).padStart(5, '0')}`,
          displayName: 'A2',
          lifecycleStage: 'lead',
          hasConsent: true,
          createdAt: new Date(Date.now() - 10 * 24 * 3_600_000),
        },
        {
          organizationId: f.orgB,
          branchId: f.branchB,
          phoneNumber: `+9665000${String(suffix++).padStart(5, '0')}`,
          displayName: 'B1',
          lifecycleStage: 'customer',
          hasConsent: true,
          createdAt: new Date(Date.now() - 10 * 24 * 3_600_000),
        },
      ],
    });

    const retention = await serviceFor(f.orgA).getRetention(range());

    expect(
      retention.lifecycle.find((row) => row.lifecycleStage === 'customer')?.count,
    ).toBe(1);
    expect(retention.lifecycle.find((row) => row.lifecycleStage === 'lead')?.count).toBe(
      1,
    );
    expect(retention.createdInRange).toBe(2);
  });
});

describe('analytics — performance', () => {
  it('counts conversations, escalations, and campaign deliveries per org', async () => {
    const account = await prisma.whatsappAccount.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        phoneNumberId: `wa-${suffix++}`,
        wabaId: `waba-${suffix}`,
        displayPhoneNumber: `+9665000${String(suffix).padStart(5, '0')}`,
        accessTokenRef: 'ref-test',
      },
      select: { id: true },
    });

    const contact = await prisma.contact.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        phoneNumber: `+9665000${String(suffix++).padStart(5, '0')}`,
        displayName: 'C',
        hasConsent: true,
      },
      select: { id: true },
    });

    await prisma.conversation.createMany({
      data: [
        {
          organizationId: f.orgA,
          branchId: f.branchA,
          contactId: contact.id,
          whatsappAccountId: account.id,
          isEscalated: true,
        },
        {
          organizationId: f.orgA,
          branchId: f.branchA,
          contactId: contact.id,
          whatsappAccountId: account.id,
          isEscalated: false,
        },
      ],
    });

    const performance = await serviceFor(f.orgA).getPerformance(range());

    expect(performance.conversations).toBe(2);
    expect(performance.escalatedCount).toBe(1);
    expect(performance.escalationRate).toBe(50);
  });
});
