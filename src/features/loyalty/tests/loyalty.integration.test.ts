// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { LoyaltyService } from '@/features/loyalty/services/loyalty.service';
import { ConflictError, UnprocessableError } from '@/lib/errors';

/**
 * Loyalty integration tests — real Postgres.
 *
 * The non-negotiable: org A never sees org B's accounts, coupons, or referrals.
 * The earn worker (paid invoice → points, idempotent), the redeem guard, the
 * coupon rules, and the referral bonus are exercised against the real database.
 */

type Fixture = { orgA: string; orgB: string; branchA: string; branchB: string };

let f: Fixture;
let suffix = 0;

async function makeOrg(label: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: label, slug: `loyalty-${label}-${Date.now()}-${suffix}` },
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
      slug: `loyalty-${label}-${Date.now()}-${suffix}`,
      timezone: 'Asia/Riyadh',
      isDefault: true,
    },
    select: { id: true },
  });
  return branch.id;
}

function serviceFor(orgId: string): LoyaltyService {
  return LoyaltyService.forOrganization(orgId);
}

async function makeContact(orgId: string, branchId: string): Promise<string> {
  suffix += 1;
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumber: `+9665000${String(suffix).padStart(5, '0')}`,
      displayName: `Loyalty contact ${suffix}`,
      hasConsent: true,
    },
    select: { id: true },
  });
  return contact.id;
}

async function makePaidInvoice(
  orgId: string,
  branchId: string,
  contactId: string,
  amount: number,
): Promise<string> {
  suffix += 1;
  const invoice = await prisma.invoice.create({
    data: {
      organizationId: orgId,
      branchId,
      contactId,
      number: `LOY-${suffix}`,
      status: 'paid',
      subtotalAmount: amount,
      taxAmount: 0,
      totalAmount: amount,
      amountPaid: amount,
      currency: 'SAR',
      issuedAt: new Date(Date.now() - 5 * 3_600_000),
      paidAt: new Date(Date.now() - 2 * 3_600_000),
    },
    select: { id: true },
  });
  return invoice.id;
}

async function makeDraftInvoice(
  orgId: string,
  branchId: string,
  contactId: string,
  amount: number,
): Promise<string> {
  suffix += 1;
  const invoice = await prisma.invoice.create({
    data: {
      organizationId: orgId,
      branchId,
      contactId,
      number: `COUPON-${suffix}`,
      status: 'draft',
      subtotalAmount: amount,
      taxAmount: 0,
      totalAmount: amount,
      amountPaid: 0,
      currency: 'SAR',
    },
    select: { id: true },
  });
  return invoice.id;
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
    await prisma.loyaltyTransaction.deleteMany({ where: { organizationId: orgId } });
    await prisma.loyaltyAccount.deleteMany({ where: { organizationId: orgId } });
    await prisma.loyaltyProgram.deleteMany({ where: { organizationId: orgId } });
    await prisma.couponRedemption.deleteMany({ where: { organizationId: orgId } });
    await prisma.coupon.deleteMany({ where: { organizationId: orgId } });
    await prisma.referral.deleteMany({ where: { organizationId: orgId } });
    await prisma.invoice.deleteMany({ where: { organizationId: orgId } });
    await prisma.contact.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('loyalty — programs', () => {
  it('creates and lists a program with its earn rate', async () => {
    const service = serviceFor(f.orgA);
    const program = await service.createProgram({
      name: 'Smile Rewards',
      pointsPerCurrency: 1,
    });

    expect(program.name).toBe('Smile Rewards');
    expect(program.pointsPerCurrency).toBe(1);
    expect(program.isEnabled).toBe(true);

    const programs = await service.listPrograms();
    expect(programs).toHaveLength(1);
  });

  it('refuses a negative earn rate', async () => {
    await expect(
      serviceFor(f.orgA).createProgram({ name: 'Bad', pointsPerCurrency: -1 }),
    ).rejects.toThrow(UnprocessableError);
  });
});

describe('loyalty — earn worker', () => {
  it('credits a paid invoice exactly once and creates the account', async () => {
    const service = serviceFor(f.orgA);
    await service.createProgram({ name: 'P', pointsPerCurrency: 1 });
    const contactId = await makeContact(f.orgA, f.branchA);
    await makePaidInvoice(f.orgA, f.branchA, contactId, 1000);

    expect(await service.processEarnings()).toBe(1);

    const accounts = await service.listAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.contactId).toBe(contactId);
    expect(accounts[0]?.balance).toBe(1000);
    expect(accounts[0]?.tier).toBe('silver'); // 1000 ≥ 500

    // Idempotent — a second run awards nothing.
    expect(await service.processEarnings()).toBe(0);
    expect((await service.listAccounts())[0]?.balance).toBe(1000);
  });

  it('floors partial rates', async () => {
    const service = serviceFor(f.orgA);
    await service.createProgram({ name: 'P', pointsPerCurrency: 0.5 });
    const contactId = await makeContact(f.orgA, f.branchA);
    await makePaidInvoice(f.orgA, f.branchA, contactId, 999);

    await service.processEarnings();
    expect((await service.listAccounts())[0]?.balance).toBe(499);
  });

  it('does nothing without an enabled program', async () => {
    const service = serviceFor(f.orgA);
    const contactId = await makeContact(f.orgA, f.branchA);
    await makePaidInvoice(f.orgA, f.branchA, contactId, 1000);

    expect(await service.processEarnings()).toBe(0);
  });

  it('org B never sees org A accounts', async () => {
    const a = serviceFor(f.orgA);
    await a.createProgram({ name: 'A', pointsPerCurrency: 1 });
    const contactId = await makeContact(f.orgA, f.branchA);
    await makePaidInvoice(f.orgA, f.branchA, contactId, 100);
    await a.processEarnings();

    expect(await serviceFor(f.orgB).listAccounts()).toHaveLength(0);
  });
});

describe('loyalty — redeem', () => {
  it('redeems points and decrements the balance', async () => {
    const service = serviceFor(f.orgA);
    await service.createProgram({ name: 'P', pointsPerCurrency: 1 });
    const contactId = await makeContact(f.orgA, f.branchA);
    await makePaidInvoice(f.orgA, f.branchA, contactId, 1000);
    await service.processEarnings();

    const account = (await service.listAccounts())[0];
    if (!account) throw new Error('expected an account');

    const { account: after } = await service.redeem({
      accountId: account.id,
      points: 300,
      reason: 'Free check-up',
    });

    expect(after.balance).toBe(700);
    expect(after.totalEarned).toBe(1000);

    const transactions = await service.listTransactions(account.id);
    expect(transactions).toHaveLength(2);
    expect(transactions[0]?.kind).toBe('spend');
    expect(transactions[0]?.pointsDelta).toBe(-300);
  });

  it('refuses a redemption above the balance', async () => {
    const service = serviceFor(f.orgA);
    await service.createProgram({ name: 'P', pointsPerCurrency: 1 });
    const contactId = await makeContact(f.orgA, f.branchA);
    await makePaidInvoice(f.orgA, f.branchA, contactId, 100);
    await service.processEarnings();

    const account = (await service.listAccounts())[0];
    if (!account) throw new Error('expected an account');

    await expect(service.redeem({ accountId: account.id, points: 500 })).rejects.toThrow(
      ConflictError,
    );
  });
});

describe('loyalty — coupons', () => {
  it('creates and lists a coupon', async () => {
    const service = serviceFor(f.orgA);
    const coupon = await service.createCoupon({
      code: 'WELCOME10',
      type: 'percent',
      value: 10,
    });

    expect(coupon.code).toBe('WELCOME10');
    expect(coupon.maxRedemptions).toBe(1);
  });

  it('refuses a percent coupon above 100', async () => {
    await expect(
      serviceFor(f.orgA).createCoupon({ code: 'BAD', type: 'percent', value: 150 }),
    ).rejects.toThrow(UnprocessableError);
  });

  it('redeems a coupon once per contact, then refuses', async () => {
    const service = serviceFor(f.orgA);
    const coupon = await service.createCoupon({
      code: 'ONE',
      type: 'fixed',
      value: 50,
    });
    const contactId = await makeContact(f.orgA, f.branchA);
    const invoiceId = await makeDraftInvoice(f.orgA, f.branchA, contactId, 200);

    const redemption = await service.redeemCoupon({
      couponId: coupon.id,
      contactId,
      invoiceId,
    });
    expect(redemption.contactId).toBe(contactId);
    expect(redemption.discountAmount).toBe(50);
    await expect(
      prisma.invoice.findFirst({ where: { id: invoiceId } }),
    ).resolves.toMatchObject({
      totalAmount: expect.anything(),
      discountAmount: expect.anything(),
    });
    const discounted = await prisma.invoice.findFirstOrThrow({
      where: { id: invoiceId },
    });
    expect(Number(discounted.totalAmount)).toBe(150);
    expect(Number(discounted.discountAmount)).toBe(50);

    await expect(
      service.redeemCoupon({ couponId: coupon.id, contactId, invoiceId }),
    ).rejects.toThrow(ConflictError);
  });

  it('applies a percent coupon to a matching draft invoice', async () => {
    const service = serviceFor(f.orgA);
    const coupon = await service.createCoupon({
      code: 'TEN',
      type: 'percent',
      value: 10,
      maxRedemptions: 5,
    });
    const contactId = await makeContact(f.orgA, f.branchA);
    const invoiceId = await makeDraftInvoice(f.orgA, f.branchA, contactId, 115);

    const redemption = await service.redeemCoupon({
      couponId: coupon.id,
      contactId,
      invoiceId,
    });
    expect(redemption.discountAmount).toBe(11.5);
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { id: invoiceId } });
    expect(Number(invoice.totalAmount)).toBe(103.5);
  });
});

describe('loyalty — referrals', () => {
  it('creates a referral and rewards the referrer when the referral earns', async () => {
    const service = serviceFor(f.orgA);
    await service.createProgram({ name: 'P', pointsPerCurrency: 1 });
    const referrer = await makeContact(f.orgA, f.branchA);
    const referred = await makeContact(f.orgA, f.branchA);

    const referral = await service.createReferral({
      referrerId: referrer,
      referredContactId: referred,
    });
    expect(referral.status).toBe('pending');

    // The referred contact earns → the referrer gets the bonus.
    await makePaidInvoice(f.orgA, f.branchA, referred, 100);
    await service.processEarnings();

    const referrals = await service.listReferrals();
    expect(referrals[0]?.status).toBe('rewarded');

    const accounts = await service.listAccounts();
    const referrerAccount = accounts.find((a) => a.contactId === referrer);
    expect(referrerAccount?.balance).toBe(100); // the default bonus
  });

  it('refuses a self-referral', async () => {
    const contactId = await makeContact(f.orgA, f.branchA);
    await expect(
      serviceFor(f.orgA).createReferral({
        referrerId: contactId,
        referredContactId: contactId,
      }),
    ).rejects.toThrow(UnprocessableError);
  });
});
