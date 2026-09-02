import type { PrismaClient } from '@prisma/client';

import { SEED_NOW, seedId } from './support';

/**
 * Organizations, branches, users, and memberships.
 *
 * DATABASE_RULES.md → Seed Data requires "multiple tenants, and at least one with
 * multiple branches" and "users across every role, so RBAC is visible".
 *
 * The two-branch tenant is the important one: branch isolation is the structural
 * decision of Milestone 4, and a single-branch seed would never exercise it. Anyone
 * looking at Riyadh must not see Jeddah's conversations.
 */

export const ROLES = ['owner', 'admin', 'member', 'viewer'] as const;

// Password for every synthetic seed user: DemoPass!2026
// This precomputed Better Auth scrypt value keeps repeat seeds deterministic.
const DEMO_PASSWORD_HASH =
  'de58940dcd66fca3b1dee2b06565e829:543453ac1fb3413e1709823a6ff8b909b0e9115a6f45d3deb57477a1a96961e1a32f264cfad78174c90043c8446db5074b87ce099d96ab1b60e7bffde1932dc9';

export type SeededTenants = Awaited<ReturnType<typeof seedTenants>>;

export async function seedTenants(prisma: PrismaClient) {
  // --- Tenant 1: multi-branch, the interesting one -------------------------
  const northwind = await prisma.organization.create({
    data: {
      id: seedId('org', 1),
      name: 'Northwind Dental',
      slug: 'northwind-dental',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  const riyadh = await prisma.branch.create({
    data: {
      id: seedId('branch', 1),
      organizationId: northwind.id,
      name: 'Riyadh — Olaya',
      slug: 'riyadh-olaya',
      timezone: 'Asia/Riyadh',
      isDefault: true,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  const jeddah = await prisma.branch.create({
    data: {
      id: seedId('branch', 2),
      organizationId: northwind.id,
      name: 'Jeddah — Corniche',
      slug: 'jeddah-corniche',
      timezone: 'Asia/Riyadh',
      isDefault: false,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  // --- Tenant 2: single branch, and the isolation counterexample -----------
  // Everything here exists so a cross-tenant leak has something to leak. Its data
  // deliberately mirrors tenant 1's shape.
  const beacon = await prisma.organization.create({
    data: {
      id: seedId('org', 2),
      name: 'Beacon Auto Care',
      slug: 'beacon-auto-care',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  const beaconMain = await prisma.branch.create({
    data: {
      id: seedId('branch', 3),
      organizationId: beacon.id,
      name: 'Main Workshop',
      slug: 'main-workshop',
      // A different zone from tenant 1, so any timezone bug shows up as a visible
      // discrepancy rather than hiding behind a shared offset.
      timezone: 'Europe/London',
      isDefault: true,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  // --- Users, one per role, in the multi-branch tenant ---------------------
  const staff: Record<string, string> = {};

  for (const [index, role] of ROLES.entries()) {
    const user = await prisma.user.create({
      data: {
        id: seedId('user', index + 1),
        name: `${role[0]?.toUpperCase()}${role.slice(1)} Example`,
        // .test is reserved by RFC 2606 and can never be registered.
        email: `${role}@northwind.test`,
        emailVerified: true,
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });

    await prisma.member.create({
      data: {
        id: seedId('member', index + 1),
        organizationId: northwind.id,
        userId: user.id,
        role,
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });

    await prisma.account.create({
      data: {
        id: seedId('account', index + 1),
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: DEMO_PASSWORD_HASH,
        createdAt: SEED_NOW,
        updatedAt: SEED_NOW,
      },
    });

    staff[role] = user.id;
  }

  // One user belonging to BOTH tenants, with different roles. This is what proves
  // tenancy lives on the membership rather than the user, and it is the account most
  // likely to expose a scoping bug.
  const consultant = await prisma.user.create({
    data: {
      id: seedId('user', 99),
      name: 'Dual Tenant Consultant',
      email: 'consultant@example.test',
      emailVerified: true,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  await prisma.member.create({
    data: {
      id: seedId('member', 98),
      organizationId: northwind.id,
      userId: consultant.id,
      role: 'viewer',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  await prisma.account.create({
    data: {
      id: seedId('account', 99),
      accountId: consultant.id,
      providerId: 'credential',
      userId: consultant.id,
      password: DEMO_PASSWORD_HASH,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  await prisma.member.create({
    data: {
      id: seedId('member', 99),
      organizationId: beacon.id,
      userId: consultant.id,
      role: 'owner',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  return {
    northwind: { id: northwind.id, riyadh: riyadh.id, jeddah: jeddah.id },
    beacon: { id: beacon.id, main: beaconMain.id },
    staff: {
      owner: staff['owner'] as string,
      admin: staff['admin'] as string,
      member: staff['member'] as string,
      viewer: staff['viewer'] as string,
    },
    consultant: consultant.id,
  };
}
