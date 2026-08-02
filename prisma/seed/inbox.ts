import type { PrismaClient } from '@prisma/client';

import {
  EMOJI_ONLY_MESSAGE,
  INBOUND_TEXTS,
  LONG_MESSAGE,
  OUTBOUND_TEXTS,
  SEED_NOW,
  daysFromNow,
  seedId,
  type Random,
} from './support';
import type { SeededContacts } from './contacts';
import type { SeededTenants } from './tenants';

/**
 * Channels, conversations, and messages.
 *
 * DATABASE_RULES.md → Seed Data: "Conversations in every state: unread, assigned,
 * escalated, resolved, archived — with realistic message volume and timestamps spread
 * over weeks, not all now()", plus a very long message, an attachment, an emoji-only
 * message, and a failed delivery.
 *
 * The states are assigned explicitly rather than randomly. Random assignment over a
 * small set reliably misses one, and a missing state means the Milestone 6 inbox ships
 * with an untested filter.
 */

type ConversationPlan = {
  status: 'open' | 'pending' | 'resolved' | 'archived';
  assigned: boolean;
  escalated: boolean;
  pinned: boolean;
  unread: number;
  ageDays: number;
};

/** Every state the inbox can show, guaranteed present. */
const RIYADH_PLANS: readonly ConversationPlan[] = [
  {
    status: 'open',
    assigned: false,
    escalated: false,
    pinned: false,
    unread: 3,
    ageDays: 0,
  },
  {
    status: 'open',
    assigned: true,
    escalated: false,
    pinned: false,
    unread: 0,
    ageDays: 1,
  },
  {
    status: 'open',
    assigned: true,
    escalated: true,
    pinned: false,
    unread: 5,
    ageDays: 2,
  },
  {
    status: 'open',
    assigned: false,
    escalated: true,
    pinned: true,
    unread: 1,
    ageDays: 3,
  },
  {
    status: 'pending',
    assigned: true,
    escalated: false,
    pinned: false,
    unread: 0,
    ageDays: 6,
  },
  {
    status: 'resolved',
    assigned: true,
    escalated: false,
    pinned: false,
    unread: 0,
    ageDays: 11,
  },
  {
    status: 'resolved',
    assigned: true,
    escalated: true,
    pinned: false,
    unread: 0,
    ageDays: 19,
  },
  {
    status: 'archived',
    assigned: false,
    escalated: false,
    pinned: false,
    unread: 0,
    ageDays: 34,
  },
  {
    status: 'open',
    assigned: false,
    escalated: false,
    pinned: false,
    unread: 2,
    ageDays: 47,
  },
];

const LABELS = [
  { name: 'Booking', color: 'info' },
  { name: 'Complaint', color: 'destructive' },
  { name: 'VIP', color: 'success' },
  { name: 'Awaiting parts', color: 'warning' },
] as const;

export type SeededInbox = Awaited<ReturnType<typeof seedInbox>>;

export async function seedInbox(
  prisma: PrismaClient,
  tenants: SeededTenants,
  contacts: SeededContacts,
  random: Random,
) {
  const channels = await seedChannels(prisma, tenants);
  const labelIds = await seedLabels(prisma, tenants);

  let conversationCount = 0;
  let messageCount = 0;
  const conversationIds: string[] = [];

  for (const [index, plan] of RIYADH_PLANS.entries()) {
    const contactId = contacts.riyadhContacts[index % contacts.riyadhContacts.length];
    if (!contactId) continue;

    conversationCount += 1;
    const conversation = await createConversation(prisma, {
      id: seedId('conversation', conversationCount),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      contactId,
      channelId: channels.riyadh,
      assigneeId: plan.assigned ? tenants.staff.member : null,
      plan,
    });

    conversationIds.push(conversation);
    messageCount += await seedThread(prisma, {
      organizationId: tenants.northwind.id,
      conversationId: conversation,
      contactId,
      agentId: plan.assigned ? tenants.staff.member : null,
      ageDays: plan.ageDays,
      turns: random.int(2, 6),
      index: conversationCount,
      random,
    });

    // Two labels on the first few, none on the rest — a list where every row is
    // labelled tells you nothing about how the unlabelled case renders.
    if (index < 3) {
      await prisma.conversationLabel.create({
        data: {
          id: seedId('conv-label', conversationCount),
          organizationId: tenants.northwind.id,
          conversationId: conversation,
          labelId: labelIds[index % labelIds.length] as string,
          createdAt: SEED_NOW,
        },
      });
    }

    if (plan.escalated) {
      await prisma.conversationNote.create({
        data: {
          id: seedId('note', conversationCount),
          organizationId: tenants.northwind.id,
          conversationId: conversation,
          authorId: tenants.staff.admin,
          body: 'Escalated: customer asked for a manager. Internal only — never sent.',
          createdAt: daysFromNow(-plan.ageDays, 11),
          updatedAt: SEED_NOW,
        },
      });
    }
  }

  // Jeddah — fewer conversations, which is the point: the branch switcher must show a
  // visibly different inbox, not a differently-ordered copy of the same one.
  for (const [index, contactId] of contacts.jeddahContacts.entries()) {
    conversationCount += 1;
    const conversation = await createConversation(prisma, {
      id: seedId('conversation', conversationCount),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.jeddah,
      contactId,
      channelId: channels.jeddah,
      assigneeId: index === 0 ? tenants.staff.admin : null,
      plan: {
        status: 'open',
        assigned: index === 0,
        escalated: false,
        pinned: false,
        unread: index,
        ageDays: index + 2,
      },
    });

    conversationIds.push(conversation);
    messageCount += await seedThread(prisma, {
      organizationId: tenants.northwind.id,
      conversationId: conversation,
      contactId,
      agentId: null,
      ageDays: index + 2,
      turns: 2,
      index: conversationCount,
      random,
    });
  }

  // Tenant 2, so a leak has something to leak.
  for (const [index, contactId] of contacts.beaconContacts.entries()) {
    conversationCount += 1;
    const conversation = await createConversation(prisma, {
      id: seedId('conversation', conversationCount),
      organizationId: tenants.beacon.id,
      branchId: tenants.beacon.main,
      contactId,
      channelId: channels.beacon,
      assigneeId: null,
      plan: {
        status: 'open',
        assigned: false,
        escalated: false,
        pinned: false,
        unread: 1,
        ageDays: index + 1,
      },
    });

    conversationIds.push(conversation);
    messageCount += await seedThread(prisma, {
      organizationId: tenants.beacon.id,
      conversationId: conversation,
      contactId,
      agentId: null,
      ageDays: index + 1,
      turns: 2,
      index: conversationCount,
      random,
    });
  }

  messageCount += await seedEdgeCases(prisma, tenants, conversationIds[0] as string);

  return { conversationCount, messageCount, conversationIds, channels, labelIds };
}

async function seedChannels(prisma: PrismaClient, tenants: SeededTenants) {
  const make = async (n: number, orgId: string, branchId: string, display: string) => {
    const row = await prisma.whatsappAccount.create({
      data: {
        id: seedId('channel', n),
        organizationId: orgId,
        branchId,
        phoneNumberId: `seed-phone-number-id-${n}`,
        wabaId: `seed-waba-${n}`,
        displayPhoneNumber: display,
        // A reference into the secret store, never a token. If this string ever looks
        // like a credential, someone has made a mistake.
        accessTokenRef: `secret://whatsapp/seed-${n}`,
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });
    return row.id;
  };

  return {
    riyadh: await make(
      1,
      tenants.northwind.id,
      tenants.northwind.riyadh,
      '+966500090001',
    ),
    jeddah: await make(
      2,
      tenants.northwind.id,
      tenants.northwind.jeddah,
      '+966500090002',
    ),
    beacon: await make(3, tenants.beacon.id, tenants.beacon.main, '+966500090003'),
  };
}

async function seedLabels(prisma: PrismaClient, tenants: SeededTenants) {
  const ids: string[] = [];

  for (const [index, label] of LABELS.entries()) {
    const row = await prisma.label.create({
      data: {
        id: seedId('label', index + 1),
        organizationId: tenants.northwind.id,
        branchId: tenants.northwind.riyadh,
        name: label.name,
        color: label.color,
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });
    ids.push(row.id);
  }

  return ids;
}

async function createConversation(
  prisma: PrismaClient,
  args: {
    id: string;
    organizationId: string;
    branchId: string;
    contactId: string;
    channelId: string;
    assigneeId: string | null;
    plan: ConversationPlan;
  },
): Promise<string> {
  const row = await prisma.conversation.create({
    data: {
      id: args.id,
      organizationId: args.organizationId,
      branchId: args.branchId,
      contactId: args.contactId,
      whatsappAccountId: args.channelId,
      assigneeId: args.assigneeId,
      status: args.plan.status,
      isPinned: args.plan.pinned,
      isEscalated: args.plan.escalated,
      unreadCount: args.plan.unread,
      lastMessageAt: daysFromNow(-args.plan.ageDays, 14, 30),
      createdAt: daysFromNow(-args.plan.ageDays - 1),
      updatedAt: SEED_NOW,
    },
  });

  return row.id;
}

async function seedThread(
  prisma: PrismaClient,
  args: {
    organizationId: string;
    conversationId: string;
    contactId: string;
    agentId: string | null;
    ageDays: number;
    turns: number;
    index: number;
    random: Random;
  },
): Promise<number> {
  let written = 0;

  for (let turn = 0; turn < args.turns; turn += 1) {
    const inbound = turn % 2 === 0;
    // Minutes apart within the day, so a thread reads as a conversation rather than
    // as a batch import.
    const at = daysFromNow(-args.ageDays, 14, turn * 7);

    await prisma.message.create({
      data: {
        id: seedId(`message-${args.index}`, turn + 1),
        organizationId: args.organizationId,
        conversationId: args.conversationId,
        whatsappMessageId: inbound ? `wamid.seed.${args.index}.${turn}` : null,
        direction: inbound ? 'inbound' : 'outbound',
        authorType: inbound ? 'contact' : args.agentId ? 'agent' : 'ai',
        authorId: inbound ? null : args.agentId,
        contentType: 'text',
        body: inbound
          ? args.random.pick(INBOUND_TEXTS)
          : args.random.pick(OUTBOUND_TEXTS),
        deliveryStatus: inbound ? 'delivered' : 'read',
        createdAt: at,
        updatedAt: at,
      },
    });

    written += 1;
  }

  return written;
}

/**
 * The deliberate edge cases from DATABASE_RULES.md, all on one thread so a reviewer
 * can see every awkward case on a single screen.
 */
async function seedEdgeCases(
  prisma: PrismaClient,
  tenants: SeededTenants,
  conversationId: string,
): Promise<number> {
  const org = tenants.northwind.id;

  await prisma.message.create({
    data: {
      id: seedId('edge', 1),
      organizationId: org,
      conversationId,
      whatsappMessageId: 'wamid.seed.edge.long',
      direction: 'inbound',
      authorType: 'contact',
      contentType: 'text',
      body: LONG_MESSAGE,
      deliveryStatus: 'delivered',
      createdAt: daysFromNow(0, 15, 1),
      updatedAt: SEED_NOW,
    },
  });

  await prisma.message.create({
    data: {
      id: seedId('edge', 2),
      organizationId: org,
      conversationId,
      whatsappMessageId: 'wamid.seed.edge.emoji',
      direction: 'inbound',
      authorType: 'contact',
      contentType: 'text',
      body: EMOJI_ONLY_MESSAGE,
      deliveryStatus: 'delivered',
      createdAt: daysFromNow(0, 15, 2),
      updatedAt: SEED_NOW,
    },
  });

  const withAttachment = await prisma.message.create({
    data: {
      id: seedId('edge', 3),
      organizationId: org,
      conversationId,
      whatsappMessageId: 'wamid.seed.edge.image',
      direction: 'inbound',
      authorType: 'contact',
      contentType: 'image',
      body: null,
      deliveryStatus: 'delivered',
      createdAt: daysFromNow(0, 15, 3),
      updatedAt: SEED_NOW,
    },
  });

  await prisma.messageAttachment.create({
    data: {
      id: seedId('attachment', 1),
      organizationId: org,
      messageId: withAttachment.id,
      storageKey: 'seed/attachments/x-ray-placeholder.png',
      mimeType: 'image/png',
      sizeBytes: BigInt(184_320),
      fileName: 'x-ray.png',
      // Already expired, which is the realistic state: WhatsApp media URLs are
      // short-lived, so anything not copied to storage in time is gone.
      sourceUrlExpiresAt: daysFromNow(-1),
      createdAt: daysFromNow(0, 15, 3),
      updatedAt: SEED_NOW,
    },
  });

  await prisma.message.create({
    data: {
      id: seedId('edge', 4),
      organizationId: org,
      conversationId,
      direction: 'outbound',
      authorType: 'agent',
      contentType: 'text',
      body: 'Sending your appointment confirmation now.',
      deliveryStatus: 'failed',
      failureReason: 'Re-engagement window expired (24h). Template message required.',
      createdAt: daysFromNow(0, 15, 4),
      updatedAt: SEED_NOW,
    },
  });

  return 4;
}
