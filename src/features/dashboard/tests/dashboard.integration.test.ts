import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DashboardRepository } from '@/features/dashboard/repositories/dashboard.repository';
import { prisma } from '@/lib/prisma';

/**
 * Dashboard repository integration — real Postgres, seeded shape.
 *
 * The dashboard is Milestone 5's highest-value read surface: every widget pulls
 * org-level aggregates, and a missed scope is a security incident (SECURITY_RULES.md).
 * These tests mirror the seed's shapes (Northwind's invoice states, response-time
 * message pairs, per-org phone numbers) with fully controlled fixtures, and assert
 * the isolation rule the plan calls out explicitly: org A never sees org B.
 *
 * The date anchor is fixed so range math is deterministic, and every date is past —
 * the dashboard's "today" is whatever real clock the test runs on, so fixture data
 * must not leak into "upcoming" results.
 */

/** Anchor for every relative date. 2026-08-12 matches today's real date closely
 * enough for range math while remaining fixed. */
const NOW = new Date('2026-08-12T00:00:00.000Z');
const DAY = 86_400_000;

type Fixture = {
  orgA: string;
  orgB: string;
  branchA: string;
  branchB: string;
  contactA: string;
  contactB: string;
  userA: string;
  userB: string;
};

let f: Fixture;
let suffix = 0;

async function makeOrg(orgLabel: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: orgLabel, slug: `${orgLabel}-${Date.now()}-${suffix}` },
    select: { id: true },
  });
  return org.id;
}

async function makeBranch(orgId: string, label: string, isDefault: boolean): Promise<string> {
  const branch = await prisma.branch.create({
    data: {
      organizationId: orgId,
      name: label,
      slug: `${label}-${Date.now()}-${suffix}`,
      timezone: 'Asia/Riyadh',
      isDefault,
    },
    select: { id: true },
  });
  return branch.id;
}

async function makeContact(orgId: string, branchId: string, phone: string): Promise<string> {
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumber: phone,
      displayName: `Contact ${phone}`,
    },
    select: { id: true },
  });
  return contact.id;
}

async function makeUser(label: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      name: `Dashboard ${label}`,
      email: `dash-${label}-${Date.now()}-${suffix}@test.local`,
      emailVerified: true,
    },
    select: { id: true },
  });
  return user.id;
}

async function makeWhatsappAccount(orgId: string, branchId: string): Promise<string> {
  suffix += 1;
  const account = await prisma.whatsappAccount.create({
    data: {
      organizationId: orgId,
      branchId,
      // phoneNumberId is globally unique — it is the webhook's tenant key.
      phoneNumberId: `fixture-pnid-${Date.now()}-${suffix}`,
      wabaId: `fixture-waba-${suffix}`,
      displayPhoneNumber: '+966500000000',
      accessTokenRef: 'secret://fixture',
      status: 'active',
    },
    select: { id: true },
  });
  return account.id;
}

async function makeConversation(
  orgId: string,
  branchId: string,
  contactId: string,
  waId: string,
  createdAt: Date,
): Promise<string> {
  const conversation = await prisma.conversation.create({
    data: {
      organizationId: orgId,
      branchId,
      contactId,
      whatsappAccountId: waId,
      status: 'open',
      createdAt,
      lastMessageAt: createdAt,
    },
    select: { id: true },
  });
  return conversation.id;
}

beforeEach(async () => {
  const orgA = await makeOrg('dash-a');
  const orgB = await makeOrg('dash-b');

  const branchA = await makeBranch(orgA, 'a-main', true);
  const branchB = await makeBranch(orgB, 'b-main', true);

  const contactA = await makeContact(orgA, branchA, '+966500000001');
  const contactB = await makeContact(orgB, branchB, '+966500000002');

  const userA = await makeUser('a');
  const userB = await makeUser('b');

  f = { orgA, orgB, branchA, branchB, contactA, contactB, userA, userB };
});

afterEach(async () => {
  // Erase everything the fixtures created, org by org. Contacts cascade from
  // nothing, so they must go before the orgs; notifications cascade with orgs.
  for (const orgId of [f.orgA, f.orgB]) {
    await prisma.conversation.deleteMany({ where: { organizationId: orgId } });
    await prisma.appointment.deleteMany({ where: { organizationId: orgId } });
    await prisma.invoice.deleteMany({ where: { organizationId: orgId } });
    await prisma.deal.deleteMany({ where: { organizationId: orgId } });
    await prisma.pipelineStage.deleteMany({ where: { organizationId: orgId } });
    await prisma.pipeline.deleteMany({ where: { organizationId: orgId } });
    await prisma.activity.deleteMany({ where: { organizationId: orgId } });
    await prisma.notification.deleteMany({ where: { organizationId: orgId } });
    await prisma.whatsappAccount.deleteMany({ where: { organizationId: orgId } });
    await prisma.resource.deleteMany({ where: { organizationId: orgId } });
    await prisma.service.deleteMany({ where: { organizationId: orgId } });
    await prisma.contact.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
  await prisma.user.deleteMany({ where: { id: { in: [f.userA, f.userB] } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

function repoFor(orgId: string): DashboardRepository {
  return DashboardRepository.forOrganization(orgId);
}

/** A fixed 30-day range ending at the anchor, mirroring rangeToDates('30d'). */
const RANGE = {
  from: new Date(NOW.getTime() - 29 * DAY),
  to: new Date(NOW.getTime() + DAY - 1),
};

describe('conversation KPIs', () => {
  it('counts conversations created inside the range only', async () => {
    const repoA = repoFor(f.orgA);
    const repoB = repoFor(f.orgB);

    const waA = await makeWhatsappAccount(f.orgA, f.branchA);
    const waB = await makeWhatsappAccount(f.orgB, f.branchB);

    // Org A: two inside, one outside. Org B: one inside.
    await makeConversation(f.orgA, f.branchA, f.contactA, waA, RANGE.from);
    await makeConversation(f.orgA, f.branchA, f.contactA, waA, new Date(RANGE.to.getTime() - 1000));
    await makeConversation(f.orgA, f.branchA, f.contactA, waA, new Date(NOW.getTime() - 120 * DAY));
    await makeConversation(f.orgB, f.branchB, f.contactB, waB, RANGE.from);

    await expect(repoA.countNewConversations(RANGE)).resolves.toBe(2);
    await expect(repoB.countNewConversations(RANGE)).resolves.toBe(1);
  });

  it('returns zero for an org with no conversations in the range', async () => {
    await expect(repoFor(f.orgB).countNewConversations(RANGE)).resolves.toBe(0);
  });
});

describe('response time aggregation', () => {
  async function seedConversationWithGap(orgId: string, gapMinutes: number): Promise<void> {
    const wa = await makeWhatsappAccount(orgId, f.orgA === orgId ? f.branchA : f.branchB);
    const contact = orgId === f.orgA ? f.contactA : f.contactB;
    const conv = await makeConversation(orgId, orgId === f.orgA ? f.branchA : f.branchB, contact, wa, RANGE.from);

    const inboundAt = new Date(RANGE.from.getTime() + 60_000);
    await prisma.message.create({
      data: {
        organizationId: orgId,
        conversationId: conv,
        direction: 'inbound',
        authorType: 'contact',
        contentType: 'text',
        body: 'Hello',
        createdAt: inboundAt,
      },
    });
    await prisma.message.create({
      data: {
        organizationId: orgId,
        conversationId: conv,
        direction: 'outbound',
        authorType: 'agent',
        contentType: 'text',
        body: 'Hi',
        createdAt: new Date(inboundAt.getTime() + gapMinutes * 60_000),
      },
    });
  }

  it('averages the inbound→outbound gap across conversations', async () => {
    await seedConversationWithGap(f.orgA, 2); // 120s
    await seedConversationWithGap(f.orgA, 4); // 240s

    const result = await repoFor(f.orgA).averageResponseTimeSeconds(RANGE);

    expect(result).not.toBeNull();
    expect(result).toBeCloseTo(180, 5);
  });

  it('returns null when no conversation has a reply', async () => {
    const wa = await makeWhatsappAccount(f.orgA, f.branchA);
    await makeConversation(f.orgA, f.branchA, f.contactA, wa, RANGE.from);
    // No messages at all — nothing to measure.
    await expect(repoFor(f.orgA).averageResponseTimeSeconds(RANGE)).resolves.toBeNull();
  });
});

describe('open revenue', () => {
  async function seedInvoice(
    orgId: string,
    status: string,
    totalAmount: number,
    issuedAt: Date,
  ): Promise<void> {
    const branch = orgId === f.orgA ? f.branchA : f.branchB;
    const contact = orgId === f.orgA ? f.contactA : f.contactB;
    await prisma.invoice.create({
      data: {
        organizationId: orgId,
        branchId: branch,
        contactId: contact,
        number: `INV-F-${Date.now()}-${suffix++}`,
        status: status as never,
        totalAmount,
        issuedAt,
      },
    });
  }

  it('sums only issued/partially-paid/overdue invoices', async () => {
    await seedInvoice(f.orgA, 'issued', 100, RANGE.from);
    await seedInvoice(f.orgA, 'partially_paid', 50, RANGE.from);
    await seedInvoice(f.orgA, 'overdue', 25, RANGE.from);
    await seedInvoice(f.orgA, 'paid', 999, RANGE.from);
    await seedInvoice(f.orgA, 'draft', 999, RANGE.from);
    await seedInvoice(f.orgA, 'void', 999, RANGE.from);

    await expect(repoFor(f.orgA).openRevenueAmount()).resolves.toBe(175);
  });

  it('ignores invoices from another organization', async () => {
    await seedInvoice(f.orgA, 'issued', 100, RANGE.from);
    await seedInvoice(f.orgB, 'issued', 999, RANGE.from);

    await expect(repoFor(f.orgA).openRevenueAmount()).resolves.toBe(100);
    await expect(repoFor(f.orgB).openRevenueAmount()).resolves.toBe(999);
  });

  it('computes open revenue as of a past date', async () => {
    await seedInvoice(f.orgA, 'issued', 100, new Date(NOW.getTime() - 40 * DAY));
    await seedInvoice(f.orgA, 'issued', 50, new Date(NOW.getTime() - 10 * DAY));

    // As of 20 days ago, only the first invoice existed.
    await expect(
      repoFor(f.orgA).openRevenueAsOf(new Date(NOW.getTime() - 20 * DAY)),
    ).resolves.toBe(100);
  });
});

describe('deals KPI', () => {
  async function seedDeal(orgId: string, status: string, createdAt: Date): Promise<void> {
    const branch = orgId === f.orgA ? f.branchA : f.branchB;

    const pipeline = await prisma.pipeline.create({
      data: {
        organizationId: orgId,
        branchId: branch,
        name: `Fixture pipeline ${suffix++}`,
        isDefault: true,
      },
      select: { id: true },
    });
    const stage = await prisma.pipelineStage.create({
      data: {
        organizationId: orgId,
        pipelineId: pipeline.id,
        name: 'New',
        position: 0,
      },
      select: { id: true },
    });

    await prisma.deal.create({
      data: {
        organizationId: orgId,
        branchId: branch,
        title: `Deal ${suffix++}`,
        stageId: stage.id,
        status: status as never,
        createdAt,
      },
    });
  }

  it('counts only open deals created in the range', async () => {
    await seedDeal(f.orgA, 'open', RANGE.from);
    await seedDeal(f.orgA, 'open', new Date(RANGE.to.getTime() - 1000));
    await seedDeal(f.orgA, 'won', RANGE.from);
    await seedDeal(f.orgA, 'lost', RANGE.from);
    await seedDeal(f.orgA, 'open', new Date(NOW.getTime() - 120 * DAY));

    await expect(repoFor(f.orgA).countOpenDealsIn(RANGE)).resolves.toBe(2);
  });
});

describe('conversation series', () => {
  it('collapses same-day rows into one bucket with the summed count', async () => {
    const wa = await makeWhatsappAccount(f.orgA, f.branchA);
    await makeConversation(f.orgA, f.branchA, f.contactA, wa, RANGE.from);
    await makeConversation(f.orgA, f.branchA, f.contactA, wa, RANGE.from);

    const series = await repoFor(f.orgA).conversationSeries(RANGE);

    expect(series).toHaveLength(1); // both land on the same day
    expect(series[0]?.count).toBe(2);
  });
});

describe('row-list reads', () => {
  it('lists recent conversations most-recent-first, excluding archived', async () => {
    const wa = await makeWhatsappAccount(f.orgA, f.branchA);
    const waB = await makeWhatsappAccount(f.orgB, f.branchB);

    const first = await makeConversation(f.orgA, f.branchA, f.contactA, wa, new Date(NOW.getTime() - 2 * DAY));
    const second = await makeConversation(f.orgA, f.branchA, f.contactA, wa, new Date(NOW.getTime() - 1 * DAY));
    const archived = await prisma.conversation.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        contactId: f.contactA,
        whatsappAccountId: wa,
        status: 'archived',
        createdAt: new Date(NOW.getTime() - 3 * DAY),
        lastMessageAt: new Date(NOW.getTime() - 3 * DAY),
      },
      select: { id: true },
    });
    // Org B's conversation must never surface.
    await makeConversation(f.orgB, f.branchB, f.contactB, waB, new Date(NOW.getTime() - 1 * DAY));

    const recent = await repoFor(f.orgA).recentConversations(5);

    expect(recent.map((c) => c.id)).toEqual([second, first]);
    expect(recent.map((c) => c.id)).not.toContain(archived.id);
    expect(recent[0]?.contactDisplayName).toBe(`Contact ${f.contactA && '+966500000001'}`);
  });

  it('limits upcoming appointments to booked/confirmed and sorts by start', async () => {
    const service = await prisma.service.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        name: 'Fixture service',
        durationMinutes: 30,
      },
      select: { id: true },
    });
    const resource = await prisma.resource.create({
      data: { organizationId: f.orgA, branchId: f.branchA, name: 'Room 1' },
      select: { id: true },
    });

    async function seedAppointment(startsAt: Date, status: string): Promise<string> {
      const appointment = await prisma.appointment.create({
        data: {
          organizationId: f.orgA,
          branchId: f.branchA,
          contactId: f.contactA,
          serviceId: service.id,
          resourceId: resource.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 30 * 60_000),
          timezone: 'Asia/Riyadh',
          status: status as never,
        },
        select: { id: true },
      });
      return appointment.id;
    }

    const later = await seedAppointment(new Date(NOW.getTime() + 3 * DAY), 'booked');
    const sooner = await seedAppointment(new Date(NOW.getTime() + 1 * DAY), 'confirmed');
    await seedAppointment(new Date(NOW.getTime() + 2 * DAY), 'cancelled');

    const upcoming = await repoFor(f.orgA).upcomingAppointments(5);

    expect(upcoming.map((a) => a.id)).toEqual([sooner, later]);
    expect(upcoming.map((a) => a.contactDisplayName)).toEqual([
      'Contact +966500000001',
      'Contact +966500000001',
    ]);
  });

  it('returns an empty activity feed for a tenant with none', async () => {
    await expect(repoFor(f.orgB).activityFeed(8)).resolves.toEqual([]);
  });
});

describe('tenant isolation — the non-negotiable', () => {
  it('org A never sees org B rows in any read', async () => {
    const waA = await makeWhatsappAccount(f.orgA, f.branchA);
    const waB = await makeWhatsappAccount(f.orgB, f.branchB);

    const convA = await makeConversation(f.orgA, f.branchA, f.contactA, waA, RANGE.from);
    const convB = await makeConversation(f.orgB, f.branchB, f.contactB, waB, RANGE.from);

    await prisma.message.create({
      data: {
        organizationId: f.orgA,
        conversationId: convA,
        direction: 'inbound',
        authorType: 'contact',
        contentType: 'text',
        body: 'A',
        createdAt: RANGE.from,
      },
    });
    await prisma.message.create({
      data: {
        organizationId: f.orgB,
        conversationId: convB,
        direction: 'inbound',
        authorType: 'contact',
        contentType: 'text',
        body: 'B',
        createdAt: RANGE.from,
      },
    });
    // Outbound replies so the response-time aggregation has something to measure.
    await prisma.message.create({
      data: {
        organizationId: f.orgA,
        conversationId: convA,
        direction: 'outbound',
        authorType: 'agent',
        contentType: 'text',
        body: 'Reply A',
        createdAt: new Date(RANGE.from.getTime() + 60_000),
      },
    });
    await prisma.message.create({
      data: {
        organizationId: f.orgB,
        conversationId: convB,
        direction: 'outbound',
        authorType: 'agent',
        contentType: 'text',
        body: 'Reply B',
        createdAt: new Date(RANGE.from.getTime() + 120_000),
      },
    });

    const repoA = repoFor(f.orgA);
    const repoB = repoFor(f.orgB);

    // Conversations: A sees 1, B sees 1, never each other's.
    await expect(repoA.countNewConversations(RANGE)).resolves.toBe(1);
    await expect(repoB.countNewConversations(RANGE)).resolves.toBe(1);

    // Response time is measured per org; both have one measurable pair.
    const [respA, respB] = await Promise.all([
      repoA.averageResponseTimeSeconds(RANGE),
      repoB.averageResponseTimeSeconds(RANGE),
    ]);
    expect(respA).not.toBeNull();
    expect(respB).not.toBeNull();

    // Row lists stay within the org.
    expect(await repoA.recentConversations(5)).toHaveLength(1);
    expect(await repoB.recentConversations(5)).toHaveLength(1);
  });

  it('resolves an org-level scope covering all of the org branches', async () => {
    const branchA2 = await makeBranch(f.orgA, 'a-second', false);
    const wa = await makeWhatsappAccount(f.orgA, f.branchA);
    const wa2 = await makeWhatsappAccount(f.orgA, branchA2);

    await makeConversation(f.orgA, f.branchA, f.contactA, wa, RANGE.from);
    await makeConversation(f.orgA, branchA2, f.contactA, wa2, RANGE.from);

    const repo = repoFor(f.orgA);
    await expect(repo.countNewConversations(RANGE)).resolves.toBe(2);
  });
});

describe('notifications', () => {
  it('returns a user’s notifications, unread first', async () => {
    await prisma.notification.createMany({
      data: [
        {
          organizationId: f.orgA,
          userId: f.userA,
          kind: 'escalation',
          title: 'Old read',
          body: null,
          readAt: new Date(NOW.getTime() - 2 * DAY),
          createdAt: new Date(NOW.getTime() - 2 * DAY),
        },
        {
          organizationId: f.orgA,
          userId: f.userA,
          kind: 'escalation',
          title: 'New unread',
          body: 'Hi',
          createdAt: new Date(NOW.getTime() - 1 * DAY),
        },
      ],
    });

    const notifications = await repoFor(f.orgA).listNotifications(f.userA);

    expect(notifications.map((n) => n.title)).toEqual(['New unread', 'Old read']);
  });

  it('does not leak another user’s notifications', async () => {
    await prisma.notification.createMany({
      data: [
        {
          organizationId: f.orgA,
          userId: f.userA,
          kind: 'escalation',
          title: 'Mine',
          createdAt: NOW,
        },
        {
          organizationId: f.orgA,
          userId: f.userB,
          kind: 'escalation',
          title: 'Not mine',
          createdAt: NOW,
        },
      ],
    });

    const mine = await repoFor(f.orgA).listNotifications(f.userA);

    expect(mine.map((n) => n.title)).toEqual(['Mine']);
  });
});
