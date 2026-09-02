import type { PrismaClient } from '@prisma/client';
import { SEED_NOW, seedId } from './support';
import type { SeededTenants } from './tenants';

const DEMO_PASSWORD_HASH =
  'de58940dcd66fca3b1dee2b06565e829:543453ac1fb3413e1709823a6ff8b909b0e9115a6f45d3deb57477a1a96961e1a32f264cfad78174c90043c8446db5074b87ce099d96ab1b60e7bffde1932dc9';

export async function seedAdmin(prisma: PrismaClient, tenants: SeededTenants) {
  const operator = await prisma.user.create({
    data: {
      id: seedId('platform-user', 1),
      name: 'Platform Operations',
      email: 'operator@platform.test',
      emailVerified: true,
      platformRole: 'operator',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  await prisma.account.create({
    data: {
      id: seedId('platform-account', 1),
      accountId: operator.id,
      providerId: 'credential',
      userId: operator.id,
      password: DEMO_PASSWORD_HASH,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  const definitions = [
    [
      'starter',
      'Starter',
      'For small teams validating their WhatsApp workflow.',
      49,
      'month',
      ['Inbox', 'Appointments'],
      { seats: 5, aiRuns: 2_000 },
    ],
    [
      'growth',
      'Growth',
      'For multi-branch teams using automation and analytics.',
      149,
      'month',
      ['AI agents', 'Workflows', 'Analytics'],
      { seats: 25, aiRuns: 20_000 },
    ],
    [
      'scale',
      'Scale',
      'For established operations requiring higher limits.',
      1490,
      'year',
      ['Priority support', 'Advanced controls'],
      { seats: 100, aiRuns: 250_000 },
    ],
  ] as const;
  const plans = [];
  for (const [
    index,
    [slug, name, description, amount, interval, features, limits],
  ] of definitions.entries()) {
    plans.push(
      await prisma.plan.create({
        data: {
          id: seedId('plan', index + 1),
          slug,
          name,
          description,
          amount,
          currency: 'USD',
          interval,
          features: [...features],
          limits,
          createdAt: SEED_NOW,
          updatedAt: SEED_NOW,
        },
      }),
    );
  }
  const monthLater = new Date(SEED_NOW);
  monthLater.setUTCMonth(monthLater.getUTCMonth() + 1);
  const yearLater = new Date(SEED_NOW);
  yearLater.setUTCFullYear(yearLater.getUTCFullYear() + 1);
  const growth = plans[1];
  const scale = plans[2];
  if (!growth || !scale) throw new Error('Admin seed plan catalog is incomplete.');
  await prisma.subscription.create({
    data: {
      id: seedId('subscription', 1),
      organizationId: tenants.northwind.id,
      planId: growth.id,
      status: 'active',
      amount: 149,
      currency: 'USD',
      interval: 'month',
      periodStartsAt: SEED_NOW,
      periodEndsAt: monthLater,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  await prisma.subscription.create({
    data: {
      id: seedId('subscription', 2),
      organizationId: tenants.beacon.id,
      planId: scale.id,
      status: 'trialing',
      amount: 1490,
      currency: 'USD',
      interval: 'year',
      periodStartsAt: SEED_NOW,
      periodEndsAt: yearLater,
      trialEndsAt: monthLater,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  return { operatorId: operator.id, planCount: plans.length, subscriptionCount: 2 };
}
