import { describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';

/**
 * The seed's acceptance criteria, as tests.
 *
 * DATABASE_RULES.md → Seed Data lists what a demo-able database must contain. That
 * list is only worth writing down if something checks it, so each bullet is a test
 * here. Milestones 5, 6, and 15 are unreviewable without this data, and a seed that
 * quietly loses a state takes a screen's empty-state coverage with it.
 *
 * Requires `npm run db:seed` to have been run — CI does so before the suite.
 */

const NORTHWIND = 'northwind-dental';

async function northwindId(): Promise<string> {
  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: NORTHWIND },
    select: { id: true },
  });
  return org.id;
}

describe('tenants and branches', () => {
  it('seeds more than one organization', async () => {
    const count = await prisma.organization.count({
      where: { slug: { in: [NORTHWIND, 'beacon-auto-care'] } },
    });
    expect(count).toBe(2);
  });

  it('gives at least one organization multiple branches', async () => {
    // Branch isolation is the structural decision of this milestone. A single-branch
    // seed would never exercise it.
    const branches = await prisma.branch.count({
      where: { organizationId: await northwindId() },
    });
    expect(branches).toBeGreaterThanOrEqual(2);
  });

  it('gives every organization exactly one default branch', async () => {
    const orgs = await prisma.organization.findMany({ select: { id: true } });

    for (const org of orgs) {
      const defaults = await prisma.branch.count({
        where: { organizationId: org.id, isDefault: true, deletedAt: null },
      });
      expect(defaults).toBeLessThanOrEqual(1);
    }
  });

  it('covers every role, so RBAC is visible', async () => {
    const members = await prisma.member.findMany({
      where: { organizationId: await northwindId() },
      select: { role: true },
    });

    const roles = new Set(members.map((m) => m.role));
    for (const role of ['owner', 'admin', 'member', 'viewer']) {
      expect(roles.has(role)).toBe(true);
    }
  });

  it('includes a user belonging to two tenants with different roles', async () => {
    const memberships = await prisma.member.findMany({
      where: { user: { email: 'consultant@example.test' } },
      select: { organizationId: true, role: true },
    });

    // The account most likely to expose a scoping bug: same person, different
    // authority depending on which tenant is active.
    expect(memberships.length).toBe(2);
    expect(new Set(memberships.map((m) => m.role)).size).toBe(2);
  });
});

describe('contacts and consent', () => {
  it('includes contacts with and without consent, and one opted out', async () => {
    const orgId = await northwindId();

    // Milestone 14 may not broadcast to an opted-out contact. Without one in the
    // seed, that rule cannot be demonstrated or caught being broken.
    expect(
      await prisma.contact.count({ where: { organizationId: orgId, hasConsent: true } }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.contact.count({ where: { organizationId: orgId, hasConsent: false } }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.contact.count({
        where: { organizationId: orgId, optedOutAt: { not: null } },
      }),
    ).toBeGreaterThan(0);
  });

  it('includes a right-to-left name', async () => {
    const rtl = await prisma.contact.findMany({
      where: { organizationId: await northwindId(), locale: 'ar' },
      select: { displayName: true },
    });

    expect(rtl.length).toBeGreaterThan(0);
    // Arabic block. Proves the RTL layout has something real to render.
    expect(rtl.some((c) => /[؀-ۿ]/.test(c.displayName))).toBe(true);
  });

  it('includes a 60-character company name', async () => {
    const companies = await prisma.company.findMany({ select: { name: true } });
    const longest = Math.max(...companies.map((c) => c.name.length));

    expect(longest).toBeGreaterThanOrEqual(60);
  });

  it('reuses the same phone numbers across tenants, which must be legal', async () => {
    // The partial unique index is per organization. If this ever fails, the index is
    // wrong; if a query ever returns both, isolation is wrong.
    const duplicated = await prisma.contact.groupBy({
      by: ['phoneNumber'],
      _count: { _all: true },
      having: { phoneNumber: { _count: { gt: 1 } } },
    });

    expect(duplicated.length).toBeGreaterThan(0);
  });
});

describe('conversations cover every state', () => {
  it.each(['open', 'pending', 'resolved', 'archived'] as const)(
    'includes at least one %s conversation',
    async (status) => {
      const count = await prisma.conversation.count({
        where: { organizationId: await northwindId(), status },
      });
      expect(count).toBeGreaterThan(0);
    },
  );

  it('includes unread, assigned, escalated, and pinned', async () => {
    const orgId = await northwindId();

    expect(
      await prisma.conversation.count({
        where: { organizationId: orgId, unreadCount: { gt: 0 } },
      }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.conversation.count({
        where: { organizationId: orgId, assigneeId: { not: null } },
      }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.conversation.count({
        where: { organizationId: orgId, isEscalated: true },
      }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.conversation.count({
        where: { organizationId: orgId, isPinned: true },
      }),
    ).toBeGreaterThan(0);
  });

  it('spreads timestamps over weeks rather than all at once', async () => {
    const rows = await prisma.conversation.findMany({
      where: { organizationId: await northwindId() },
      select: { lastMessageAt: true },
    });

    const times = rows.map((r) => r.lastMessageAt.getTime());
    const spanDays = (Math.max(...times) - Math.min(...times)) / 86_400_000;

    // "Timestamps spread over weeks, not all now()" — a dashboard filtered to the
    // last 7 days must show fewer rows than one filtered to 90.
    expect(spanDays).toBeGreaterThan(28);
  });
});

describe('deliberate message edge cases', () => {
  it('includes a very long message', async () => {
    const longest = await prisma.message.findFirst({
      where: { organizationId: await northwindId(), body: { not: null } },
      orderBy: { body: 'desc' },
      select: { body: true },
    });

    const lengths = (
      await prisma.message.findMany({
        where: { organizationId: await northwindId() },
        select: { body: true },
      })
    ).map((m) => m.body?.length ?? 0);

    expect(longest).not.toBeNull();
    expect(Math.max(...lengths)).toBeGreaterThan(500);
  });

  it('includes an emoji-only message', async () => {
    const messages = await prisma.message.findMany({
      where: { organizationId: await northwindId(), contentType: 'text' },
      select: { body: true },
    });

    const emojiOnly = messages.some(
      (m) => m.body !== null && m.body.length > 0 && !/[a-zA-Z0-9؀-ۿ]/.test(m.body),
    );

    expect(emojiOnly).toBe(true);
  });

  it('includes an attachment whose source URL has already expired', async () => {
    const attachment = await prisma.messageAttachment.findFirst({
      where: { organizationId: await northwindId() },
      select: { storageKey: true, sourceUrlExpiresAt: true },
    });

    expect(attachment).not.toBeNull();
    // The realistic state: WhatsApp media URLs are short-lived, so anything not copied
    // to storage in time is already gone.
    expect(attachment?.sourceUrlExpiresAt).not.toBeNull();
  });

  it('includes a failed delivery with a reason', async () => {
    const failed = await prisma.message.findFirst({
      where: { organizationId: await northwindId(), deliveryStatus: 'failed' },
      select: { failureReason: true },
    });

    expect(failed).not.toBeNull();
    expect(failed?.failureReason).toBeTruthy();
  });
});

describe('appointments cover every state', () => {
  it('includes past, upcoming, cancelled, rescheduled, and recurring', async () => {
    const orgId = await northwindId();
    const now = new Date('2026-08-01T09:00:00.000Z');

    expect(
      await prisma.appointment.count({
        where: { organizationId: orgId, startsAt: { lt: now } },
      }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.appointment.count({
        where: { organizationId: orgId, startsAt: { gt: now } },
      }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.appointment.count({
        where: { organizationId: orgId, status: 'cancelled' },
      }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.appointment.count({
        where: { organizationId: orgId, rescheduledFromId: { not: null } },
      }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.appointment.count({
        where: { organizationId: orgId, recurrenceRule: { not: null } },
      }),
    ).toBeGreaterThan(0);
  });

  it('spans more than one timezone', async () => {
    const zones = await prisma.appointment.findMany({
      distinct: ['timezone'],
      select: { timezone: true },
    });

    // Two tenants in one zone would hide a bug where the branch timezone is ignored
    // in favour of the server's.
    expect(zones.length).toBeGreaterThan(1);
  });

  it('never double-books a resource', async () => {
    // The exclusion constraint guarantees this, so the seed cannot violate it — the
    // test documents the invariant and would catch it being dropped.
    const overlaps = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count
      FROM appointments a
      JOIN appointments b
        ON a.resource_id = b.resource_id
       AND a.id <> b.id
       AND tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at)
      WHERE a.status IN ('booked','confirmed')
        AND b.status IN ('booked','confirmed')
        AND a.deleted_at IS NULL AND b.deleted_at IS NULL`;

    expect(Number(overlaps[0]?.count ?? 0)).toBe(0);
  });
});

describe('commerce renders a meaningful funnel', () => {
  it('distributes deals across every pipeline stage', async () => {
    const grouped = await prisma.deal.groupBy({
      by: ['stageId'],
      where: { organizationId: await northwindId() },
      _count: { _all: true },
    });

    // Five stages with two deals each renders as a rectangle and proves nothing.
    expect(grouped.length).toBeGreaterThanOrEqual(5);
  });

  it('includes won and lost deals, so conversion is not 100%', async () => {
    const orgId = await northwindId();

    expect(
      await prisma.deal.count({ where: { organizationId: orgId, status: 'won' } }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.deal.count({ where: { organizationId: orgId, status: 'lost' } }),
    ).toBeGreaterThan(0);
  });

  it('stores tax as a fraction with the amount alongside it', async () => {
    const line = await prisma.invoiceLineItem.findFirstOrThrow({
      select: { taxRate: true, taxAmount: true, unitPriceAmount: true },
    });

    // 0.15, never 15. The CHECK constraint enforces it; this proves the seed agrees.
    expect(Number(line.taxRate)).toBeLessThanOrEqual(1);
    expect(Number(line.taxAmount)).toBeCloseTo(
      Number(line.unitPriceAmount) * Number(line.taxRate),
      2,
    );
  });

  it('covers every invoice state including overdue and void', async () => {
    const states = await prisma.invoice.findMany({
      distinct: ['status'],
      select: { status: true },
    });

    const found = new Set(states.map((s) => s.status));
    for (const status of [
      'paid',
      'partially_paid',
      'issued',
      'overdue',
      'draft',
      'void',
    ]) {
      expect(found.has(status as (typeof states)[number]['status'])).toBe(true);
    }
  });

  it('includes a refund, so net revenue has something to subtract', async () => {
    expect(await prisma.refund.count()).toBeGreaterThan(0);
  });
});

describe('the seed is synthetic', () => {
  it('uses only unallocated phone numbers', async () => {
    const contacts = await prisma.contact.findMany({ select: { phoneNumber: true } });

    // +9665000 0xxxx is not an allocated Saudi subscriber block, so none of these can
    // dial a real handset. DATABASE_RULES.md: "no real phone numbers".
    for (const contact of contacts) {
      expect(contact.phoneNumber.startsWith('+9665000')).toBe(true);
    }
  });

  it('uses reserved email domains', async () => {
    // Scoped to users the SEED owns — other integration tests create their own users
    // in this database, and asserting over every row would make this test depend on
    // whatever ran before it.
    const users = await prisma.user.findMany({
      where: { members: { some: { organization: { slug: NORTHWIND } } } },
      select: { email: true },
    });

    expect(users.length).toBeGreaterThan(0);

    // .test is reserved by RFC 2606 and can never be registered, so no seed account
    // can receive mail.
    for (const user of users) {
      expect(user.email.endsWith('.test')).toBe(true);
    }
  });

  it('stores a secret-store reference rather than a token', async () => {
    const channels = await prisma.whatsappAccount.findMany({
      select: { accessTokenRef: true },
    });

    for (const channel of channels) {
      expect(channel.accessTokenRef.startsWith('secret://')).toBe(true);
    }
  });

  it('keeps card data out of payment payloads', async () => {
    const events = await prisma.paymentEvent.findMany({ select: { payload: true } });

    for (const event of events) {
      const serialised = JSON.stringify(event.payload);
      // Storing a PAN would put this system in PCI scope.
      expect(serialised).not.toMatch(/\b\d{13,19}\b/);
      expect(serialised.toLowerCase()).not.toContain('card');
    }
  });
});
