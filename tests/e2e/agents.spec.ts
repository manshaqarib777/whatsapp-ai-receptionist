import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedId } from '../../prisma/seed/support';

test('manages the seeded specialist roster and tests safe routing', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('owner@northwind.test');
  await page.getByLabel('Password').fill('DemoPass!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/(dashboard|onboarding\/organization)/);
  expect(
    (
      await page.request.patch('/api/organizations/active', {
        data: { organizationId: seedId('org', 1) },
      })
    ).status(),
  ).toBe(200);
  await page.goto('/ai');
  await page.getByRole('tab', { name: 'Agents' }).click();

  for (const name of [
    'Reception Agent',
    'Treatment Sales Agent',
    'Patient Support Agent',
    'Campaign Assistant',
    'Practice Analytics Agent',
    'Billing Agent',
    'Operations Manager Agent',
    'Knowledge Agent',
  ]) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole('region', { name: 'Campaign Assistant' }).getByText('Disabled'),
  ).toBeVisible();
  const billing = page.getByRole('region', { name: 'Billing Agent' });
  await billing.getByLabel('Test routing phrase').fill('Please send my invoice receipt');
  await billing.getByRole('button', { name: 'Run local test' }).click();
  await expect(billing.getByRole('status')).toContainText('billing: [Local demo]');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
