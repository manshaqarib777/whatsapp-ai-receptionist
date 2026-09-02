import { expect, test } from '@playwright/test';

import { prisma } from '@/lib/prisma';

const PASSWORD = 'correct-horse-battery-staple';

test('switches branches and keeps appointment services isolated', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const email = `e2e-branches-${suffix}@test.local`;
  let organizationId = '';
  let userId = '';

  try {
    expect(
      (
        await page.request.post('/api/auth/sign-up/email', {
          data: { name: 'E2E Branches', email, password: PASSWORD },
        })
      ).status(),
    ).toBe(200);
    const user = await prisma.user.findFirstOrThrow({
      where: { email },
      select: { id: true },
    });
    userId = user.id;
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/\/dashboard/);

    const createdOrg = await page.request.post('/api/organizations', {
      data: { name: `Branches ${suffix}` },
    });
    expect(createdOrg.status()).toBe(201);
    organizationId = ((await createdOrg.json()) as { data: { id: string } }).data.id;
    expect(
      (
        await page.request.patch('/api/organizations/active', {
          data: { organizationId },
        })
      ).status(),
    ).toBe(200);

    const branchList = await page.request.get('/api/branches');
    const mainId = ((await branchList.json()) as { data: { branches: { id: string }[] } })
      .data.branches[0]?.id;
    expect(mainId).toBeTruthy();
    expect(
      (
        await page.request.post('/api/appointments/services', {
          data: { name: 'Main service', durationMinutes: 30, priceAmount: 50 },
        })
      ).status(),
    ).toBe(201);

    const createdBranch = await page.request.post('/api/branches', {
      data: { name: 'West', timezone: 'Asia/Riyadh' },
    });
    expect(createdBranch.status()).toBe(201);
    const westId = ((await createdBranch.json()) as { data: { branch: { id: string } } })
      .data.branch.id;
    expect(
      (
        await page.request.patch('/api/branches/active', { data: { branchId: westId } })
      ).status(),
    ).toBe(200);

    const westServices = await page.request.get('/api/appointments/services');
    expect(
      ((await westServices.json()) as { data: { services: unknown[] } }).data.services,
    ).toHaveLength(0);
    expect(
      (
        await page.request.post('/api/appointments/services', {
          data: { name: 'West service', durationMinutes: 30, priceAmount: 75 },
        })
      ).status(),
    ).toBe(201);

    expect(
      (
        await page.request.patch('/api/branches/active', { data: { branchId: mainId } })
      ).status(),
    ).toBe(200);
    const mainServices = await page.request.get('/api/appointments/services');
    const names = (
      (await mainServices.json()) as { data: { services: { name: string }[] } }
    ).data.services.map((service) => service.name);
    expect(names).toEqual(['Main service']);

    await page.goto('/settings/branches');
    await expect(page.getByRole('heading', { name: 'Branches' })).toBeVisible();
    await expect(page.getByText('West')).toBeVisible();
  } finally {
    if (organizationId) {
      await prisma.service.deleteMany({ where: { organizationId } });
      await prisma.branch.deleteMany({ where: { organizationId } });
      await prisma.member.deleteMany({ where: { organizationId } });
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  }
});
