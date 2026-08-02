import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CONTACT_REDACTIONS, eraseContact } from '@/lib/db/erasure';
import { prisma } from '@/lib/prisma';

/**
 * Right to erasure (AD-4).
 *
 * The thing under test is not "the columns are empty" but the harder pair: the
 * personal data is gone AND the audit trail still resolves. A purge that takes the
 * trail with it fails an audit; a trail that still holds the phone number fails the
 * regulator.
 */

type Fixture = {
  orgA: string;
  orgB: string;
  branchA: string;
  branchB: string;
  contactA: string;
  contactA2: string;
  contactB: string;
  conversationA: string;
  messageA: string;
  attachmentA: string;
  noteA: string;
};

let f: Fixture;
const orgs: string[] = [];

async function seedTenant(label: string, phone: string) {
  const org = await prisma.organization.create({
    data: { name: label, slug: `${label}-${Date.now()}-${orgs.length}` },
    select: { id: true },
  });
  orgs.push(org.id);

  const branch = await prisma.branch.create({
    data: {
      organizationId: org.id,
      name: 'Main',
      slug: 'main',
      timezone: 'Asia/Riyadh',
      isDefault: true,
    },
    select: { id: true },
  });

  const contact = await prisma.contact.create({
    data: {
      organizationId: org.id,
      branchId: branch.id,
      phoneNumber: phone,
      displayName: 'Layla Al-Otaibi',
      email: 'layla@example.test',
    },
    select: { id: true },
  });

  return { org: org.id, branch: branch.id, contact: contact.id };
}

beforeEach(async () => {
  const a = await seedTenant('erase-a', '+966500001001');
  const b = await seedTenant('erase-b', '+966500001002');

  const secondContact = await prisma.contact.create({
    data: {
      organizationId: a.org,
      branchId: a.branch,
      phoneNumber: '+966500001003',
      displayName: 'Second Person',
    },
    select: { id: true },
  });

  const channel = await prisma.whatsappAccount.create({
    data: {
      organizationId: a.org,
      branchId: a.branch,
      phoneNumberId: `pnid-${Date.now()}`,
      wabaId: 'waba-1',
      displayPhoneNumber: '+966500009999',
      accessTokenRef: 'secret://token',
    },
    select: { id: true },
  });

  const conversation = await prisma.conversation.create({
    data: {
      organizationId: a.org,
      branchId: a.branch,
      contactId: a.contact,
      whatsappAccountId: channel.id,
    },
    select: { id: true },
  });

  const message = await prisma.message.create({
    data: {
      organizationId: a.org,
      conversationId: conversation.id,
      direction: 'inbound',
      authorType: 'contact',
      body: 'My national ID is 1234567890 and I live at 12 King Fahd Road.',
    },
    select: { id: true },
  });

  const attachment = await prisma.messageAttachment.create({
    data: {
      organizationId: a.org,
      messageId: message.id,
      storageKey: 'blob/passport-scan.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(1024),
      fileName: 'layla-passport.jpg',
    },
    select: { id: true },
  });

  const note = await prisma.conversationNote.create({
    data: {
      organizationId: a.org,
      conversationId: conversation.id,
      body: 'Customer said her number is +966500001001.',
    },
    select: { id: true },
  });

  f = {
    orgA: a.org,
    orgB: b.org,
    branchA: a.branch,
    branchB: b.branch,
    contactA: a.contact,
    contactA2: secondContact.id,
    contactB: b.contact,
    conversationA: conversation.id,
    messageA: message.id,
    attachmentA: attachment.id,
    noteA: note.id,
  };
});

afterEach(async () => {
  await prisma.conversationNote.deleteMany({ where: { organizationId: { in: orgs } } });
  await prisma.messageAttachment.deleteMany({ where: { organizationId: { in: orgs } } });
  await prisma.message.deleteMany({ where: { organizationId: { in: orgs } } });
  await prisma.conversation.deleteMany({ where: { organizationId: { in: orgs } } });
  await prisma.whatsappAccount.deleteMany({ where: { organizationId: { in: orgs } } });
  await prisma.contact.deleteMany({ where: { organizationId: { in: orgs } } });
  await prisma.branch.deleteMany({ where: { organizationId: { in: orgs } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
  orgs.length = 0;
});

describe('the redaction registry is complete', () => {
  it('covers every model carrying a redacted_at column', () => {
    // The guard against a future milestone adding a PII table and forgetting it.
    // Milestone 20 adds `transcriptions`; when it does, this fails until registered.
    const withRedactedAt = Prisma.dmmf.datamodel.models
      .filter((m) => m.fields.some((field) => field.name === 'redactedAt'))
      .map((m) => m.name);

    const stamped = CONTACT_REDACTIONS.filter((s) => s.stampsRedactedAt).map(
      (s) => s.model,
    );

    expect(withRedactedAt.length).toBeGreaterThan(0);
    expect([...withRedactedAt].sort()).toEqual([...stamped].sort());
  });

  it('names only models that exist', () => {
    const known = new Set(Prisma.dmmf.datamodel.models.map((m) => m.name));

    for (const spec of CONTACT_REDACTIONS) {
      expect(known.has(spec.model)).toBe(true);
    }
  });
});

describe('eraseContact', () => {
  const scopeA = () => ({ organizationId: f.orgA, branchId: f.branchA });

  it('clears the contact identifiers but keeps the row', async () => {
    await eraseContact(scopeA(), f.contactA);

    const after = await prisma.contact.findUniqueOrThrow({
      where: { id: f.contactA },
      select: {
        id: true,
        displayName: true,
        email: true,
        phoneNumber: true,
        redactedAt: true,
      },
    });

    expect(after.id).toBe(f.contactA);
    expect(after.displayName).toBe('Redacted');
    expect(after.email).toBeNull();
    expect(after.phoneNumber).not.toContain('966500001001');
    expect(after.redactedAt).not.toBeNull();
  });

  it('clears the message body, which is the largest store of customer PII', async () => {
    await eraseContact(scopeA(), f.contactA);

    const message = await prisma.message.findUniqueOrThrow({
      where: { id: f.messageA },
      select: { body: true, redactedAt: true, conversationId: true },
    });

    expect(message.body).toBeNull();
    expect(message.redactedAt).not.toBeNull();
    // The skeleton survives: the conversation it belonged to is still known.
    expect(message.conversationId).toBe(f.conversationA);
  });

  it('clears the attachment pointer and filename', async () => {
    await eraseContact(scopeA(), f.contactA);

    const attachment = await prisma.messageAttachment.findUniqueOrThrow({
      where: { id: f.attachmentA },
      select: { storageKey: true, fileName: true, redactedAt: true },
    });

    // A filename can identify a person on its own.
    expect(attachment.storageKey).toBe('');
    expect(attachment.fileName).toBeNull();
    expect(attachment.redactedAt).not.toBeNull();
  });

  it('clears internal notes, which quote the customer', async () => {
    await eraseContact(scopeA(), f.contactA);

    const note = await prisma.conversationNote.findUniqueOrThrow({
      where: { id: f.noteA },
      select: { body: true },
    });

    expect(note.body).toBe('Redacted');
    expect(note.body).not.toContain('966500001001');
  });

  it('leaves the audit trail resolvable — the whole point of redacting over deleting', async () => {
    await prisma.auditLog.create({
      data: {
        organizationId: f.orgA,
        action: 'contact.erased',
        entityType: 'contact',
        entityId: f.contactA,
      },
    });

    await eraseContact(scopeA(), f.contactA);

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: f.contactA, action: 'contact.erased' },
      select: { entityId: true },
    });

    // The trail still points at a real row. A hard delete would have left this
    // dangling, and the organization could no longer prove it honoured the request.
    const subject = await prisma.contact.findUnique({
      where: { id: entry.entityId as string },
      select: { id: true, redactedAt: true },
    });

    expect(subject).not.toBeNull();
    expect(subject?.redactedAt).not.toBeNull();
  });

  it('erases a contact who was already in the trash', async () => {
    await prisma.contact.update({
      where: { id: f.contactA },
      data: { deletedAt: new Date() },
    });

    await eraseContact(scopeA(), f.contactA);

    const after = await prisma.contact.findUniqueOrThrow({
      where: { id: f.contactA },
      select: { displayName: true, redactedAt: true },
    });

    // A soft-delete filter here would silently skip exactly the contacts most likely
    // to request erasure.
    expect(after.displayName).toBe('Redacted');
    expect(after.redactedAt).not.toBeNull();
  });

  it('does not collide when two contacts in one organization are erased', async () => {
    await eraseContact(scopeA(), f.contactA);
    await eraseContact(scopeA(), f.contactA2);

    const [first, second] = await Promise.all([
      prisma.contact.findUniqueOrThrow({
        where: { id: f.contactA },
        select: { phoneNumber: true },
      }),
      prisma.contact.findUniqueOrThrow({
        where: { id: f.contactA2 },
        select: { phoneNumber: true },
      }),
    ]);

    // phone_number is under a partial unique index, so a constant placeholder would
    // make the second erasure fail. This is why the registry allows a per-row value.
    expect(first.phoneNumber).not.toBe(second.phoneNumber);
  });

  it('refuses to erase another tenant contact', async () => {
    await expect(eraseContact(scopeA(), f.contactB)).rejects.toThrow(/not found/i);

    const untouched = await prisma.contact.findUniqueOrThrow({
      where: { id: f.contactB },
      select: { displayName: true, redactedAt: true },
    });

    expect(untouched.displayName).toBe('Layla Al-Otaibi');
    expect(untouched.redactedAt).toBeNull();
  });

  it('leaves the other tenant identical data untouched', async () => {
    await eraseContact(scopeA(), f.contactA);

    const other = await prisma.contact.findUniqueOrThrow({
      where: { id: f.contactB },
      select: { phoneNumber: true, email: true },
    });

    expect(other.email).toBe('layla@example.test');
    expect(other.phoneNumber).toBe('+966500001002');
  });

  it('reports what it touched, so the caller can audit it', async () => {
    const result = await eraseContact(scopeA(), f.contactA);

    expect(result.contactId).toBe(f.contactA);
    expect(result.rowsRedacted['Contact']).toBe(1);
    expect(result.rowsRedacted['Message']).toBe(1);
    expect(result.rowsRedacted['MessageAttachment']).toBe(1);
    expect(result.rowsRedacted['ConversationNote']).toBe(1);
    expect(result.rowsRedacted['Conversation']).toBe(1);
  });
});
