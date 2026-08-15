import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InboxRepository } from '@/features/inbox/repositories/inbox.repository';
import { prisma } from '@/lib/prisma';

/**
 * Inbox repository integration — real Postgres.
 *
 * Every inbox read/write is tenant-scoped through forScope(scope); the
 * non-negotiable assertion (per MILESTONE_06_PLAN R-1) is that org A never sees
 * org B rows in ANY query — list, thread, messages, notes, labels, search,
 * typing. These tests use fully controlled fixtures and exercise the exact
 * code path the application takes.
 */

const DAY = 86_400_000;

type Fixture = {
  orgA: string;
  orgB: string;
  branchA: string;
  branchB: string;
  contactA: string;
  contactB: string;
  waA: string;
  waB: string;
  userA: string;
};

let f: Fixture;
let suffix = 0;

async function makeUser(label: string): Promise<string> {
  suffix += 1;
  const user = await prisma.user.create({
    data: {
      name: `Inbox ${label}`,
      email: `inbox-${label}-${Date.now()}-${suffix}@test.local`,
      emailVerified: true,
    },
    select: { id: true },
  });
  return user.id;
}

async function makeOrg(orgLabel: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: orgLabel, slug: `${orgLabel}-${Date.now()}-${suffix}` },
    select: { id: true },
  });
  return org.id;
}

async function makeBranch(
  orgId: string,
  label: string,
  isDefault: boolean,
): Promise<string> {
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

async function makeContact(
  orgId: string,
  branchId: string,
  phone: string,
): Promise<string> {
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumber: phone,
      displayName: `Contact ${phone}`,
      locale: 'en',
    },
    select: { id: true },
  });
  return contact.id;
}

async function makeWhatsappAccount(orgId: string, branchId: string): Promise<string> {
  suffix += 1;
  const account = await prisma.whatsappAccount.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumberId: `inbox-pnid-${Date.now()}-${suffix}`,
      wabaId: `inbox-waba-${suffix}`,
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
  input: {
    status?: string;
    isPinned?: boolean;
    unreadCount?: number;
    lastMessageAt?: Date;
  } = {},
): Promise<string> {
  const conversation = await prisma.conversation.create({
    data: {
      organizationId: orgId,
      branchId,
      contactId,
      whatsappAccountId: waId,
      status: (input.status ?? 'open') as never,
      isPinned: input.isPinned ?? false,
      unreadCount: input.unreadCount ?? 0,
      lastMessageAt: input.lastMessageAt ?? new Date(),
    },
    select: { id: true },
  });
  return conversation.id;
}

async function makeMessage(
  conversationId: string,
  orgId: string,
  input: { direction: string; body: string; createdAt: Date; authorType?: string },
): Promise<string> {
  const message = await prisma.message.create({
    data: {
      organizationId: orgId,
      conversationId,
      direction: input.direction as never,
      authorType: (input.authorType ?? 'contact') as never,
      contentType: 'text',
      body: input.body,
      deliveryStatus: 'delivered',
      createdAt: input.createdAt,
    },
    select: { id: true },
  });
  return message.id;
}

async function makeLabel(orgId: string, branchId: string, name: string): Promise<string> {
  const label = await prisma.label.create({
    data: { organizationId: orgId, branchId, name, color: 'info' },
    select: { id: true },
  });
  return label.id;
}

beforeEach(async () => {
  const orgA = await makeOrg('inbox-a');
  const orgB = await makeOrg('inbox-b');

  const branchA = await makeBranch(orgA, 'a-main', true);
  const branchB = await makeBranch(orgB, 'b-main', true);

  const contactA = await makeContact(orgA, branchA, '+966500000011');
  const contactB = await makeContact(orgB, branchB, '+966500000012');

  const waA = await makeWhatsappAccount(orgA, branchA);
  const waB = await makeWhatsappAccount(orgB, branchB);

  const userA = await makeUser('a');

  f = { orgA, orgB, branchA, branchB, contactA, contactB, waA, waB, userA };
});

afterEach(async () => {
  for (const orgId of [f.orgA, f.orgB]) {
    await prisma.conversationLabel.deleteMany({ where: { organizationId: orgId } });
    await prisma.messageAttachment.deleteMany({ where: { organizationId: orgId } });
    await prisma.message.deleteMany({ where: { organizationId: orgId } });
    await prisma.conversationRead.deleteMany({ where: { organizationId: orgId } });
    await prisma.conversationTyping.deleteMany({ where: { organizationId: orgId } });
    await prisma.conversationSummary.deleteMany({ where: { organizationId: orgId } });
    await prisma.conversationNote.deleteMany({ where: { organizationId: orgId } });
    await prisma.conversation.deleteMany({ where: { organizationId: orgId } });
    await prisma.label.deleteMany({ where: { organizationId: orgId } });
    await prisma.whatsappAccount.deleteMany({ where: { organizationId: orgId } });
    await prisma.contact.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
  await prisma.user.deleteMany({ where: { id: f.userA } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

function repoFor(orgId: string): InboxRepository {
  return InboxRepository.forOrganization(orgId);
}

describe('conversation list', () => {
  it('orders pinned first, then unread, then last activity', async () => {
    const convOpen = await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, {
      status: 'open',
      unreadCount: 1,
      lastMessageAt: new Date(Date.now() - DAY),
    });
    const convPinned = await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, {
      status: 'open',
      isPinned: true,
      lastMessageAt: new Date(Date.now() - 2 * DAY),
    });
    const convOld = await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, {
      status: 'open',
      lastMessageAt: new Date(Date.now() - 3 * DAY),
    });

    const { rows } = await repoFor(f.orgA).listConversations();

    expect(rows.map((r) => r.id)).toEqual([convPinned, convOpen, convOld]);
    expect(rows[0]?.isPinned).toBe(true);
    expect(rows[1]?.unreadCount).toBe(1);
  });

  it('filters by status', async () => {
    await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, { status: 'open' });
    await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, { status: 'archived' });

    const { rows } = await repoFor(f.orgA).listConversations({ status: 'archived' });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('archived');
  });

  it('filters by unassigned', async () => {
    await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, { status: 'open' });

    const { rows } = await repoFor(f.orgA).listConversations({ assignee: 'unassigned' });

    expect(rows).toHaveLength(1);
  });

  it('org A never sees org B conversations', async () => {
    await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, { status: 'open' });
    await makeConversation(f.orgB, f.branchB, f.contactB, f.waB, { status: 'open' });

    const rowsA = await repoFor(f.orgA).listConversations();
    const rowsB = await repoFor(f.orgB).listConversations();

    expect(rowsA.rows).toHaveLength(1);
    expect(rowsB.rows).toHaveLength(1);
    expect(rowsA.rows[0]?.contactDisplayName).not.toBe(rowsB.rows[0]?.contactDisplayName);
  });

  it('paginates with a cursor', async () => {
    for (let i = 0; i < 5; i += 1) {
      await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, {
        lastMessageAt: new Date(Date.now() - i * DAY),
      });
    }

    const first = await repoFor(f.orgA).listConversations({ limit: 2 });
    expect(first.rows).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await repoFor(f.orgA).listConversations({
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.rows).toHaveLength(2);
    expect(second.rows[0]?.id).not.toBe(first.rows[0]?.id);
  });
});

describe('thread + messages', () => {
  it('lists messages newest-first with a cursor', async () => {
    const conv = await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, {
      status: 'open',
    });
    await makeMessage(conv, f.orgA, {
      direction: 'inbound',
      body: 'Hello',
      createdAt: new Date(Date.now() - 2 * DAY),
    });
    await makeMessage(conv, f.orgA, {
      direction: 'outbound',
      body: 'Hi there',
      createdAt: new Date(Date.now() - DAY),
    });

    const { rows } = await repoFor(f.orgA).listMessages(conv);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.body).toBe('Hi there');
    expect(rows[1]?.body).toBe('Hello');
  });

  it('marks read and zeroes the unread counter', async () => {
    const conv = await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, {
      status: 'open',
      unreadCount: 3,
    });

    await repoFor(f.orgA).markRead(conv, f.userA);

    const updated = await prisma.conversation.findFirst({ where: { id: conv } });
    expect(updated?.unreadCount).toBe(0);

    const read = await prisma.conversationRead.findFirst({
      where: { conversationId: conv },
    });
    expect(read).not.toBeNull();
  });

  it('sending a message bumps lastMessageAt and clears unread', async () => {
    const conv = await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, {
      status: 'open',
      unreadCount: 2,
      lastMessageAt: new Date(Date.now() - 10 * DAY),
    });

    const message = await repoFor(f.orgA).sendMessage({
      conversationId: conv,
      authorId: f.userA,
      body: 'Reply',
    });

    expect(message.direction).toBe('outbound');
    expect(message.authorType).toBe('agent');

    const updated = await prisma.conversation.findFirst({ where: { id: conv } });
    expect(updated?.unreadCount).toBe(0);
    expect(updated?.lastMessageAt.getTime()).toBeGreaterThan(Date.now() - 10 * DAY);
  });

  it('404s on a conversation from another org', async () => {
    await makeConversation(f.orgB, f.branchB, f.contactB, f.waB, { status: 'open' });

    const convB = (
      await prisma.conversation.findFirst({ where: { organizationId: f.orgB } })
    )?.id as string;

    await expect(repoFor(f.orgA).getConversation(convB)).rejects.toThrow('not found');
  });
});

describe('labels', () => {
  it('creates a label scoped to the default branch', async () => {
    const label = await repoFor(f.orgA).createLabel('VIP', 'warning');

    expect(label.name).toBe('VIP');
    const row = await prisma.label.findFirst({ where: { id: label.id } });
    expect(row?.organizationId).toBe(f.orgA);
  });

  it('adds and removes a label on a conversation', async () => {
    const conv = await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, {
      status: 'open',
    });
    const labelId = await makeLabel(f.orgA, f.branchA, 'Follow up');

    await repoFor(f.orgA).addLabel(conv, labelId);

    let withLabel = await repoFor(f.orgA).getConversation(conv);
    expect(withLabel.labels.some((l) => l.id === labelId)).toBe(true);

    await repoFor(f.orgA).removeLabel(conv, labelId);

    withLabel = await repoFor(f.orgA).getConversation(conv);
    expect(withLabel.labels.some((l) => l.id === labelId)).toBe(false);
  });

  it('cannot attach another org label to a conversation', async () => {
    const conv = await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, {
      status: 'open',
    });
    const labelB = await makeLabel(f.orgB, f.branchB, 'Other org');

    await expect(repoFor(f.orgA).addLabel(conv, labelB)).rejects.toThrow('not found');
  });
});

describe('typing', () => {
  it('writes a TTL-expiring typing row and cleans expired ones', async () => {
    const conv = await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, {
      status: 'open',
    });
    const userId = f.userA;

    await repoFor(f.orgA).setTyping(conv, userId, 10);

    let typing = await repoFor(f.orgA).listTyping(conv);
    expect(typing).toHaveLength(1);

    // Expired rows disappear from the list.
    await prisma.conversationTyping.updateMany({
      where: { conversationId: conv },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    typing = await repoFor(f.orgA).listTyping(conv);
    expect(typing).toHaveLength(0);
  });
});

describe('search', () => {
  it('finds message bodies and returns only the org rows', async () => {
    const convA = await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, {
      status: 'open',
    });
    const convB = await makeConversation(f.orgB, f.branchB, f.contactB, f.waB, {
      status: 'open',
    });
    await makeMessage(convA, f.orgA, {
      direction: 'inbound',
      body: 'Please send the quote for the root canal',
      createdAt: new Date(Date.now() - DAY),
    });
    await makeMessage(convB, f.orgB, {
      direction: 'inbound',
      body: 'Please send the quote for the other org',
      createdAt: new Date(Date.now() - DAY),
    });

    const hitsA = await repoFor(f.orgA).search('root canal');
    const hitsB = await repoFor(f.orgB).search('root canal');

    expect(hitsA).toHaveLength(1);
    expect(hitsA[0]?.body).toContain('root canal');
    expect(hitsB).toHaveLength(0);
  });
});

describe('summary', () => {
  it('persists and reads a heuristic summary', async () => {
    const conv = await makeConversation(f.orgA, f.branchA, f.contactA, f.waA, {
      status: 'open',
    });

    await repoFor(f.orgA).upsertSummary(conv, 'The contact wants a quote.');

    const summary = await repoFor(f.orgA).getSummary(conv);
    expect(summary?.summary).toBe('The contact wants a quote.');
    expect(summary?.model).toBe('heuristic');
  });
});
