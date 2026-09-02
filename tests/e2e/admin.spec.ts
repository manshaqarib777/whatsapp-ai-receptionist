import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('DemoPass!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/(dashboard|onboarding\/organization)/);
}

test('platform operator can inspect every safe admin surface', async ({ page }) => {
  await signIn(page, 'operator@platform.test');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  for (const tab of [
    'Tenants',
    'Plans',
    'Billing',
    'Logs',
    'AI usage',
    'Analytics',
    'Monitoring',
  ]) {
    await page.getByRole('tab', { name: tab }).click();
  }
  await expect(page.getByText('Database latency')).toBeVisible();
  for (const route of [
    'overview',
    'tenants',
    'plans',
    'billing',
    'logs',
    'ai-usage',
    'analytics',
    'monitoring',
  ]) {
    expect((await page.request.get(`/api/admin/${route}`)).status()).toBe(200);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('tenant owner cannot access platform administration', async ({ page }) => {
  await signIn(page, 'owner@northwind.test');
  expect((await page.request.get('/api/admin/overview')).status()).toBe(403);
  expect((await page.request.get('/api/admin/tenants')).status()).toBe(403);
});
