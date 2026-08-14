// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { QuotationsRepository } from '@/features/quotations/repositories/quotations.repository';
import { QuotationsService } from '@/features/quotations/services/quotations.service';
import { ConflictError, UnprocessableError } from '@/lib/errors';

/**
 * Quotes integration tests — real Postgres.
 *
 * The non-negotiable: org A never sees org B's quotes. The lifecycle
 * (draft → sent → accepted/rejected, expiry), versioning on send, VAT totals,
 * and sequential numbering are exercised against the real database.
 */

type Fixture = {
  orgA: string;
  orgB: string;
  branchA: string;
  contactId: string;
};

let f: Fixture;
let suffix = 0;

async function makeOrg(label: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: label, slug: `quotes-${label}-${Date.now()}-${suffix}` },
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
      slug: `quotes-${label}-${Date.now()}-${suffix}`,
      timezone: 'Asia/Riyadh',
      isDefault: true,
    },
    select: { id: true },
  });
  return branch.id;
}

async function makeContact(orgId: string, branchId: string): Promise<string> {
  suffix += 1;
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumber: `+9665000${String(Math.floor(Math.random() * 100_000)).padStart(5, '0')}`,
      displayName: `Quote Contact ${suffix}`,
      hasConsent: true,
    },
    select: { id: true },
  });
  return contact.id;
}

const LINES = [
  { description: 'Root canal', quantity: 1, unitPriceAmount: 1450 },
  { description: 'Crown fitting', quantity: 1, unitPriceAmount: 2200 },
];

beforeEach(async () => {
  suffix += 1;
  f = {
    orgA: await makeOrg('A'),
    orgB: await makeOrg('B'),
    branchA: '',
    contactId: '',
  };
  f.branchA = await makeBranch(f.orgA, 'Main');
  await makeBranch(f.orgB, 'Main');
  f.contactId = await makeContact(f.orgA, f.branchA);
});

afterEach(async () => {
  const orgIds = [f.orgA, f.orgB];
  for (const orgId of orgIds) {
    await prisma.quoteVersion.deleteMany({ where: { organizationId: orgId } });
    await prisma.quoteLineItem.deleteMany({ where: { organizationId: orgId } });
    await prisma.quote.deleteMany({ where: { organizationId: orgId } });
    await prisma.quoteTemplate.deleteMany({ where: { organizationId: orgId } });
    await prisma.contact.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('quote creation (VAT + numbering)', () => {
  it('creates a draft quote with computed totals and a sequential number', async () => {
    const service = QuotationsService.forOrganization(f.orgA);
    const quote = await service.createQuote({
      contactId: f.contactId,
      lineItems: LINES,
    });

    expect(quote.status).toBe('draft');
    expect(quote.number).toMatch(/^Q-\d+$/);
    // 1450 + 2200 = 3650 subtotal; 15% = 547.5 tax; total 4197.5.
    expect(quote.subtotalAmount).toBe(3650);
    expect(quote.taxAmount).toBe(547.5);
    expect(quote.totalAmount).toBe(4197.5);
    expect(quote.lineItems).toHaveLength(2);
  });

  it('rejects an unknown contact', async () => {
    const service = QuotationsService.forOrganization(f.orgA);
    await expect(
      service.createQuote({
        contactId: '00000000-0000-4000-8000-000000000000',
        lineItems: LINES,
      }),
    ).rejects.toThrow(UnprocessableError);
  });

  it('numbers quotes sequentially', async () => {
    const service = QuotationsService.forOrganization(f.orgA);
    const first = await service.createQuote({ contactId: f.contactId, lineItems: [LINES[0] as { description: string; quantity: number; unitPriceAmount: number }] });
    const second = await service.createQuote({ contactId: f.contactId, lineItems: [LINES[0] as { description: string; quantity: number; unitPriceAmount: number }] });

    const firstNum = Number(first.number.replace('Q-', ''));
    const secondNum = Number(second.number.replace('Q-', ''));
    expect(secondNum).toBe(firstNum + 1);
  });
});

describe('quote lifecycle (status transitions + versioning)', () => {
  it('sends a draft (snapshotting a version) then accepts it', async () => {
    const service = QuotationsService.forOrganization(f.orgA);
    const quote = await service.createQuote({ contactId: f.contactId, lineItems: LINES });

    const sent = await service.transition(quote.id, 'send');
    expect(sent.status).toBe('sent');
    expect(sent.sentAt).not.toBeNull();

    const versions = await service.listVersions(quote.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.versionNumber).toBe(1);

    const accepted = await service.transition(quote.id, 'accept');
    expect(accepted.status).toBe('accepted');
    expect(accepted.acceptedAt).not.toBeNull();
  });

  it('rejects sending a quote that is already sent', async () => {
    const service = QuotationsService.forOrganization(f.orgA);
    const quote = await service.createQuote({ contactId: f.contactId, lineItems: LINES });

    await service.transition(quote.id, 'send');
    await expect(service.transition(quote.id, 'send')).rejects.toThrow(ConflictError);
  });

  it('cannot accept a draft (must be sent first)', async () => {
    const service = QuotationsService.forOrganization(f.orgA);
    const quote = await service.createQuote({ contactId: f.contactId, lineItems: LINES });

    await expect(service.transition(quote.id, 'accept')).rejects.toThrow(ConflictError);
  });

  it('can reject and expire a sent quote', async () => {
    const service = QuotationsService.forOrganization(f.orgA);
    const quote = await service.createQuote({ contactId: f.contactId, lineItems: LINES });
    await service.transition(quote.id, 'send');

    const rejected = await service.transition(quote.id, 'reject');
    expect(rejected.status).toBe('rejected');

    const fresh = await service.createQuote({ contactId: f.contactId, lineItems: LINES });
    await service.transition(fresh.id, 'send');
    const expired = await service.transition(fresh.id, 'expire');
    expect(expired.status).toBe('expired');
  });
});

describe('editing (draft only)', () => {
  it('refuses to edit a sent quote', async () => {
    const service = QuotationsService.forOrganization(f.orgA);
    const quote = await service.createQuote({ contactId: f.contactId, lineItems: LINES });
    await service.transition(quote.id, 'send');

    await expect(
      service.updateQuote(quote.id, { lineItems: [LINES[0] as { description: string; quantity: number; unitPriceAmount: number }] }),
    ).rejects.toThrow(ConflictError);
  });

  it('edits line items and recomputes totals on a draft', async () => {
    const service = QuotationsService.forOrganization(f.orgA);
    const quote = await service.createQuote({ contactId: f.contactId, lineItems: LINES });

    const updated = await service.updateQuote(quote.id, {
      lineItems: [
        { description: 'Root canal only', quantity: 1, unitPriceAmount: 1450 },
      ],
    });

    expect(updated.lineItems).toHaveLength(1);
    expect(updated.totalAmount).toBe(1667.5);
  });
});

describe('org isolation (the non-negotiable)', () => {
  it('org A never sees org B quotes', async () => {
    const a = QuotationsService.forOrganization(f.orgA);
    const b = QuotationsService.forOrganization(f.orgB);

    await a.createQuote({ contactId: f.contactId, lineItems: LINES });

    const bRepo = QuotationsRepository.forOrganization(f.orgB);
    const bBranch = await bRepo.resolveDefaultBranch();
    const bContact = await makeContact(f.orgB, bBranch);
    await b.createQuote({ contactId: bContact, lineItems: LINES });

    const bQuotes = await b.listQuotes();
    expect(bQuotes).toHaveLength(1);
    expect(bQuotes[0]?.contactName).not.toBeNull();
  });
});
