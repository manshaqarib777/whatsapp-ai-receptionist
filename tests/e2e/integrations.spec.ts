import { expect, test } from '@playwright/test';
import { prisma } from '@/lib/prisma';

const PASSWORD = 'correct-horse-battery-staple';
const SERVER_REFRESH_TIMEOUT_MS = 15_000;

test('configures, tests, disables, and disconnects a sandbox integration', async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const email = `e2e-integrations-${suffix}@test.local`;
  let organizationId = '';
  let userId = '';
  try {
    expect(
      (
        await page.request.post('/api/auth/sign-up/email', {
          data: { name: 'E2E Integrations', email, password: PASSWORD },
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
    const response = await page.request.post('/api/organizations', {
      data: { name: `Integrations ${suffix}` },
    });
    organizationId = ((await response.json()) as { data: { id: string } }).data.id;
    await page.request.patch('/api/organizations/active', { data: { organizationId } });
    await page.goto('/settings/integrations');
    const google = page.getByRole('region', { name: 'Google' });
    await google.getByLabel('Calendar ID').fill('appointments@demo.test');
    await google.getByRole('button', { name: 'Configure sandbox' }).click();
    await expect(google.getByRole('button', { name: 'Test' })).toBeVisible({
      timeout: SERVER_REFRESH_TIMEOUT_MS,
    });
    await google.getByRole('button', { name: 'Test' }).click();
    await expect(google.getByText('connected', { exact: true })).toBeVisible({
      timeout: SERVER_REFRESH_TIMEOUT_MS,
    });
    await google.getByRole('button', { name: 'Disable' }).click();
    await google.getByRole('button', { name: 'Save' }).click();
    await google.getByRole('button', { name: 'Disconnect' }).click();
    await expect(google.getByRole('button', { name: 'Configure sandbox' })).toBeVisible({
      timeout: SERVER_REFRESH_TIMEOUT_MS,
    });
  } finally {
    if (organizationId)
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  }
});
