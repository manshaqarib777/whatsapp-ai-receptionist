import type { PrismaClient } from '@prisma/client';

import { SEED_NOW, daysFromNow, seedId } from './support';
import type { SeededTenants } from './tenants';

/**
 * Loyalty (Milestone 17).
 *
 * One enabled program, a silver account for a consented contact (with a spend
 * transaction so the history renders), one coupon, and one pending referral.
 */

export type SeededLoyalty = Awaited<ReturnType<typeof seedLoyalty>>;

export async function seedLoyalty(
  prisma: PrismaClient,
  tenants: SeededTenants,
): Promise<{
  programId: string;
  accountId: string;
  couponId: string;
  referralId: string;
}> {
  const program = await prisma.loyaltyProgram.create({
    data: {
      id: seedId('loyalty-program', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      name: 'Smile Rewards',
      pointsPerCurrency: 1,
      isEnabled: true,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });

  // Contact 4 is the consented Riyadh contact used across the seeds.
  const account = await prisma.loyaltyAccount.create({
    data: {
      id: seedId('loyalty-account', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      contactId: seedId('contact', 4),
      programId: program.id,
      balance: 450,
      totalEarned: 500,
      tier: 'silver',
      createdAt: daysFromNow(-20),
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });

  await prisma.loyaltyTransaction.create({
    data: {
      id: seedId('loyalty-transaction', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      accountId: account.id,
      kind: 'earn',
      pointsDelta: 500,
      reason: 'Paid invoice seed-earn',
      createdAt: daysFromNow(-18),
      updatedAt: daysFromNow(-18),
    },
  });
  await prisma.loyaltyTransaction.create({
    data: {
      id: seedId('loyalty-transaction', 2),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      accountId: account.id,
      kind: 'spend',
      pointsDelta: -50,
      reason: 'Seeded redemption',
      createdAt: daysFromNow(-3),
      updatedAt: daysFromNow(-3),
    },
  });

  const coupon = await prisma.coupon.create({
    data: {
      id: seedId('coupon', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      code: 'WELCOME10',
      type: 'percent',
      value: 10,
      maxRedemptions: 1,
      expiresAt: daysFromNow(30),
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });

  // Contact 3 refers contact 4 — pending until contact 4 earns.
  const referral = await prisma.referral.create({
    data: {
      id: seedId('referral', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      referrerId: seedId('contact', 3),
      referredContactId: seedId('contact', 4),
      bonusPoints: 100,
      status: 'pending',
      createdAt: daysFromNow(-15),
      updatedAt: daysFromNow(-15),
    },
    select: { id: true },
  });

  return {
    programId: program.id,
    accountId: account.id,
    couponId: coupon.id,
    referralId: referral.id,
  };
}
